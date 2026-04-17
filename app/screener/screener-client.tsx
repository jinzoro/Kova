'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'

interface ScreenerCoin {
  symbol: string
  price: number
  change24h: number
  volume24h: number
  signal: number
  label: string
  rsi: number | null
  pattern: { name: string; type: string } | null
}

function fmtPrice(n: number): string {
  if (n >= 10000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (n >= 1000)  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  if (n >= 1)     return `$${n.toFixed(4)}`
  return `$${n.toFixed(6)}`
}

function fmt(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return `$${n.toLocaleString()}`
}

function signalColor(score: number): string {
  if (score >= 6) return 'text-bull bg-green-500/10 border-green-500/30'
  if (score >= 2) return 'text-green-400 bg-green-500/8 border-green-500/20'
  if (score > -2) return 'text-warn bg-amber-500/10 border-amber-500/30'
  if (score > -6) return 'text-orange-400 bg-orange-500/8 border-orange-500/20'
  return 'text-bear bg-red-500/10 border-red-500/30'
}

function rsiColor(rsi: number): string {
  if (rsi > 70) return 'text-bear'
  if (rsi < 30) return 'text-bull'
  return 'text-gray-300'
}

export default function ScreenerClient() {
  const [minSignal, setMinSignal] = useState(-10)
  const [maxSignal, setMaxSignal] = useState(10)
  const [pattern, setPattern] = useState<'all' | 'bullish' | 'bearish'>('all')
  const [sortBy, setSortBy] = useState<'signal' | 'change24h' | 'volume24h' | 'rsi'>('signal')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  const { data, isLoading, isError, refetch, dataUpdatedAt } = useQuery<{ coins: ScreenerCoin[]; updatedAt: string }>({
    queryKey: ['screener'],
    queryFn: async () => {
      const res = await fetch('/api/screener')
      if (!res.ok) throw new Error('Screener fetch failed')
      return res.json()
    },
    staleTime: 300_000,
    refetchInterval: 300_000,
  })

  const filtered = (data?.coins ?? [])
    .filter((c) => c.signal >= minSignal && c.signal <= maxSignal)
    .filter((c) => pattern === 'all' || (c.pattern?.type === pattern))
    .sort((a, b) => {
      const aVal = sortBy === 'rsi' ? (a.rsi ?? 50) : a[sortBy]
      const bVal = sortBy === 'rsi' ? (b.rsi ?? 50) : b[sortBy]
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal
    })

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir((d) => d === 'desc' ? 'asc' : 'desc')
    else { setSortBy(col); setSortDir('desc') }
  }

  function SortIcon({ col }: { col: typeof sortBy }) {
    if (sortBy !== col) return <span className="text-gray-700 ml-1">↕</span>
    return <span className="text-blue-400 ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Signal Screener</h1>
          <p className="text-sm text-gray-500 mt-1">
            Top 25 coins by volume — live signal scores from 1h klines
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-gray-600">
              Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
            </span>
          )}
          <button onClick={() => refetch()} className="btn-ghost text-xs">↻ Refresh</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-gray-300">Filters</h2>
        <div className="flex flex-wrap gap-6 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Min Signal Score</label>
            <div className="flex items-center gap-2">
              <input
                type="range" min={-10} max={10} step={1} value={minSignal}
                onChange={(e) => setMinSignal(Number(e.target.value))}
                className="w-32"
              />
              <span className={`font-mono text-sm font-bold w-8 text-center ${minSignal > 0 ? 'text-bull' : minSignal < 0 ? 'text-bear' : 'text-gray-300'}`}>
                {minSignal > 0 ? '+' : ''}{minSignal}
              </span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Max Signal Score</label>
            <div className="flex items-center gap-2">
              <input
                type="range" min={-10} max={10} step={1} value={maxSignal}
                onChange={(e) => setMaxSignal(Number(e.target.value))}
                className="w-32"
              />
              <span className={`font-mono text-sm font-bold w-8 text-center ${maxSignal > 0 ? 'text-bull' : maxSignal < 0 ? 'text-bear' : 'text-gray-300'}`}>
                {maxSignal > 0 ? '+' : ''}{maxSignal}
              </span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Pattern Type</label>
            <div className="flex gap-1">
              {(['all', 'bullish', 'bearish'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPattern(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                    pattern === p ? 'bg-blue-600 text-white' : 'bg-surface-muted text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="ml-auto text-xs text-gray-500">
            {filtered.length} coins
          </div>
        </div>

        {/* Quick presets */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Strong Buy', min: 6, max: 10 },
            { label: 'Buy Zone', min: 2, max: 10 },
            { label: 'Oversold', min: -10, max: -4 },
            { label: 'All', min: -10, max: 10 },
          ].map(({ label, min, max }) => (
            <button
              key={label}
              onClick={() => { setMinSignal(min); setMaxSignal(max) }}
              className="px-3 py-1 rounded-lg text-xs bg-surface-muted text-gray-400 hover:text-gray-200 hover:bg-blue-600/20 transition-colors border border-transparent hover:border-blue-500/30"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isError ? (
        <div className="card text-center py-12">
          <p className="text-gray-400 mb-4">Failed to load screener data.</p>
          <button onClick={() => refetch()} className="btn-primary">Retry</button>
        </div>
      ) : isLoading ? (
        <div className="card space-y-3 animate-pulse">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="skeleton h-12 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-surface-border">
                <th className="text-left py-3 pr-4 font-medium">Coin</th>
                <th className="text-right py-3 px-3 font-medium">Price</th>
                <th className="text-right py-3 px-3 font-medium cursor-pointer select-none hover:text-gray-300" onClick={() => toggleSort('change24h')}>
                  24h <SortIcon col="change24h" />
                </th>
                <th className="text-right py-3 px-3 font-medium cursor-pointer select-none hover:text-gray-300" onClick={() => toggleSort('volume24h')}>
                  Volume <SortIcon col="volume24h" />
                </th>
                <th className="text-right py-3 px-3 font-medium cursor-pointer select-none hover:text-gray-300" onClick={() => toggleSort('rsi')}>
                  RSI <SortIcon col="rsi" />
                </th>
                <th className="text-center py-3 px-3 font-medium cursor-pointer select-none hover:text-gray-300" onClick={() => toggleSort('signal')}>
                  Signal <SortIcon col="signal" />
                </th>
                <th className="text-left py-3 pl-3 font-medium">Pattern</th>
                <th className="py-3 pl-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/50">
              {filtered.map((coin) => (
                <tr key={coin.symbol} className="hover:bg-surface-muted/40 transition-colors">
                  <td className="py-3 pr-4">
                    <span className="font-mono font-bold text-gray-100">{coin.symbol}</span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-gray-300">{fmtPrice(coin.price)}</td>
                  <td className={`py-3 px-3 text-right font-mono font-semibold ${coin.change24h >= 0 ? 'text-bull' : 'text-bear'}`}>
                    {coin.change24h >= 0 ? '+' : ''}{coin.change24h.toFixed(2)}%
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-gray-400 text-xs">{fmt(coin.volume24h)}</td>
                  <td className={`py-3 px-3 text-right font-mono font-bold ${coin.rsi !== null ? rsiColor(coin.rsi) : 'text-gray-600'}`}>
                    {coin.rsi !== null ? coin.rsi.toFixed(1) : '—'}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded border text-xs font-bold ${signalColor(coin.signal)}`}>
                      {coin.signal > 0 ? '+' : ''}{coin.signal}
                    </span>
                  </td>
                  <td className="py-3 pl-3 text-xs">
                    {coin.pattern ? (
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        coin.pattern.type === 'bullish' ? 'bg-green-500/10 text-bull'
                        : coin.pattern.type === 'bearish' ? 'bg-red-500/10 text-bear'
                        : 'bg-amber-500/10 text-warn'
                      }`}>
                        {coin.pattern.name}
                      </span>
                    ) : (
                      <span className="text-gray-700">—</span>
                    )}
                  </td>
                  <td className="py-3 pl-3">
                    <Link
                      href={`/coin/${coin.symbol.toLowerCase()}`}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Analyze →
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500 text-sm">
                    No coins match these filters. Try widening the score range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-600 text-center">
        Signals computed from 1h Binance klines. Refreshes every 5 minutes. Not financial advice.
      </p>
    </div>
  )
}
