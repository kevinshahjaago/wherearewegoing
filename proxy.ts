import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ── Rate limiting ──────────────────────────────────────────────────────────────
// Sliding-window counters keyed by "path:ip". Effective within a single warm
// Vercel Function instance; pairs with Supabase anon-auth on /api/contribute
// for defense-in-depth against LLM token exhaustion.

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/contribute': {
    max: parseInt(process.env.RATE_LIMIT_CONTRIBUTE_RPM ?? '5'),
    windowMs: 60_000,
  },
  '/api/first-principles': {
    max: parseInt(process.env.RATE_LIMIT_FP_RPM ?? '10'),
    windowMs: 60_000,
  },
}

const windows = new Map<string, number[]>()

function isRateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const recent = (windows.get(key) ?? []).filter((t) => now - t < windowMs)
  recent.push(now)
  windows.set(key, recent)
  // Sweep stale entries when the map grows large to prevent memory leaks
  if (windows.size > 5_000) {
    for (const [k, times] of windows) {
      if (times.every((t) => now - t >= windowMs)) windows.delete(k)
    }
  }
  return recent.length > max
}

// ── Proxy (Next.js 16 middleware) ──────────────────────────────────────────────
// Runs on every request: enforces rate limits on LLM routes, then refreshes
// the Supabase session so the JWT never expires mid-journey.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const limit = RATE_LIMITS[pathname]

  if (limit) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'

    if (isRateLimited(`${pathname}:${ip}`, limit.max, limit.windowMs)) {
      return NextResponse.json({ error: 'Too many requests — slow down.' }, { status: 429 })
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Skip session refresh if Supabase is not configured (local dev without .env.local)
  if (!url || !key) return NextResponse.next({ request })

  let response = NextResponse.next({ request })

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options ?? {})
        )
      },
    },
  })

  // Refresh session so it doesn't expire — do not remove
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)).*)',
  ],
}
