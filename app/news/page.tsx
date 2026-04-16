import { Metadata } from 'next'
import NewsClient from './news-client'

export const metadata: Metadata = { title: 'Crypto News' }

export default function NewsPage() {
  return <NewsClient />
}
