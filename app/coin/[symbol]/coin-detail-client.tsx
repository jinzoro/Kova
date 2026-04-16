'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useCoinDetail } from '@/hooks/useCoinData'
import { useKlines } from '@/hooks/useKlines'
import { useStreamKlines } from '@/hooks/useStreamKlines'
import { useStreamPrices } from '@/hooks/useStreamPrices'
import CoinLogo from '@/components/ui/CoinLogo'
import SignalScoreCard from '@/components/ui/SignalScoreCard'
import VolumeSpike from '@/components/ui/VolumeSpike'
import SupportResistance from '@/components/ui/SupportResistance'
import FundingRateBadge from '@/components/ui/FundingRate'
import TechnicalSummary from '@/components/ui/TechnicalSummary'
import { scoreSignal, calcMTFConsensus } from '@/lib/scoring'
import { calcHoltWinters } from '@/lib/forecast'
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

function MTFPanel({ symbol }: { symbol: string }) {
  const { data: k1h } = useKlines(symbol, '1h', 200)
  const { data: k4h } = useKlines(symbol, '4h', 200)
  const { data: k1d } = useKlines(symbol, '1d', 200)

  const consensus = useMemo(() => {
    if (!k1h || !k4h || !k1d) return null
    return calcMTFConsensus(scoreSignal(k1h), scoreSignal(k4h), scoreSignal(k1d))
  }, [k1h, k4h, k1d])

  if (!consensus) {
    return (
      <div className="card space-y-3 animate-pulse">
        <div className="skeleton h-4 w-48 rounded" />
        <div className="grid grid-cols-3 gap-3">
          {[0,1,2].map((i) => <div key={i} className="skeleton h-20 rounded-lg" />)}
        </div>
      </div>
    )
  }

  const labelColor = (label: string) => {
    if (label.includes('Strong Buy')) return 'text-bull'
    if (label.includes('Buy')) return 'text-green-400'
    if (label.includes('Strong Sell')) return 'text-bear'
    if (label.includes('Sell')) return 'text-orange-400'
    return 'text-warn'
  }

  const agreementColor = {
    'Strong Agreement': 'text-bull',
    'Agreement': 'text-green-400',
    'Mixed': 'text-warn',
    'Disagreement': 'text-bear',
  }[consensus.agreement]

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-300">Multi-Timeframe Consensus</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Weighted: 1d×3, 4h×2, 1h×1 — {' '}
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

      <div className="grid grid-cols-3 gap-3">
        {consensus.scores.map(({ timeframe, score, weight }) => (
          <div key={timeframe} className="bg-surface-muted rounded-xl p-3 text-center space-y-1">
            <div className="text-xs text-gray-500 font-mono">
              {timeframe} <span className="text-gray-600">×{weight}</span>
            </div>
            <div className={`text-xl font-bold font-mono ${labelColor(score.label)}`}>
              {score.total > 0 ? '+' : ''}{score.total}
            </div>
            <div className={`text-xs ${labelColor(score.label)}`}>{score.label}</div>
            {/* Mini breakdown */}
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
          ? `All three timeframes agree: ${consensus.label}. This is the highest-confidence setup — ${consensus.weighted > 0 ? 'trend is confirmed across all horizons.' : 'avoid longs until at least one timeframe turns positive.'}`
          : consensus.agreement === 'Agreement'
            ? `Most timeframes lean ${consensus.weighted >= 0 ? 'bullish' : 'bearish'}. The ${consensus.weighted >= 0 ? 'higher' : 'lower'} timeframes carry more weight in the consensus.`
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
