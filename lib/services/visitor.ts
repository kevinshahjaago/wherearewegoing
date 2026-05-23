import type { SupabaseClient } from '@supabase/supabase-js'

export type Delta = {
  newVoices: number
  trendingPrinciple: string | null
  newCountries: string[]
}

export type UpsertResult = {
  isReturn: boolean
  delta: Delta | null
  visitCount: number
}

async function computeDelta(supabase: SupabaseClient, since: string): Promise<Delta> {
  const [countRes, countriesRes, principlesRes] = await Promise.all([
    supabase
      .from('contributions')
      .select('*', { count: 'exact', head: true })
      .gt('created_at', since),
    supabase
      .from('contributions')
      .select('country_code')
      .gt('created_at', since)
      .not('country_code', 'is', null),
    supabase.from('contributions').select('principles').gt('created_at', since),
  ])

  const newCountries = [
    ...new Set((countriesRes.data ?? []).map((r) => r.country_code as string).filter(Boolean)),
  ]

  const counts: Record<string, number> = {}
  for (const row of principlesRes.data ?? []) {
    for (const p of (row.principles as string[]) ?? []) {
      counts[p] = (counts[p] ?? 0) + 1
    }
  }
  const trendingPrinciple = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return { newVoices: countRes.count ?? 0, trendingPrinciple, newCountries }
}

export async function upsertVisitor(
  supabase: SupabaseClient,
  {
    userId,
    fingerprint,
    countryCode,
    geolocation,
  }: {
    userId: string
    fingerprint: string
    countryCode?: string
    geolocation?: { lat: number; lng: number }
  }
): Promise<UpsertResult> {
  // Primary lookup: auth UUID (covers returning visitors with intact localStorage)
  const { data: existing } = await supabase
    .from('visitors')
    .select('last_seen_at, visit_count')
    .eq('id', userId)
    .maybeSingle()

  if (existing) {
    const delta = await computeDelta(supabase, existing.last_seen_at as string)
    const visitCount = (existing.visit_count as number) + 1
    await supabase
      .from('visitors')
      .update({
        last_seen_at: new Date().toISOString(),
        visit_count: visitCount,
        fingerprint,
        ...(countryCode ? { country_code: countryCode } : {}),
        ...(geolocation ? { geolocation } : {}),
      })
      .eq('id', userId)
    return { isReturn: true, delta, visitCount }
  }

  // Fingerprint fallback: localStorage was cleared but same device
  let priorLastSeen: string | null = null
  const { data: prior } = await supabase
    .from('visitors')
    .select('last_seen_at')
    .eq('fingerprint', fingerprint)
    .maybeSingle()
  if (prior) priorLastSeen = prior.last_seen_at as string

  // Insert fresh visitor row for this auth session
  await supabase.from('visitors').insert({
    id: userId,
    fingerprint,
    country_code: countryCode ?? null,
    geolocation: geolocation ?? null,
  })

  if (priorLastSeen) {
    const delta = await computeDelta(supabase, priorLastSeen)
    return { isReturn: true, delta, visitCount: 1 }
  }

  return { isReturn: false, delta: null, visitCount: 1 }
}
