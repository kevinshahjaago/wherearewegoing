'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

type Props = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#06060e',
          color: 'rgba(237,232,218,0.6)',
          fontFamily: 'sans-serif',
          gap: '1.5rem',
        }}
      >
        <p style={{ margin: 0, fontSize: '0.9rem' }}>Something went wrong.</p>
        <button
          onClick={reset}
          style={{
            background: 'none',
            border: '1px solid rgba(201,168,76,0.3)',
            color: 'rgba(201,168,76,0.8)',
            padding: '0.5rem 1.25rem',
            borderRadius: '2px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            letterSpacing: '0.05em',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
