import type { SupabaseClient } from '@supabase/supabase-js'
import { EXPERIENCE_CONFIG } from '@/config/experience'

export async function saveContribution(
  supabase: SupabaseClient,
  {
    visitorId,
    mission,
    principles,
    commitment,
    geolocation,
    countryCode,
  }: {
    visitorId: string
    mission: string
    principles: string[]
    commitment?: string
    geolocation?: { lat: number; lng: number }
    countryCode?: string
  }
): Promise<void> {
  const { error } = await supabase.from('contributions').insert({
    visitor_id: visitorId,
    mission,
    principles,
    commitment: commitment ?? null,
    geolocation: geolocation ?? null,
    country_code: countryCode ?? null,
    config_version: EXPERIENCE_CONFIG.version,
  })
  if (error) throw new Error(error.message)
}
