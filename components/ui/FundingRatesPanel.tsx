'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

interface FundingEntry {
  symbol: string
  fundingRate: number
  markPrice: number
  nextFundingTime: number
}

interface FundingData {
  longs: FundingEntry[]
  shorts: FundingEntry[]
  all: FundingEntry[]
  updatedAt: string
}

function fmtPrice(n: number): string {
  if (n >= 10000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (n >= 1000)  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  if (n >= 1)     return `$${n.toFixed(4)}`
  return `$${n.toFixed(6)}`
}

function fmtRate(r: number): string {
  return `${r >= 0 ? '+' : ''}${(r * 100).toFixed(4)}%`
}

function fmtCountdown(ms: number): string {
  const diff = Math.max(0, ms - Date.now())
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  return `${h}h ${m}m`
}

// Bar width: 0–0.05% funding → 0–100% bar
function rateToWidth(r: number): number {
  return Math.min(100, (Math.abs(r) / 0.0005) * 100)
}

function FundingRow({ entry, side }: { entry: FundingEntry; side: 'long' | 'short' }) {
  const isBull = side === 'long'
  const barColor = isBull ? 'bg-bear' : 'bg-bull'  // positive rate = longs pay shorts (bearish for longs)
  const textColor = isBull ? 'text-bear' : 'text-bull'

  return (
    <Link
      href={`/coin/${entry.symbol.toLowerCase()}`}
      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-muted/60 transition-colors group"
    >
      <span className="font-mono font-bold text-xs text-gray-200 w-12 group-hover:text-blue-300 transition-colors shrink-0">
        {entry.symbol}
      </span>
      <div className="flex-1 h-1.5 bg-surface-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${rateToWidth(entry.fundingRate)}%`, opacity: 0.75 }}
        />
      </div>
      <span className={`font-mono text-xs font-bold w-20 text-right ${textColor}`}>
        {fmtRate(entry.fundingRate)}
      </span>
      <span className="font-mono text-xs text-gray-600 w-20 text-right hidden sm:block">
        {fmtPrice(entry.markPrice)}
      </span>
    </Link>
  )
}

export default function FundingRatesPanel() {
  const [tab, setTab] = useState<'longs' | 'shorts' | 'all'>('longs')

  const { data, isLoading } = useQuery<FundingData>({
    queryKey: ['funding-rates'],
    queryFn: () => fetch('/api/funding-rates').then((r) => r.json()),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  })

  const rows = tab === 'all'
    ? (data?.all ?? []).slice(0, 12)
    : (data?.[tab] ?? [])

  const nextFunding = data?.all?.[0]?.nextFundingTime

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          <h3 className="text-sm font-semibold text-gray-300">Funding Rates</h3>
          <span className="text-xs text-gray-600">perpetual futures</span>
        </div>
        <div className="flex items-center gap-3">
          {nextFunding && (
            <span className="text-xs text-gray-600 font-mono">
              next settlement {fmtCountdown(nextFunding)}
            </span>
          )}
          {/* Tab toggle */}
          <div className="flex rounded-lg overflow-hidden border border-surface-border">
            {(['longs', 'shorts', 'all'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  tab === t
                    ? t === 'longs' ? 'bg-bear/80 text-white'
                    : t === 'shorts' ? 'bg-bull/80 text-white'
                    : 'bg-blue-600 text-white'
                    : 'bg-surface-muted text-gray-400 hover:text-gray-200'
                }`}
              >
                {t === 'longs' ? 'Crowded Longs' : t === 'shorts' ? 'Crowded Shorts' : 'All'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 px-3 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-bear opacity-75" />
          Positive rate = longs pay shorts (bearish signal)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-bull opacity-75" />
          Negative rate = shorts pay longs (bullish signal)
        </span>
      </div>

      {/* Rows */}
      {isLoading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-8 rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-center py-6 text-xs text-gray-500">No data available</p>
      ) : (
        <div className="space-y-0.5">
          {/* Column headers */}
          <div className="flex items-center gap-3 px-3 pb-1 text-xs text-gray-600">
            <span className="w-12 shrink-0">Symbol</span>
            <span className="flex-1">Rate magnitude</span>
            <span className="w-20 text-right">8h Rate</span>
            <span className="w-20 text-right hidden sm:block">Mark Price</span>
          </div>
          {rows.map((entry, i) => (
            <div key={entry.symbol} className="animate-slide-in-left" style={{ animationDelay: `${i * 40}ms` }}>
              <FundingRow entry={entry} side={entry.fundingRate >= 0 ? 'long' : 'short'} />
            </div>
          ))}
        </div>
      )}

      {/* Explainer */}
      <p className="mt-3 text-xs text-gray-700 border-t border-surface-border pt-2">
        High positive funding = market is over-leveraged long → potential squeeze. Negative = crowded shorts → potential rally.
        Refreshes every 5 min.
      </p>
    </div>
  )
}
