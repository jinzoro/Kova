'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'

interface NewsArticle {
  id: string
  title: string
  url: string
  source: string
  publishedAt: string
  thumbnail: string | null
  tags: string[]
  body: string
  sentiment?: { score: number; label: 'Bullish' | 'Bearish' | 'Neutral' }
}

const TAGS = ['All', 'Bitcoin', 'Ethereum', 'DeFi', 'NFT', 'Regulation']
const TAG_PARAM: Record<string, string> = {
  Bitcoin: 'BTC',
  Ethereum: 'ETH',
  DeFi: 'DEFI',
  NFT: 'NFT',
  Regulation: 'REGULATION',
}

async function fetchNews(tag: string): Promise<NewsArticle[]> {
  const categories = tag !== 'All' && TAG_PARAM[tag] ? TAG_PARAM[tag] : 'BTC,ETH,DEFI'

  // Call our internal server-side proxy — keeps the API key out of the browser
  // and avoids any CORS / build-time env-var issues.
  const res = await fetch(`/api/news?categories=${categories}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `News fetch failed (${res.status})`)
  }
  const json = await res.json()
  return json.articles ?? []
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor(diff / 60000)
  if (h > 24) return `${Math.floor(h / 24)}d ago`
  if (h >= 1) return `${h}h ago`
  return `${m}m ago`
}

function NewsCard({ article }: { article: NewsArticle }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="card flex gap-3 hover:border-blue-500/50 transition-all duration-200 hover:scale-[1.005] group"
    >
      {article.thumbnail && (
        <div className="shrink-0 relative w-20 h-20 rounded-lg overflow-hidden bg-surface-muted">
          <Image
            src={article.thumbnail}
            alt={article.title}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-gray-100 line-clamp-2 group-hover:text-blue-300 transition-colors">
          {article.title}
        </h3>
        {article.body && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{article.body}</p>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="text-xs text-gray-500">{article.source}</span>
          <span className="text-gray-600 text-xs">·</span>
          <span className="text-xs text-gray-600">{timeAgo(article.publishedAt)}</span>
          {article.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-surface-muted text-gray-500 font-mono">
              {tag}
            </span>
          ))}
          {article.sentiment && article.sentiment.label !== 'Neutral' && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
              article.sentiment.label === 'Bullish'
                ? 'bg-green-500/10 text-bull'
                : 'bg-red-500/10 text-bear'
            }`}>
              {article.sentiment.label}
            </span>
          )}
        </div>
      </div>
    </a>
  )
}

function NewsCardSkeleton() {
  return (
    <div className="card flex gap-3 animate-pulse">
      <div className="skeleton w-20 h-20 rounded-lg shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
      </div>
    </div>
  )
}

export default function NewsClient() {
  const [activeTag, setActiveTag] = useState('All')

  const { data: articles, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['news', activeTag],
    queryFn: () => fetchNews(activeTag),
    refetchInterval: 3_600_000,
    staleTime: 1_800_000,
    retry: 2,
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Crypto News</h1>
          <p className="text-sm text-gray-500 mt-1">
            Powered by CryptoCompare — auto-refreshes hourly
          </p>
        </div>
        <button onClick={() => refetch()} className="btn-ghost text-xs">↻ Refresh</button>
      </div>

      {/* Tag filters */}
      <div className="flex flex-wrap gap-2">
        {TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => setActiveTag(tag)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeTag === tag
                ? 'bg-blue-600 text-white'
                : 'bg-surface-muted text-gray-400 hover:text-gray-100'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {isError && (
        <div className="card text-center py-12 space-y-3">
          <p className="text-gray-300 font-medium">Failed to load news</p>
          <p className="text-xs text-gray-500 font-mono bg-surface-muted rounded px-3 py-2 inline-block">
            {(error as Error)?.message ?? 'Unknown error'}
          </p>
          <p className="text-xs text-gray-600">
            Make sure <code className="text-blue-400">NEWS_API_KEY</code> is set in <code className="text-blue-400">.env.local</code>
          </p>
          <button onClick={() => refetch()} className="btn-primary mt-2">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoading
          ? Array.from({ length: 10 }).map((_, i) => <NewsCardSkeleton key={i} />)
          : articles?.map((article) => <NewsCard key={article.id} article={article} />)}
      </div>

      {!isLoading && !isError && articles?.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-gray-500">No articles found for this category.</p>
        </div>
      )}
    </div>
  )
}
