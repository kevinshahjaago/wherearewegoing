import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, DM_Sans } from 'next/font/google'
import Script from 'next/script'
import PrivacyBanner from '@/components/PrivacyBanner'
import './globals.css'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['200', '300'],
  variable: '--font-dm-sans',
  display: 'swap',
})

// viewport-fit=cover lets env(safe-area-inset-*) work on notched iPhones
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'Where Are We Going?',
  description: 'A living question answered by everyone who has ever asked it.',
  openGraph: {
    title: 'Where Are We Going?',
    description: 'A living question answered by everyone who has ever asked it.',
    url: 'https://wherearewegoing.earth',
    siteName: 'wherearewegoing.earth',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${dmSans.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <a href="#main-content" className="sr-only">
          Skip to content
        </a>
        <main id="main-content">{children}</main>
        <PrivacyBanner />
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
          <Script
            src="https://plausible.io/js/script.js"
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  )
}
