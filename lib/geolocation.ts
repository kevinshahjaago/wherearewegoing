export type GeoResult = {
  lat: number
  lng: number
  countryCode?: string
}

// Tries the browser Geolocation API first. On denial or error, falls back to an
// IP-based service for coarse coordinates + country code.
// Both paths are time-capped — callers should also race against their own timeout.
export async function getGeolocation(): Promise<GeoResult | null> {
  if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 8000,
          maximumAge: 600_000,
        })
      })
      return { lat: pos.coords.latitude, lng: pos.coords.longitude }
    } catch {
      // Permission denied or timed out — fall through to IP fallback
    }
  }

  try {
    const url = process.env.NEXT_PUBLIC_GEO_API_URL ?? 'https://ip-api.com/json'
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const data = (await res.json()) as {
      status?: string
      lat?: number
      lon?: number
      countryCode?: string
    }
    if (data.status === 'success' && data.lat != null && data.lon != null) {
      return { lat: data.lat, lng: data.lon, countryCode: data.countryCode }
    }
  } catch {
    // IP API unavailable
  }

  return null
}
