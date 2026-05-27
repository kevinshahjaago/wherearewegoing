import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'

export type Theme = { label: string; count: number }

const SYSTEM_PROMPT = `You analyze values and principles that people believe in.
Group them into exactly 5 themes. Write each theme name so a 9-year-old can understand it — use short, everyday words (e.g. "Caring for each other", "Protecting nature", "Being honest").
Return ONLY valid JSON with no explanation: {"themes":[{"label":"...","count":N},...]}
Order by count descending. Always return exactly 5 themes.`

export async function getTopThemes(
  supabase: SupabaseClient,
  anthropic: Anthropic
): Promise<Theme[]> {
  const { data } = await supabase
    .from('contributions')
    .select('principles')
    .not('principles', 'eq', '{}')
    .order('created_at', { ascending: false })
    .limit(300)

  const allPrinciples = (data ?? [])
    .flatMap((r) => (r.principles as string[] | null) ?? [])
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)

  if (allPrinciples.length === 0) return []

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)

  try {
    const message = await anthropic.messages.create(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: allPrinciples.join('\n') }],
      },
      { signal: controller.signal }
    )

    clearTimeout(timeout)

    const raw = message.content[0]?.type === 'text' ? message.content[0].text : ''
    const cleaned = raw
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim()
    const parsed = JSON.parse(cleaned) as { themes?: unknown }

    if (!Array.isArray(parsed.themes)) return []
    return (parsed.themes as Theme[])
      .filter((t) => typeof t.label === 'string' && typeof t.count === 'number')
      .slice(0, 5)
  } catch {
    clearTimeout(timeout)
    return []
  }
}
