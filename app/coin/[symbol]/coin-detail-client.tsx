'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useCoinDetail } from '@/hooks/useCoinData'
import { useKlines } from '@/hooks/useKlines'
import { useStreamKlines } from '@/hooks/useStreamKlines'
import { useStreamPrices } from '@/hooks/useStreamPrices'
import { useAlerts } from '@/hooks/useAlerts'
import CoinLogo from '@/components/ui/CoinLogo'
import SignalScoreCard from '@/components/ui/SignalScoreCard'
import VolumeSpike from '@/components/ui/VolumeSpike'
import SupportResistance from '@/components/ui/SupportResistance'
import FundingRateBadge from '@/components/ui/FundingRate'
import FuturesPanel from '@/components/ui/FuturesPanel'
import TechnicalSummary from '@/components/ui/TechnicalSummary'
import CVDChart from '@/components/charts/CVDChart'
import { scoreSignal, calcMTFConsensus } from '@/lib/scoring'
import { calcHoltWinters } from '@/lib/forecast'
import toast from 'react-hot-toast'
import Link from 'next/link'
import type { KlineInterval } from '@/lib/binance'

const CandlestickChart = dynamic(() => import('@/components/charts/CandlestickChart'), { ssr: false })
const RSIChart = dynamic(() => import('@/components/charts/RSIChart'), { ssr: false })
const MACDChart = dynamic(() => import('@/components/charts/MACDChart'), { ssr: false })
const ForecastChart = dynamic(() => import('@/components/charts/ForecastChart'), { ssr: false })

interface Props {
  symbol: string
}

function fmt(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  return `$${n.toLocaleString()}`
}

function fmtPrice(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  if (n >= 1) return `$${n.toFixed(4)}`
  return `$${n.toFixed(6)}`
}

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card text-center">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="font-mono text-sm font-semibold text-gray-100 truncate">{value}</div>
      {sub && <div className="text-xs text-gray-600 mt-0.5">{sub}</div>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-gray-200 flex items-center gap-2">
        <span className="w-1 h-4 bg-blue-500 rounded-full inline-block" />
        {title}
      </h2>
      {children}
    </section>
  )
}

const MTF_OPTIONS: { interval: KlineInterval; label: string; weight: number }[] = [
  { interval: '15m', label: '15m', weight: 1 },
  { interval: '30m', label: '30m', weight: 2 },
  { interval: '1h',  label: '1h',  weight: 3 },
  { interval: '4h',  label: '4h',  weight: 4 },
  { interval: '1d',  label: '1d',  weight: 5 },
  { interval: '1w',  label: '1w',  weight: 6 },
]

function MTFPanel({ symbol }: { symbol: string }) {
  const [selected, setSelected] = useState<KlineInterval[]>(['1h', '4h', '1d'])

  // Always fetch all supported MTF intervals so switching is instant
  const { data: k15m } = useKlines(symbol, '15m', 200)
  const { data: k30m } = useKlines(symbol, '30m', 200)
  const { data: k1h }  = useKlines(symbol, '1h',  200)
  const { data: k4h }  = useKlines(symbol, '4h',  200)
  const { data: k1d }  = useKlines(symbol, '1d',  200)
  const { data: k1w }  = useKlines(symbol, '1w',  100)

  const consensus = useMemo(() => {
    const byInterval: Record<string, typeof k1h> = {
      '15m': k15m, '30m': k30m, '1h': k1h, '4h': k4h, '1d': k1d, '1w': k1w,
    }
    const entries = MTF_OPTIONS
      .filter((tf) => selected.includes(tf.interval))
      .map((tf) => {
        const klines = byInterval[tf.interval]
        if (!klines || klines.length < 30) return null
        return { timeframe: tf.label, score: scoreSignal(klines), weight: tf.weight }
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
    if (entries.length < 2) return null
    return calcMTFConsensus(entries)
  }, [selected, k15m, k30m, k1h, k4h, k1d, k1w])

  function toggleTF(interval: KlineInterval) {
    setSelected((prev) => {
      if (prev.includes(interval)) {
        if (prev.length <= 2) return prev
        return prev.filter((i) => i !== interval)
      }
      return [...prev, interval]
    })
  }

  const labelColor = (label: string) => {
    if (label.includes('Strong Buy')) return 'text-bull'
    if (label.includes('Buy')) return 'text-green-400'
    if (label.includes('Strong Sell')) return 'text-bear'
    if (label.includes('Sell')) return 'text-orange-400'
    return 'text-warn'
  }

  const weightSummary = MTF_OPTIONS
    .filter((tf) => selected.includes(tf.interval))
    .sort((a, b) => b.weight - a.weight)
    .map((tf) => `${tf.label}×${tf.weight}`)
    .join(', ')

  const gridCols = selected.length <= 2 ? 'grid-cols-2' : selected.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'

  if (!consensus) {
    return (
      <div className="card space-y-4 animate-pulse">
        <div className="flex flex-wrap gap-1.5">
          {MTF_OPTIONS.map((tf) => (
            <div key={tf.interval} className="skeleton h-6 w-10 rounded-full" />
          ))}
        </div>
        <div className="skeleton h-4 w-48 rounded" />
        <div className="grid grid-cols-3 gap-3">
          {[0,1,2].map((i) => <div key={i} className="skeleton h-20 rounded-lg" />)}
        </div>
      </div>
    )
  }

  const agreementColor = {
    'Strong Agreement': 'text-bull',
    'Agreement': 'text-green-400',
    'Mixed': 'text-warn',
    'Disagreement': 'text-bear',
  }[consensus.agreement]

  const n = consensus.scores.length
  const allWord = n === 2 ? 'Both' : `All ${n}`

  return (
    <div className="card space-y-4">
      {/* Timeframe selector */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-gray-500 mr-1">Timeframes:</span>
        {MTF_OPTIONS.map((tf) => {
          const active = selected.includes(tf.interval)
          const isLast = active && selected.length <= 2
          return (
            <button
              key={tf.interval}
              onClick={() => toggleTF(tf.interval)}
              disabled={isLast}
              title={isLast ? 'Minimum 2 timeframes required' : undefined}
              className={`text-xs px-2.5 py-0.5 rounded-full font-mono border transition-colors ${
                active
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                  : 'bg-surface-muted border-surface-border text-gray-500 hover:text-gray-300 hover:border-gray-500'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {tf.label}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-300">Multi-Timeframe Consensus</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Weighted: {weightSummary} —{' '}
            <span className={agreementColor}>{consensus.agreement}</span>
          </div>
        </div>
        <div className={`text-right ${labelColor(consensus.label)}`}>
          <div className="text-xl font-bold font-mono">
            {consensus.weighted > 0 ? '+' : ''}{consensus.weighted}
          </div>
          <div className="text-xs font-semibold">{consensus.label}</div>
        </div>
      </div>

      <div className={`grid ${gridCols} gap-3`}>
        {consensus.scores.map(({ timeframe, score, weight }) => (
          <div key={timeframe} className="bg-surface-muted rounded-xl p-3 text-center space-y-1">
            <div className="text-xs text-gray-500 font-mono">
              {timeframe} <span className="text-gray-600">×{weight}</span>
            </div>
            <div className={`text-xl font-bold font-mono ${labelColor(score.label)}`}>
              {score.total > 0 ? '+' : ''}{score.total}
            </div>
            <div className={`text-xs ${labelColor(score.label)}`}>{score.label}</div>
            <div className="flex justify-center gap-0.5 pt-1">
              {score.breakdown.slice(0, 6).map((b, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-4 rounded-sm ${b.value > 0 ? 'bg-bull/60' : b.value < 0 ? 'bg-bear/60' : 'bg-gray-600'}`}
                  title={`${b.indicator}: ${b.value > 0 ? '+' : ''}${b.value}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-500 leading-relaxed bg-surface-muted rounded-lg px-3 py-2">
        {consensus.agreement === 'Strong Agreement'
          ? `${allWord} timeframes agree: ${consensus.label}. This is the highest-confidence setup — ${consensus.weighted > 0 ? 'trend is confirmed across all horizons.' : 'avoid longs until at least one timeframe turns positive.'}`
          : consensus.agreement === 'Agreement'
            ? `Most timeframes lean ${consensus.weighted >= 0 ? 'bullish' : 'bearish'}. Higher timeframes carry more weight in the consensus.`
            : consensus.agreement === 'Mixed'
              ? 'Timeframes are showing conflicting signals. Higher timeframe direction should take priority. Wait for alignment before committing.'
              : 'Timeframes are in disagreement. This is an indecisive environment — reduce size and wait for clearer structure.'}
      </div>
    </div>
  )
}

function ForecastPanel({ symbol, interval }: { symbol: string; interval: KlineInterval }) {
  const { data: klines } = useKlines(symbol, interval, 100)

  const forecast = useMemo(() => {
    if (!klines || klines.length < 10) return null
    return calcHoltWinters(klines.map((k) => k.close), 5)
  }, [klines])

  if (!klines || !forecast) return <div className="card skeleton h-56" />

  const current = klines[klines.length - 1]?.close ?? 0
  const bullish = forecast.projections[forecast.projections.length - 1]?.pctChange > 0

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-300">Holt-Winters Forecast</div>
          <div className="text-xs text-gray-500 mt-0.5">Next 5 {interval} candles — damped additive smoothing</div>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded border ${bullish ? 'text-bull border-green-500/30 bg-green-500/10' : 'text-bear border-red-500/30 bg-red-500/10'}`}>
          {bullish ? '↑ Projected Up' : '↓ Projected Down'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-surface-border">
              <th className="text-left py-1.5 font-medium">Step</th>
              <th className="text-right py-1.5 font-medium">Projected Price</th>
              <th className="text-right py-1.5 font-medium">vs Current</th>
              <th className="text-right py-1.5 font-medium">95% CI Range</th>
            </tr>
          </thead>
          <tbody>
            {forecast.projections.map((p, i) => (
              <tr key={p.step} className="border-b border-surface-border/40 hover:bg-surface-muted/50 transition-colors">
                <td className="py-2 font-mono text-gray-500">+{p.step} candle</td>
                <td className="py-2 font-mono text-right text-gray-100 font-semibold">{fmtPrice(p.price)}</td>
                <td className={`py-2 font-mono text-right font-bold ${p.pctChange >= 0 ? 'text-bull' : 'text-bear'}`}>
                  {p.pctChange >= 0 ? '+' : ''}{p.pctChange}%
                </td>
                <td className="py-2 font-mono text-right text-gray-500 text-xs">
                  {fmtPrice(forecast.lower[i])} – {fmtPrice(forecast.upper[i])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ForecastChart klines={klines.slice(-50)} forecast={forecast} />

      <p className="text-xs text-gray-500 leading-relaxed">
        Holt-Winters uses exponential smoothing with a damped trend component (α=0.3, β=0.1, φ=0.9).
        The 95% confidence interval widens with each step forward. This is a statistical model —
        not financial advice. Treat projections as probabilistic ranges, not price targets.
      </p>
    </div>
  )
}

/** Flashes green/red briefly when price changes */
function LivePriceDisplay({ price, pct }: { price: number; pct: number }) {
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

  const priceColor =
    flash === 'up' ? 'text-bull' :
    flash === 'down' ? 'text-bear' :
    'text-gray-100'

  const isUp = pct >= 0

  return (
    <div className="flex items-center gap-3 mt-1 flex-wrap">
      <span className={`text-2xl font-mono font-bold transition-colors duration-100 ${priceColor}`}>
        {fmtPrice(price)}
      </span>
      <span className={isUp ? 'badge-bull' : 'badge-bear'}>
        {isUp ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}% 24h
      </span>
    </div>
  )
}

function AlertButton({ symbol, price }: { symbol: string; price: number }) {
  const { addAlert } = useAlerts()
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState('')

  const handleSet = () => {
    const t = parseFloat(target)
    if (!t || t <= 0) return
    addAlert(symbol.toUpperCase(), t, price)
    toast.success(`Alert set for ${symbol.toUpperCase()} at $${t.toLocaleString()}`, { icon: '🔔' })
    setTarget('')
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn-ghost text-xs flex items-center gap-1 text-amber-400 hover:text-amber-300"
        title="Set price alert"
      >
        🔔 Alert
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-surface-card border border-surface-border rounded-xl shadow-xl z-20 p-3 space-y-2">
          <div className="text-xs text-gray-400 font-medium">Set Alert for {symbol.toUpperCase()}</div>
          <div className="text-xs text-gray-500">Current: ${price.toLocaleString('en-US', { maximumFractionDigits: 4 })}</div>
          <input
            type="number"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Target price (USD)"
            className="input text-xs w-full"
            step="any"
            min="0"
            onKeyDown={(e) => e.key === 'Enter' && handleSet()}
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={handleSet} className="btn-primary text-xs flex-1" disabled={!target}>Set</button>
            <button onClick={() => setOpen(false)} className="btn-ghost text-xs flex-1">Cancel</button>
          </div>
          <Link href="/alerts" className="block text-xs text-blue-400 hover:text-blue-300 text-center pt-1">
            Manage alerts →
          </Link>
        </div>
      )}
    </div>
  )
}

export default function CoinDetailClient({ symbol }: Props) {
  const [interval, setInterval] = useState<KlineInterval>('1h')
  const { data: coin, isLoading, isError, refetch } = useCoinDetail(symbol)

  // 350 candles so EMA 200 has ~150 visible data points (needs period candles to seed)
  const { klines, isLoading: klinesLoading } = useStreamKlines(symbol, interval, 350)

  // Live WebSocket price for the header (overrides stale CoinPaprika price)
  const streamPrices = useStreamPrices([symbol.toUpperCase()])
  const liveStream = streamPrices[symbol.toUpperCase()]

  const score = useMemo(() => {
    if (!klines || klines.length < 30) return null
    return scoreSignal(klines)
  }, [klines])

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-24 skeleton rounded-xl" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 skeleton rounded-xl" />)}
        </div>
        <div className="h-96 skeleton rounded-xl" />
      </div>
    )
  }

  if (isError || !coin) {
    return (
      <div className="card text-center py-16">
        <p className="text-gray-400 text-lg mb-3">Could not load <strong>{symbol.toUpperCase()}</strong></p>
        <p className="text-gray-500 text-sm mb-6">
          Make sure the symbol is valid (e.g. btc, eth, sol). Some symbols may need the full CoinPaprika ID.
        </p>
        <button onClick={() => refetch()} className="btn-primary">Retry</button>
      </div>
    )
  }

  const md = coin.market_data
  // Use WebSocket live price when available, fall back to CoinPaprika REST
  const price = liveStream?.price ?? md.current_price.usd
  // Use WebSocket 24h change when available (computed from 24h open vs current)
  const pct = liveStream?.change24h ?? md.price_change_percentage_24h
  const wsConnected = !!liveStream

  return (
    <div className="space-y-8 animate-fade-in">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-4">
          <CoinLogo src={coin.image.large} alt={coin.symbol} size={56} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-100">{coin.name}</h1>
              <span className="font-mono text-gray-500 uppercase text-sm">{coin.symbol}</span>
              {coin.market_cap_rank > 0 && (
                <span className="text-xs text-gray-500 bg-surface-muted px-2 py-0.5 rounded font-mono">
                  Rank #{coin.market_cap_rank}
                </span>
              )}
              {/* Live feed indicator */}
              <span
                title={wsConnected ? 'Price streaming live' : 'Connecting to live feed...'}
                className={`inline-flex items-center gap-1 text-xs ${wsConnected ? 'text-green-500' : 'text-gray-600'}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
                {wsConnected ? 'Live' : 'Connecting'}
              </span>
            </div>
            <LivePriceDisplay price={price} pct={pct} />
          </div>
          <FundingRateBadge symbol={symbol} />
          <AlertButton symbol={symbol} price={price} />
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatBox label="Market Cap" value={fmt(md.market_cap.usd)} />
        <StatBox label="24h Volume" value={fmt(md.total_volume.usd)} />
        <StatBox label="ATH" value={fmtPrice(md.ath.usd)} />
        <StatBox
          label="From ATH"
          value={`${md.ath_change_percentage.usd.toFixed(1)}%`}
          sub={md.ath_change_percentage.usd < -50 ? 'Deep drawdown' : undefined}
        />
        <StatBox label="Circ. Supply" value={md.circulating_supply > 0 ? fmt(md.circulating_supply) : 'N/A'} />
        <StatBox label="Total Supply" value={md.total_supply ? fmt(md.total_supply) : '∞'} />
      </div>

      {/* ── Chart ──────────────────────────────────────────────────────── */}
      <Section title="Price Chart">
        {klinesLoading ? (
          <div className="skeleton h-96 rounded-xl" />
        ) : klines && klines.length > 0 ? (
          <>
            <CandlestickChart klines={klines} interval={interval} onIntervalChange={setInterval} />
            <div className="space-y-3">
              <RSIChart klines={klines} />
              <MACDChart klines={klines} />
            </div>
          </>
        ) : (
          <div className="card text-center py-8 text-gray-500 text-sm">No chart data available</div>
        )}
      </Section>

      {/* ── Signal Score ───────────────────────────────────────────────── */}
      <Section title="Signal Score">
        {score
          ? <SignalScoreCard score={score} />
          : <div className="card skeleton h-48" />}
      </Section>

      {/* ── Technical Summary (trend + patterns + momentum) ────────────── */}
      <Section title="Technical Analysis">
        {klines && klines.length > 30
          ? <TechnicalSummary klines={klines} symbol={symbol} />
          : <div className="card skeleton h-64" />}
      </Section>

      {/* ── Volume + S/R ───────────────────────────────────────────────── */}
      <Section title="Volume & Structure">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {klines && <VolumeSpike klines={klines} />}
          {klines && <SupportResistance klines={klines} currentPrice={price} />}
        </div>
        {klines && klines.length > 2 && <CVDChart klines={klines} />}
        <FuturesPanel symbol={symbol} />
      </Section>

      {/* ── Multi-Timeframe ────────────────────────────────────────────── */}
      <Section title="Multi-Timeframe Analysis">
        <MTFPanel symbol={symbol} />
      </Section>

      {/* ── Forecast ───────────────────────────────────────────────────── */}
      <Section title={`Forecast — ${interval} Timeframe`}>
        <ForecastPanel symbol={symbol} interval={interval} />
      </Section>

    </div>
  )
}
