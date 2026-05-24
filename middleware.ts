import { NextRequest, NextResponse } from 'next/server'

const LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/contribute': {
    max: parseInt(process.env.RATE_LIMIT_CONTRIBUTE_RPM ?? '5'),
    windowMs: 60_000,
  },
  '/api/first-principles': {
    max: parseInt(process.env.RATE_LIMIT_FP_RPM ?? '10'),
    windowMs: 60_000,
  },
}

// Sliding window hit log keyed by "path:ip".
// Effective within a single warm Vercel Function instance; pairs with
// Supabase anon-auth on /api/contribute for defense-in-depth.
const windows = new Map<string, number[]>()

function isRateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const recent = (windows.get(key) ?? []).filter((t) => now - t < windowMs)
  recent.push(now)
  windows.set(key, recent)

  // Prevent unbounded Map growth: if over 5 000 distinct keys, sweep stale entries
  if (windows.size > 5_000) {
    for (const [k, times] of windows) {
      if (times.every((t) => now - t >= windowMs)) windows.delete(k)
    }
  }

  return recent.length > max
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const limit = LIMITS[pathname]
  if (!limit) return NextResponse.next()

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'

  if (isRateLimited(`${pathname}:${ip}`, limit.max, limit.windowMs)) {
    return NextResponse.json({ error: 'Too many requests — slow down.' }, { status: 429 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/contribute', '/api/first-principles'],
}
