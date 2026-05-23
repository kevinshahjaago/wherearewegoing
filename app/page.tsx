import { createClient } from '@/lib/supabase/server'
import { getEarthFill, getTotalContributions } from '@/lib/services/earth'
import Journey from '@/components/Journey'

export default async function Home() {
  let earthFill = 0
  let totalContributions = 0
  try {
    const supabase = await createClient()
    ;[earthFill, totalContributions] = await Promise.all([
      getEarthFill(supabase),
      getTotalContributions(supabase),
    ])
  } catch {
    // Supabase unavailable — canvas starts with an empty earth
  }
  return <Journey earthFill={earthFill} totalContributions={totalContributions} />
}
