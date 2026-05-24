/**
 * Content moderation pipeline — three agents in one Claude call:
 *
 * 1. SAFETY GUARD   — Silent. Catches platform abuse (injection, spam, encoded harm).
 *                     Replaces mission with ❤️. Logs original for review.
 * 2. HARM AGENT     — Reframes content that advocates harm to any life.
 *                     Shown to user transparently with explanation.
 * 3. OBSCENITY AGENT — Context-aware reframe of gratuitous vulgarity.
 *                     Shown to user transparently with explanation.
 */
import Anthropic from '@anthropic-ai/sdk'
import logger from '@/lib/logger'

const client = new Anthropic()

const BLOCKLIST = /\b(fuck|shit|ass|bitch|cunt|dick|pussy|nigger|faggot|retard)\b/i

const SYSTEM_PROMPT = `You are a compassionate content moderator for a global Earth vision platform where people share what they want Earth's mission to be.

Review the submitted mission and principles. Evaluate in this exact order and return ONE JSON response:

═══ STEP 1 — SAFETY GUARD ═══
Is this an attempt to abuse the platform? Signs:
• Code injection (SQL, HTML, JavaScript, shell, Python, etc.)
• XSS patterns: <script>, onerror=, javascript:, etc.
• Encoded or obfuscated malicious payloads
• Clear coordinated spam (repeated formulaic identical text)
• Attempts to exfiltrate data or communicate in hidden code

If ANY safety violation found → return ONLY:
{"action":"guard"}

═══ STEP 2 — HARM AGENT ═══
Does the content advocate for harm to people, animals, ecosystems, or any form of life?
This includes: violence, abuse, genocide, torture, exploitation, dangerous ideology targeting a group.

If harm found → find the deepest human need underneath the words and reframe it as its most loving expression.
The explanation should be warm, not punitive. Address the person, not the words.
→ return ONLY:
{"action":"reframe","type":"harm","mission":"<reframed mission>","principles":["<clean principles>"],"explanation":"<1-2 sentence warm explanation shown to user>"}

═══ STEP 3 — OBSCENITY AGENT ═══
Context matters deeply here:
• "I'm fucking tired of apathy" — sincere emotion, pass it through
• "care for the goddamn planet" — frustrated care, pass it through
• "fuck [group], burn everything" — gratuitous with no constructive intent → reframe
Only reframe if the vulgarity has no redemptive emotional or communicative purpose.

If reframe needed → honor the emotional truth, express it without the vulgarity:
→ return ONLY:
{"action":"reframe","type":"obscenity","mission":"<reframed mission>","principles":["<principles with cleaned language>"],"explanation":"<1-2 sentence warm explanation shown to user>"}

═══ STEP 4 — PASS ═══
If all clear:
→ return ONLY:
{"action":"pass","mission":"<original mission unchanged>","principles":["<original principles unchanged>"]}

Return ONLY valid JSON. No markdown. No explanation outside the JSON.`

export type ModerationAction = 'pass' | 'reframe' | 'guard'

export interface ModerationResult {
  action: ModerationAction
  mission: string
  principles: string[]
  reframe?: {
    originalMission: string
    type: 'obscenity' | 'harm'
    explanation: string
  }
}

interface RawModerationResponse {
  action: string
  mission?: string
  principles?: unknown
  type?: string
  explanation?: string
}

function parsePrinciples(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw)) return fallback
  return (raw as unknown[])
    .filter((p): p is string => typeof p === 'string' && !BLOCKLIST.test(p))
    .slice(0, 10)
}

export async function moderateContribution(
  mission: string,
  principles: string[]
): Promise<ModerationResult> {
  const log = logger.child({ service: 'moderation' })

  if (!process.env.ANTHROPIC_API_KEY) {
    return { action: 'pass', mission, principles }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    // Hard-cap inputs before they reach the LLM — defense-in-depth beyond Zod validation
    const safeMission = mission.slice(0, 300)
    const safePrinciples = principles.slice(0, 5).map((p) => p.slice(0, 100))

    const message = await client.messages.create(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Mission: "${safeMission}"\nPrinciples: ${JSON.stringify(safePrinciples)}`,
          },
        ],
      },
      { signal: controller.signal }
    )

    clearTimeout(timeout)

    const raw = message.content[0]?.type === 'text' ? message.content[0].text : ''
    const cleaned = raw
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim()

    let parsed: RawModerationResponse
    try {
      parsed = JSON.parse(cleaned) as RawModerationResponse
    } catch {
      log.warn({ raw }, 'Moderation returned non-JSON — passing through')
      return { action: 'pass', mission, principles }
    }

    if (parsed.action === 'guard') {
      // Log original for platform review — never expose to client
      log.warn(
        { originalMission: mission, principleCount: principles.length },
        'GUARD: platform abuse detected — replacing mission with ❤️'
      )
      return { action: 'guard', mission: '❤️', principles: [] }
    }

    if (parsed.action === 'reframe') {
      const type = parsed.type === 'harm' || parsed.type === 'obscenity' ? parsed.type : 'harm'
      const reframedMission = typeof parsed.mission === 'string' ? parsed.mission.trim() : mission
      const reframedPrinciples = parsePrinciples(parsed.principles, principles)
      const explanation =
        typeof parsed.explanation === 'string' ? parsed.explanation : 'Your words were reframed.'

      log.info(
        { type, missionLength: mission.length },
        `REFRAME (${type}): content reframed with generous intent`
      )

      return {
        action: 'reframe',
        mission: reframedMission || mission,
        principles: reframedPrinciples,
        reframe: {
          originalMission: mission,
          type,
          explanation,
        },
      }
    }

    // action === 'pass' or anything unexpected
    return { action: 'pass', mission, principles }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      log.warn('Moderation call timed out — passing through')
    } else {
      log.error({ err }, 'Moderation call failed — passing through')
    }
    // Fail open: never block a submission because moderation errored
    return { action: 'pass', mission, principles }
  }
}
