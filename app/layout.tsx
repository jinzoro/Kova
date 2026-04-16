import type { Metadata, Viewport } from 'next'
import { Toaster } from 'react-hot-toast'
import Navbar from '@/components/layout/Navbar'
import Providers from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Kova — Crypto Intelligence', template: '%s | Kova' },
  description: 'Professional crypto trading intelligence platform with real-time charts, technical analysis, and signal scoring.',
}

export const viewport: Viewport = {
  themeColor: '#0f1117',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-surface text-gray-100">
        <Providers>
          <Navbar />
          <main className="max-w-screen-xl mx-auto px-4 py-6">
            {children}
          </main>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#1a1d27',
                color: '#e5e7eb',
                border: '1px solid #2a2d3a',
                borderRadius: '12px',
                fontSize: '14px',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
