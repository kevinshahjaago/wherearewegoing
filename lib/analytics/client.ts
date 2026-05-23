// Augment window so TypeScript knows about the Plausible global
declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string> }) => void
  }
}

export function track(event: string, props?: Record<string, string>): void {
  if (typeof window === 'undefined') return
  window.plausible?.(event, props ? { props } : undefined)
}
