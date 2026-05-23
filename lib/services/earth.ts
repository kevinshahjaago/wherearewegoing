import type { SupabaseClient } from '@supabase/supabase-js'
import { EXPERIENCE_CONFIG } from '@/config/experience'

export async function getEarthFill(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase.from('contribution_stats').select('total').eq('id', 1).single()
  const total = (data?.total as number) ?? 0
  return Math.min(1, total / EXPERIENCE_CONFIG.maxEarthFillContributions)
}

export async function getRecentVoices(
  supabase: SupabaseClient,
  limit = EXPERIENCE_CONFIG.voices.sampleSize
): Promise<string[]> {
  // Fetch a larger pool ordered by recency, then shuffle in JS.
  // Avoids ORDER BY RANDOM() full-scan on large tables while still feeling fresh.
  const { data } = await supabase
    .from('contributions')
    .select('mission')
    .order('created_at', { ascending: false })
    .limit(limit * 5)
  const pool = (data ?? []).map((r) => `"${r.mission as string}"`)
  return pool.sort(() => Math.random() - 0.5).slice(0, limit)
}

export async function getTotalContributions(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase.from('contribution_stats').select('total').eq('id', 1).single()
  return (data?.total as number) ?? 0
}
