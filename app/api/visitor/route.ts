import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requestLogger } from '@/lib/logger'
import { VisitorUpsertSchema } from '@/lib/schemas/visitor'
import { upsertVisitor } from '@/lib/services/visitor'
import { randomUUID } from 'crypto'

export async function POST(request: Request) {
  const requestId = randomUUID()
  const log = requestLogger(requestId, 'api/visitor')

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = VisitorUpsertSchema.safeParse(body)
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
    const result = await upsertVisitor(supabase, {
      userId: user.id,
      fingerprint: parsed.data.fingerprint,
      countryCode: parsed.data.countryCode,
      geolocation: parsed.data.geolocation,
    })
    log.info({ userId: user.id, isReturn: result.isReturn }, 'Visitor upserted')
    return NextResponse.json(result)
  } catch (err) {
    log.error({ err }, 'Failed to upsert visitor')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
