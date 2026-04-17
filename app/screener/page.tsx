import { Metadata } from 'next'
import ScreenerClient from './screener-client'

export const metadata: Metadata = { title: 'Signal Screener — Kova' }

export default function ScreenerPage() {
  return <ScreenerClient />
}
