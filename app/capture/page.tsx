import { notFound } from 'next/navigation'
import CaptureCanvas from './_canvas'

// Only accessible in development or when ENABLE_CAPTURE_PAGE=true is set.
// This prevents the /capture route from being a publicly accessible page in production.
export default function CapturePage() {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_CAPTURE_PAGE !== 'true') {
    notFound()
  }
  return <CaptureCanvas />
}
