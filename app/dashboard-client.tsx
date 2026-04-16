'use client'

import { useWatchlist, useGlobalData, useFearGreed } from '@/hooks/useCoinData'
import CoinCard from '@/components/ui/CoinCard'
import FearGreedGauge from '@/components/ui/FearGreedGauge'
import Link from 'next/link'

function fmt(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  return `$${n.toLocaleString()}`
}

function MarketSummaryStrip() {
  const { data: global, isLoading: glLoading } = useGlobalData()
  const { data: fg, isLoading: fgLoading } = useFearGreed()

  const fgValue = fg?.data?.[0] ? parseInt(fg.data[0].value) : null
  const fgClass = fg?.data?.[0]?.value_classification ?? ''
  const totalMcap = global?.data?.total_market_cap?.usd
  const btcDom = global?.data?.market_cap_percentage?.btc
  const mcapChange = global?.data?.market_cap_change_percentage_24h_usd

  return (
    <div className="card flex flex-wrap items-center gap-6 overflow-x-auto">
      {/* Fear & Greed */}
      {fgLoading ? (
        <div className="skeleton h-16 w-28 rounded" />
      ) : fgValue !== null ? (
        <FearGreedGauge value={fgValue} classification={fgClass} />
      ) : null}

      {/* Divider */}
      <div className="hidden sm:block w-px h-12 bg-surface-border" />

      {/* Market stats */}
      {glLoading ? (
        <div className="flex gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-10 w-28 rounded" />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-6 text-sm">
          {totalMcap && (
            <div>
              <div className="text-gray-500 text-xs mb-0.5">Total Market Cap</div>
              <div className="font-mono font-semibold text-gray-100">{fmt(totalMcap)}</div>
              {mcapChange != null && (
                <div className={`text-xs font-mono mt-0.5 ${mcapChange >= 0 ? 'text-bull' : 'text-bear'}`}>
                  {mcapChange >= 0 ? '▲' : '▼'} {Math.abs(mcapChange).toFixed(2)}% 24h
                </div>
              )}
            </div>
          )}
          {btcDom != null && (
            <div>
              <div className="text-gray-500 text-xs mb-0.5">BTC Dominance</div>
              <div className="font-mono font-semibold text-gray-100">{btcDom.toFixed(1)}%</div>
            </div>
          )}
        </div>
      )}

      <div className="ml-auto text-xs text-gray-600 hidden sm:block">Auto-refresh 60s</div>
    </div>
  )
}

function WatchlistGrid() {
  const DEFAULT_IDS = ['bitcoin', 'ethereum', 'solana', 'binancecoin', 'cardano']
  const { data: coins, isLoading, isError, refetch } = useWatchlist(DEFAULT_IDS)

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-40 rounded-xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-400 mb-4">Failed to load watchlist data.</p>
        <button onClick={() => refetch()} className="btn-primary">Retry</button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {coins?.map((coin) => <CoinCard key={coin.id} coin={coin} />)}
    </div>
  )
}

function TopMovers() {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-300">Quick Access</h2>
        <Link href="/alerts" className="text-xs text-blue-400 hover:text-blue-300">
          Manage Alerts →
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'LINK', 'DOT'].map((sym) => (
          <Link
            key={sym}
            href={`/coin/${sym.toLowerCase()}`}
            className="px-3 py-1.5 rounded-lg bg-surface-muted hover:bg-blue-600/20 hover:text-blue-300 text-xs font-mono text-gray-400 transition-colors"
          >
            {sym}
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function DashboardClient() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">
          Market Overview
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Real-time crypto intelligence — powered by Binance & CoinGecko
        </p>
      </div>

      {/* Market summary */}
      <MarketSummaryStrip />

      {/* Watchlist */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-200">Watchlist</h2>
        </div>
        <WatchlistGrid />
      </div>

      {/* Quick access */}
      <TopMovers />
    </div>
  )
}
