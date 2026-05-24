import type { SupabaseClient } from '@supabase/supabase-js'
import { EXPERIENCE_CONFIG } from '@/config/experience'

export type VisionItem = {
  mission: string
  missionHue: number
  valuesHue: number
  countryCode: string | null
  principles: string[]
}

// Deterministic hue from a principle string (for custom or unknown principles).
function hashHue(s: string): number {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return h % 360
}

const PRINCIPLE_HUES: Record<string, number> = {
  'Care precedes transaction': 30,
  'Repair over perfection': 15,
  'Curiosity over certainty': 55,
  'Presence as practice': 170,
  'Long-term thinking': 220,
  Interdependence: 130,
  'Truth-telling as kindness': 280,
  'Local action': 320,
}

export function deriveValuesHue(principles: string[]): number {
  if (!principles || principles.length === 0) return 45
  const hues = principles.map((p) => PRINCIPLE_HUES[p] ?? hashHue(p))
  const sin = hues.reduce((s, h) => s + Math.sin((h * Math.PI) / 180), 0)
  const cos = hues.reduce((s, h) => s + Math.cos((h * Math.PI) / 180), 0)
  return Math.round(((Math.atan2(sin, cos) * 180) / Math.PI + 360) % 360)
}

export async function getEarthFill(supabase: SupabaseClient): Promise<number> {
  const total = await getTotalContributions(supabase)
  return Math.min(1, total / EXPERIENCE_CONFIG.maxEarthFillContributions)
}

export async function getRecentVisions(
  supabase: SupabaseClient,
  limit: number = EXPERIENCE_CONFIG.voices.sampleSize
): Promise<VisionItem[]> {
  const { data } = await supabase
    .from('contributions')
    .select('mission, hue, principles, country_code')
    .order('created_at', { ascending: false })
    .limit(limit * 5)

  const pool = (data ?? []).map((r) => ({
    mission: r.mission as string,
    missionHue: (r.hue as number | null) ?? 45,
    valuesHue: deriveValuesHue((r.principles as string[]) ?? []),
    countryCode: (r.country_code as string | null) ?? null,
    principles: (r.principles as string[]) ?? [],
  }))

  return pool.sort(() => Math.random() - 0.5).slice(0, limit)
}

export async function getTotalContributions(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase.from('contribution_stats').select('total').eq('id', 1).single()
  const cached = (data?.total as number) ?? 0
  if (cached > 0) return cached
  // Fallback: direct count when the stats cache hasn't been populated
  const { count } = await supabase.from('contributions').select('*', { count: 'exact', head: true })
  return count ?? 0
}

export async function getCountryCount(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase
    .from('contributions')
    .select('country_code')
    .not('country_code', 'is', null)
  const unique = new Set((data ?? []).map((r) => r.country_code as string))
  return unique.size
}
