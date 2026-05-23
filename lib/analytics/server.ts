// Server-side Plausible event emission via the ingest API.
// Sent from API routes so ad blockers cannot prevent core funnel events.
export async function trackServer(
  event: string,
  props: Record<string, string>,
  request: Request
): Promise<void> {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN
  if (!domain) return

  const url = `https://${domain}/`
  const userAgent = request.headers.get('user-agent') ?? ''
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''

  try {
    await fetch('https://plausible.io/api/event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
        'X-Forwarded-For': ip,
      },
      body: JSON.stringify({ domain, name: event, url, props }),
    })
  } catch {
    // Analytics failure must never affect the main response
  }
}
