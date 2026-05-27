import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requestLogger } from '@/lib/logger'
import { getTopThemes } from '@/lib/services/themes'
import { randomUUID } from 'crypto'

const anthropic = new Anthropic()

export async function GET() {
  const requestId = randomUUID()
  const log = requestLogger(requestId, 'api/themes')

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ themes: [] })
  }

  try {
    const supabase = await createClient()
    const themes = await getTopThemes(supabase, anthropic)
    log.info({ count: themes.length }, 'themes computed')
    return NextResponse.json(
      { themes },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
        },
      }
    )
  } catch (err) {
    log.error({ err }, 'Failed to compute themes')
    return NextResponse.json({ themes: [] }, { status: 500 })
  }
}
