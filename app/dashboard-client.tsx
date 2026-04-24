'use client'

import { useWatchlist, useGlobalData, useFearGreed } from '@/hooks/useCoinData'
import { useTopMovers } from '@/hooks/useTopMovers'
import { useStreamPrices } from '@/hooks/useStreamPrices'
import { useStreamKlines } from '@/hooks/useStreamKlines'
import CoinCard from '@/components/ui/CoinCard'
import FearGreedGauge from '@/components/ui/FearGreedGauge'
import BtcMiniChart from '@/components/charts/BtcMiniChart'
import MarketHeatmap from '@/components/ui/MarketHeatmap'
import CorrelationMatrix from '@/components/ui/CorrelationMatrix'
import CoinLogo from '@/components/ui/CoinLogo'
import { useSparklines } from '@/hooks/useSparklines'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'

// Symbols streamed via WebSocket on the dashboard
const STREAM_SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'ADA']

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  return `$${n.toLocaleString()}`
}

function fmtPrice(n: number): string {
  if (n >= 10000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  if (n >= 1) return `$${n.toFixed(4)}`
  return `$${n.toFixed(6)}`
}

// ─── Live Clock ───────────────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = useState('')

  useEffect(() => {
    const tick = () => {
      setTime(new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
      }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <span className="font-mono text-xs text-gray-500 tabular-nums">{time}</span>
  )
}

// ─── Market Summary Strip ─────────────────────────────────────────────────────

function MarketSummaryStrip() {
  const { data: global, isLoading: glLoading } = useGlobalData()
  const { data: fg, isLoading: fgLoading } = useFearGreed()

  const fgValue = fg?.data?.[0] ? parseInt(fg.data[0].value) : null
  const fgClass = fg?.data?.[0]?.value_classification ?? ''
  const totalMcap = global?.data?.total_market_cap?.usd
  const totalVol = global?.data?.total_volume?.usd
  const btcDom = global?.data?.market_cap_percentage?.btc
  const ethDom = global?.data?.market_cap_percentage?.eth
  const mcapChange = global?.data?.market_cap_change_percentage_24h_usd

  return (
    <div className="card flex flex-wrap items-center gap-6 overflow-x-auto">
      {fgLoading ? (
        <div className="skeleton h-16 w-28 rounded" />
      ) : fgValue !== null ? (
        <FearGreedGauge value={fgValue} classification={fgClass} />
      ) : null}

      <div className="hidden sm:block w-px h-12 bg-surface-border" />

      {glLoading ? (
        <div className="flex gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
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
          {totalVol && (
            <div>
              <div className="text-gray-500 text-xs mb-0.5">24h Volume</div>
              <div className="font-mono font-semibold text-gray-100">{fmt(totalVol)}</div>
            </div>
          )}
          {btcDom != null && (
            <div>
              <div className="text-gray-500 text-xs mb-0.5">BTC Dom</div>
              <div className="font-mono font-semibold text-gray-100">{btcDom.toFixed(1)}%</div>
              {/* Mini dominance bar */}
              <div className="mt-1 h-1 w-20 bg-surface-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-400 rounded-full"
                  style={{ width: `${btcDom}%` }}
                />
              </div>
            </div>
          )}
          {ethDom != null && (
            <div>
              <div className="text-gray-500 text-xs mb-0.5">ETH Dom</div>
              <div className="font-mono font-semibold text-gray-100">{ethDom.toFixed(1)}%</div>
              <div className="mt-1 h-1 w-20 bg-surface-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-400 rounded-full"
                  style={{ width: `${ethDom * 4}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="ml-auto flex items-center gap-3">
        <LiveClock />
        <span className="text-xs text-gray-600 hidden sm:block">• Refresh 30s</span>
      </div>
    </div>
  )
}

// ─── Flash price (green up / red down on each tick) ──────────────────────────

function FlashPrice({ price, className = '' }: { price: number; className?: string }) {
  const prevRef = useRef<number | null>(null)
  const [flash, setFlash] = useState<'up' | 'down' | null>(null)

  useEffect(() => {
    if (prevRef.current !== null && price !== prevRef.current) {
      setFlash(price > prevRef.current ? 'up' : 'down')
      const t = setTimeout(() => setFlash(null), 700)
      prevRef.current = price
      return () => clearTimeout(t)
    }
    prevRef.current = price
  }, [price])

  const color =
    flash === 'up' ? 'text-bull' : flash === 'down' ? 'text-bear' : ''

  return (
    <span className={`transition-colors duration-100 ${color} ${className}`}>
      {fmtPrice(price)}
    </span>
  )
}

// ─── BTC Live Chart ───────────────────────────────────────────────────────────

function BtcChartSection({ stream }: { stream: ReturnType<typeof useStreamPrices> }) {
  const { klines, isLoading } = useStreamKlines('BTC', '1h', 96)

  const btcStream = stream['BTC']

  // Use WebSocket price when available, fall back to last kline close
  const livePrice = btcStream?.price ?? klines?.[klines.length - 1]?.close
  const change24h = btcStream?.change24h ?? null

  // 24h high/low from klines (structural context)
  const last24 = klines?.slice(-24)
  const high24 = btcStream?.high ?? (last24 ? Math.max(...last24.map((k) => k.high)) : null)
  const low24 = btcStream?.low ?? (last24 ? Math.min(...last24.map((k) => k.low)) : null)

  const wsConnected = !!btcStream

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <CoinLogo
            src="https://static.coinpaprika.com/coin/btc-bitcoin/logo.png"
            alt="BTC"
            size={36}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-100 text-lg">Bitcoin</span>
              <span className="text-xs text-gray-500 font-mono">BTC/USDT</span>
              {/* WebSocket status dot */}
              <span
                title={wsConnected ? 'Live WebSocket feed' : 'Connecting...'}
                className={`inline-block w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`}
              />
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {isLoading && !livePrice ? (
                <div className="skeleton h-7 w-36 rounded" />
              ) : livePrice ? (
                <>
                  <FlashPrice
                    price={livePrice}
                    className="font-mono font-bold text-xl"
                  />
                  {change24h !== null && (
                    <span className={`text-sm font-mono ${change24h >= 0 ? 'text-bull' : 'text-bear'}`}>
                      {change24h >= 0 ? '▲' : '▼'} {Math.abs(change24h).toFixed(2)}%
                    </span>
                  )}
                </>
              ) : (
                <span className="font-mono text-gray-500">—</span>
              )}
            </div>
          </div>
        </div>

        {/* 24h Stats */}
        <div className="hidden sm:flex items-center gap-6 text-xs text-right">
          {high24 && low24 && (
            <>
              <div>
                <div className="text-gray-500 mb-0.5">24h High</div>
                <div className="font-mono font-medium text-bull">{fmtPrice(high24)}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-0.5">24h Low</div>
                <div className="font-mono font-medium text-bear">{fmtPrice(low24)}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-0.5">Range</div>
                <div className="font-mono font-medium text-gray-300">
                  {(((high24 - low24) / low24) * 100).toFixed(2)}%
                </div>
              </div>
            </>
          )}
          <Link href="/coin/btc" className="btn-primary text-xs">
            Full Analysis →
          </Link>
        </div>
      </div>

      {/* Chart */}
      {isLoading ? (
        <div className="skeleton rounded-lg" style={{ height: 220 }} />
      ) : klines && klines.length > 0 ? (
        <BtcMiniChart klines={klines} height={220} />
      ) : (
        <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
          No chart data available
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-gray-600">
          1h candles · Last 4 days
          {wsConnected && (
            <span className="ml-2 text-green-600">· price streaming live</span>
          )}
        </span>
        <Link href="/coin/btc" className="text-xs text-blue-400 hover:text-blue-300 sm:hidden">
          Full Analysis →
        </Link>
      </div>
    </div>
  )
}

// ─── Top Movers ───────────────────────────────────────────────────────────────

function TopMovers() {
  const { data, isLoading, isError } = useTopMovers()

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Gainers */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-bull animate-pulse" />
          <h3 className="text-sm font-semibold text-gray-300">Top Gainers</h3>
          <span className="ml-auto text-xs text-gray-600">24h</span>
        </div>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-9 rounded" />
            ))}
          </div>
        ) : isError ? (
          <p className="text-xs text-gray-500 py-4 text-center">Failed to load data</p>
        ) : (
          <div className="space-y-1">
            {(data?.gainers ?? []).map((coin) => (
              <Link
                key={coin.symbol}
                href={`/coin/${coin.symbol.toLowerCase()}`}
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-green-500/5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-semibold text-xs text-gray-300 w-14 group-hover:text-green-300 transition-colors">
                    {coin.symbol}
                  </span>
                  <span className="font-mono text-xs text-gray-500">
                    {fmtPrice(coin.price)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 font-mono">
                    Vol: {fmt(coin.volume)}
                  </span>
                  <span className="badge-bull min-w-[64px] justify-end">
                    ▲ {coin.change24h.toFixed(2)}%
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Losers */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-bear animate-pulse" />
          <h3 className="text-sm font-semibold text-gray-300">Top Losers</h3>
          <span className="ml-auto text-xs text-gray-600">24h</span>
        </div>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-9 rounded" />
            ))}
          </div>
        ) : isError ? (
          <p className="text-xs text-gray-500 py-4 text-center">Failed to load data</p>
        ) : (
          <div className="space-y-1">
            {(data?.losers ?? []).map((coin) => (
              <Link
                key={coin.symbol}
                href={`/coin/${coin.symbol.toLowerCase()}`}
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-red-500/5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-semibold text-xs text-gray-300 w-14 group-hover:text-red-300 transition-colors">
                    {coin.symbol}
                  </span>
                  <span className="font-mono text-xs text-gray-500">
                    {fmtPrice(coin.price)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 font-mono">
                    Vol: {fmt(coin.volume)}
                  </span>
                  <span className="badge-bear min-w-[64px] justify-end">
                    ▼ {Math.abs(coin.change24h).toFixed(2)}%
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Volume Leaders ───────────────────────────────────────────────────────────

function VolumeLeaders() {
  const { data, isLoading, isError } = useTopMovers()
  const coins = data?.byVolume ?? []

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
        <h3 className="text-sm font-semibold text-gray-300">Volume Leaders</h3>
        <span className="ml-auto text-xs text-gray-600">24h USDT volume</span>
      </div>
      {isLoading ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="skeleton h-8 w-24 rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-xs text-gray-500 py-4 text-center">Failed to load data</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {coins.map((coin, idx) => (
            <Link
              key={coin.symbol}
              href={`/coin/${coin.symbol.toLowerCase()}`}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all hover:scale-[1.02] ${
                coin.change24h >= 0
                  ? 'border-green-500/20 hover:border-green-500/40 hover:bg-green-500/5'
                  : 'border-red-500/20 hover:border-red-500/40 hover:bg-red-500/5'
              } bg-surface-muted`}
            >
              <span className="text-gray-600 text-xs font-mono">#{idx + 1}</span>
              <span className="font-mono text-xs font-semibold text-gray-200">{coin.symbol}</span>
              <span className={`text-xs font-mono ${coin.change24h >= 0 ? 'text-bull' : 'text-bear'}`}>
                {coin.change24h >= 0 ? '+' : ''}{coin.change24h.toFixed(1)}%
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Watchlist Grid ───────────────────────────────────────────────────────────

// Maps CoinPaprika symbol (lowercase) → uppercase stream key
const SYMBOL_TO_STREAM: Record<string, string> = {
  btc: 'BTC',
  eth: 'ETH',
  sol: 'SOL',
  bnb: 'BNB',
  ada: 'ADA',
}

const WATCHLIST_SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'ADA']

function WatchlistGrid({ stream }: { stream: ReturnType<typeof useStreamPrices> }) {
  const DEFAULT_IDS = ['bitcoin', 'ethereum', 'solana', 'binancecoin', 'cardano']
  const { data: coins, isLoading, isError, refetch } = useWatchlist(DEFAULT_IDS)
  const { data: sparklines } = useSparklines(WATCHLIST_SYMBOLS)

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
      {coins?.map((coin) => {
        const streamKey = SYMBOL_TO_STREAM[coin.symbol.toLowerCase()]
        const live = streamKey ? stream[streamKey] : undefined
        const sparklineData = sparklines?.[coin.symbol.toUpperCase()]
        const coinWithSpark = sparklineData
          ? { ...coin, sparkline_in_7d: { price: sparklineData } }
          : coin
        return (
          <CoinCard
            key={coin.id}
            coin={coinWithSpark}
            livePrice={live?.price}
            liveChange={live?.change24h}
          />
        )
      })}
    </div>
  )
}

// ─── Quick Nav ────────────────────────────────────────────────────────────────

function QuickNav() {
  const NAV_COINS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'LINK', 'DOT', 'MATIC', 'LTC']

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300">Quick Analyze</h2>
        <div className="flex items-center gap-3">
          <Link href="/screener" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
            Screener →
          </Link>
          <Link href="/alerts" className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
            ⚡ Alerts
          </Link>
          <Link href="/news" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
            News →
          </Link>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {NAV_COINS.map((sym) => (
          <Link
            key={sym}
            href={`/coin/${sym.toLowerCase()}`}
            className="px-3 py-1.5 rounded-lg bg-surface-muted hover:bg-blue-600/20 hover:text-blue-300 text-xs font-mono text-gray-400 transition-all hover:scale-[1.05] border border-transparent hover:border-blue-500/30"
          >
            {sym}
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Market Status Banner ─────────────────────────────────────────────────────

function MarketStatusBanner() {
  const { data: fg } = useFearGreed()
  const { data: global } = useGlobalData()

  const fgValue = fg?.data?.[0] ? parseInt(fg.data[0].value) : null
  const mcapChange = global?.data?.market_cap_change_percentage_24h_usd

  let sentiment = 'Monitoring markets...'
  let sentimentColor = 'text-gray-500'

  if (fgValue !== null && mcapChange != null) {
    if (fgValue >= 75 && mcapChange > 2) {
      sentiment = 'Markets are in Extreme Greed — bulls in control'
      sentimentColor = 'text-bull'
    } else if (fgValue >= 55 && mcapChange > 0) {
      sentiment = 'Bullish sentiment — greed building in the market'
      sentimentColor = 'text-green-400'
    } else if (fgValue <= 25 && mcapChange < -2) {
      sentiment = 'Extreme Fear detected — potential accumulation zone'
      sentimentColor = 'text-bear'
    } else if (fgValue <= 45 && mcapChange < 0) {
      sentiment = 'Bearish pressure — fear dominating sentiment'
      sentimentColor = 'text-red-400'
    } else {
      sentiment = 'Mixed signals — market in consolidation phase'
      sentimentColor = 'text-warn'
    }
  }

  return (
    <div className="flex items-center gap-2 px-1">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
      <span className={`text-xs ${sentimentColor}`}>{sentiment}</span>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardClient() {
  // Single WebSocket connection for the whole dashboard
  const stream = useStreamPrices(STREAM_SYMBOLS)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">
            Market Overview
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time crypto intelligence — powered by Binance & CoinPaprika
          </p>
        </div>
        <MarketStatusBanner />
      </div>

      {/* Market summary strip */}
      <MarketSummaryStrip />

      {/* BTC Live Chart — receives the stream so price is live */}
      <BtcChartSection stream={stream} />

      {/* Top Movers */}
      <div>
        <h2 className="text-base font-semibold text-gray-200 mb-3">Market Movers</h2>
        <TopMovers />
      </div>

      {/* Volume leaders */}
      <VolumeLeaders />

      {/* Market heatmap */}
      <MarketHeatmap />

      {/* Correlation matrix */}
      <CorrelationMatrix />

      {/* Watchlist — stream prices override stale REST prices */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-200">Watchlist</h2>
          <span className="text-xs text-gray-600">BTC · ETH · SOL · BNB · ADA</span>
        </div>
        <WatchlistGrid stream={stream} />
      </div>

      {/* Quick nav */}
      <QuickNav />
    </div>
  )
}
