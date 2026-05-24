import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { FirstPrinciplesRequestSchema } from '@/lib/schemas/firstPrinciples'
import { createClient } from '@/lib/supabase/server'
import logger from '@/lib/logger'

const client = new Anthropic()

const SYSTEM_PROMPT = `You are a thoughtful helper for a collective Earth mission project.
Someone has shared what they want Earth's mission to be. Your job is to suggest 5–7 first principles — the underlying values and commitments that would make that mission real.

A first principle is NOT a goal or a mission statement. It is a short, concrete value or behavioral commitment that guides HOW we act.

Good principle examples (notice: short, specific, action-oriented):
- "Care precedes transaction"
- "Repair over perfection"
- "Curiosity over certainty"
- "Presence as practice"
- "Long-term thinking"
- "Truth-telling as kindness"
- "Listen before speaking"
- "Tend what is fragile"

BAD examples (these are missions, not principles — do NOT produce these):
- "Work together to heal the earth" ← this is a mission, not a principle
- "Create a world of love and connection" ← too abstract and goal-like
- "Make the earth a better place" ← a mission statement, not a principle

Rules you MUST follow:
1. Each principle is 3–7 words. Short. No sentences.
2. Each principle names a VALUE or BEHAVIOR, not a destination.
3. Derive principles from the specific language and intent in the mission text.
4. Do NOT repeat the mission itself as a principle.
5. Do NOT write aspirational goals ("to achieve...", "to create...").
6. If the mission contains hate speech, violence, or harmful intent, return { "principles": [] } and nothing else.
7. Return ONLY valid JSON — no markdown, no explanation:
{ "principles": ["...", "...", "..."] }`

// Simple word-level blocklist as a defense-in-depth layer behind the LLM guardrail.
// Deliberately short — Claude handles nuanced moderation; this catches obvious bypasses.
const BLOCKLIST = /\b(fuck|shit|ass|bitch|cunt|dick|pussy|nigger|faggot|retard)\b/i

function sanitize(principles: string[]): string[] {
  return principles
    .map((p) => p.trim())
    .filter((p) => p.length >= 2 && p.length <= 80 && !BLOCKLIST.test(p))
}

export async function POST(req: Request) {
  const log = logger.child({ route: 'first-principles' })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = FirstPrinciplesRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', detail: parsed.error.issues },
      { status: 422 }
    )
  }

  // Require a valid anonymous session — prevents unauthenticated LLM calls
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    // Fail open: client falls back to static seeds; no auth error exposed
    return NextResponse.json({ principles: [] })
  }

  // Hard-cap input before it reaches the LLM — defense-in-depth beyond Zod validation
  const mission = parsed.data.mission.slice(0, 300)

  if (!process.env.ANTHROPIC_API_KEY) {
    log.warn('ANTHROPIC_API_KEY not set — returning empty principles')
    return NextResponse.json({ principles: [] })
  }

  try {
    // AbortController enforces a hard 8s wall-clock limit so we never block the UI.
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const message = await client.messages.create(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Mission: "${mission}"`,
          },
        ],
      },
      { signal: controller.signal }
    )

    clearTimeout(timeout)

    const raw = message.content[0]?.type === 'text' ? message.content[0].text : ''
    // Haiku sometimes wraps output in ```json ... ``` fences — strip them
    const cleaned = raw
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim()

    let parsed: { principles?: unknown }
    try {
      parsed = JSON.parse(cleaned) as { principles?: unknown }
    } catch {
      log.warn({ raw }, 'Claude returned non-JSON — falling back to empty')
      return NextResponse.json({ principles: [] })
    }

    if (!Array.isArray(parsed.principles)) {
      return NextResponse.json({ principles: [] })
    }

    const principles = sanitize(parsed.principles as string[])
    log.info(
      { missionLength: mission.length, principleCount: principles.length },
      'generated principles'
    )
    return NextResponse.json({ principles })
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      log.warn('Claude call timed out after 8s')
    } else {
      log.error({ err }, 'Claude call failed')
    }
    // Graceful degradation — client falls back to static seeds
    return NextResponse.json({ principles: [] })
  }
}
