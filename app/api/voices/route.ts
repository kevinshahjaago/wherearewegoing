import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requestLogger } from '@/lib/logger'
import {
  getRecentVisions,
  getTotalContributions,
  getCountryCount,
  getPrincipleCount,
} from '@/lib/services/earth'
import { randomUUID } from 'crypto'
import { EXPERIENCE_CONFIG } from '@/config/experience'

export async function GET() {
  const requestId = randomUUID()
  const log = requestLogger(requestId, 'api/voices')

  try {
    const supabase = await createClient()
    const [visions, total, countryCount, principleCount] = await Promise.all([
      getRecentVisions(supabase),
      getTotalContributions(supabase),
      getCountryCount(supabase),
      getPrincipleCount(supabase),
    ])
    log.info({ count: visions.length, total, countryCount, principleCount }, 'Visions fetched')
    return NextResponse.json(
      { visions, totalContributions: total, countryCount, principleCount },
      {
        headers: {
          'Cache-Control': `public, s-maxage=${EXPERIENCE_CONFIG.voices.cacheSeconds}, stale-while-revalidate=60`,
        },
      }
    )
  } catch (err) {
    log.error({ err }, 'Failed to fetch visions')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
