import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requestLogger } from '@/lib/logger'
import { ContributeSchema } from '@/lib/schemas/contribution'
import { saveContribution } from '@/lib/services/contribution'
import { trackServer } from '@/lib/analytics/server'
import { randomUUID } from 'crypto'

export async function POST(request: Request) {
  const requestId = randomUUID()
  const log = requestLogger(requestId, 'api/contribute')

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ContributeSchema.safeParse(body)
  if (!parsed.success) {
    log.warn({ issues: parsed.error.issues }, 'Validation failed')
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 }
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await saveContribution(supabase, {
      visitorId: user.id,
      mission: parsed.data.mission,
      principles: parsed.data.principles,
      commitment: parsed.data.commitment,
      geolocation: parsed.data.geolocation,
    })
    log.info({ userId: user.id }, 'Contribution saved')

    // Fire server-side analytics so the event reaches Plausible even if JS is blocked.
    // Run without await — analytics must not delay the response.
    void trackServer(
      parsed.data.isReturn ? 'return_contribution_submitted' : 'journey_completed',
      {
        config_version: String(parsed.data.configVersion),
        has_geolocation: String(!!parsed.data.geolocation),
      },
      request
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    log.error({ err }, 'Failed to save contribution')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
