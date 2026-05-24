import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requestLogger } from '@/lib/logger'
import { ContributeSchema } from '@/lib/schemas/contribution'
import { saveContribution } from '@/lib/services/contribution'
import { moderateContribution } from '@/lib/services/moderation'
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

  // Run content moderation pipeline before persisting
  const moderation = await moderateContribution(parsed.data.mission, parsed.data.principles)

  try {
    const { hue } = await saveContribution(supabase, {
      visitorId: user.id,
      mission: moderation.mission,
      principles: moderation.principles,
      commitment: parsed.data.commitment,
      geolocation: parsed.data.geolocation,
    })
    log.info({ userId: user.id, hue, moderationAction: moderation.action }, 'Contribution saved')

    void trackServer(
      parsed.data.isReturn ? 'return_contribution_submitted' : 'journey_completed',
      {
        config_version: String(parsed.data.configVersion),
        has_geolocation: String(!!parsed.data.geolocation),
      },
      request
    )

    // For guard events: respond as success — the heart emoji is the visible result.
    // Never reveal to the client that a guard action occurred.
    if (moderation.action === 'guard') {
      return NextResponse.json({ success: true, hue })
    }

    // For reframe events: include the reframe info so the client can show transparency notice.
    if (moderation.action === 'reframe' && moderation.reframe) {
      return NextResponse.json({
        success: true,
        hue,
        reframe: {
          originalMission: moderation.reframe.originalMission,
          type: moderation.reframe.type,
          explanation: moderation.reframe.explanation,
        },
      })
    }

    return NextResponse.json({ success: true, hue })
  } catch (err) {
    log.error({ err }, 'Failed to save contribution')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
