import { NextRequest, NextResponse } from 'next/server'
import { scoreSentiment } from '@/lib/sentiment'

export const runtime = 'nodejs'
export const revalidate = 1800  // 30 min cache

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const categories = searchParams.get('categories') ?? 'BTC,ETH,DEFI'
  const apiKey = process.env.NEWS_API_KEY  // server-side only — no NEXT_PUBLIC_ needed

  const url = new URL('https://min-api.cryptocompare.com/data/v2/news/')
  url.searchParams.set('categories', categories)
  url.searchParams.set('lang', 'EN')
  url.searchParams.set('sortOrder', 'popular')
  if (apiKey) url.searchParams.set('api_key', apiKey)

  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'Kova/1.0' },
      next: { revalidate: 1800 },
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[news] CryptoCompare error', res.status, text)
      return NextResponse.json({ error: `upstream ${res.status}`, detail: text }, { status: res.status })
    }

    const json = await res.json()

    // CryptoCompare wraps data in `Data` (capital D)
    if (json.Response === 'Error') {
      console.error('[news] CryptoCompare API error:', json.Message)
      return NextResponse.json({ error: json.Message }, { status: 400 })
    }

    const articles = (json.Data ?? []).slice(0, 30).map((a: {
      id: string
      title: string
      url: string
      source_info?: { name?: string }
      published_on: number
      imageurl?: string
      categories: string
      body: string
    }) => {
      const sentiment = scoreSentiment(`${a.title} ${a.body ?? ''}`)
      return {
        id: String(a.id),
        title: a.title,
        url: a.url,
        source: a.source_info?.name ?? 'Unknown',
        publishedAt: new Date(a.published_on * 1000).toISOString(),
        thumbnail: a.imageurl || null,
        tags: a.categories.split('|').filter(Boolean),
        body: a.body?.slice(0, 250) ?? '',
        sentiment: { score: sentiment.score, label: sentiment.label },
      }
    })

    return NextResponse.json({ articles })
  } catch (err) {
    console.error('[news] fetch failed', err)
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 })
  }
}
