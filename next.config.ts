import { withSentryConfig } from '@sentry/nextjs'
import type { NextConfig } from 'next'

// Only set HSTS in production — setting it on localhost breaks local HTTPS tooling
const isProd = process.env.NODE_ENV === 'production'

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    // geolocation omitted — browser prompt triggered in JS after submit
    value: 'camera=(), microphone=()',
  },
  // 2-year HSTS — omit `preload` until the domain is stable and you're ready to
  // submit it to browser preload lists (hard to undo once submitted)
  ...(isProd
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
    : []),
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://plausible.io",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      // Sentry events are tunnelled through /monitoring (same-origin), so
      // *.ingest.sentry.io only needed as fallback when tunnelRoute isn't active.
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://ip-api.com https://plausible.io https://*.ingest.sentry.io",
      "img-src 'self' data:",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
  async redirects() {
    return [
      // Canonicalize www → apex. Vercel also does this in the dashboard but
      // having it here means it works in self-hosted / preview environments too.
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.wherearewegoing.earth' }],
        destination: 'https://wherearewegoing.earth/:path*',
        permanent: true,
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  // Suppress Sentry CLI output except in CI where it's useful
  silent: !process.env.CI,
  // Proxy Sentry requests through /monitoring to bypass ad blockers
  tunnelRoute: '/monitoring',
  // Don't upload/expose source maps (no SENTRY_ORG/PROJECT configured at build time)
  sourcemaps: { disable: true },
  // Tree-shake Sentry debug logger out of the client bundle
  disableLogger: true,
})
