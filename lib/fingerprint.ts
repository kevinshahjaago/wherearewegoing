// Lightweight browser fingerprint — used to re-correlate returning visitors
// whose localStorage was cleared. Not PII: no names, emails, or IPs stored.
export async function getBrowserFingerprint(): Promise<string> {
  const parts = [
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.platform,
    navigator.hardwareConcurrency ?? 0,
  ].join('|')

  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts))

  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 64)
}
