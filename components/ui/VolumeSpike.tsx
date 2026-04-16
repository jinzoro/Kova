'use client'

import type { Kline } from '@/lib/binance'
import { calcVolumeSMA } from '@/lib/indicators'

interface Props {
  klines: Kline[]
}

type SpikeLevel = 'Extreme' | 'Spike' | 'Above Average' | 'Normal' | 'Low'

function spikeLevel(ratio: number): SpikeLevel {
  if (ratio >= 3) return 'Extreme'
  if (ratio >= 2) return 'Spike'
  if (ratio >= 1.5) return 'Above Average'
  if (ratio >= 0.7) return 'Normal'
  return 'Low'
}

function spikeColor(level: SpikeLevel): string {
  switch (level) {
    case 'Extreme': return 'text-bear'
    case 'Spike': return 'text-warn'
    case 'Above Average': return 'text-green-400'
    case 'Normal': return 'text-gray-300'
    case 'Low': return 'text-gray-500'
  }
}

function spikeBg(level: SpikeLevel): string {
  switch (level) {
    case 'Extreme': return 'bg-red-500/10 border-red-500/20'
    case 'Spike': return 'bg-amber-500/10 border-amber-500/20'
    case 'Above Average': return 'bg-green-500/10 border-green-500/20'
    default: return 'bg-surface-muted border-surface-border'
  }
}

function formatVol(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)}K`
  return v.toFixed(0)
}

export default function VolumeSpike({ klines }: Props) {
  if (klines.length < 21) return null

  const sma20 = calcVolumeSMA(klines, 20)
  const last = klines[klines.length - 1]
  const prev = klines[klines.length - 2]
  const avgVol = sma20[sma20.length - 1]
  const ratio = isNaN(avgVol) || avgVol === 0 ? 1 : last.volume / avgVol
  const level = spikeLevel(ratio)

  const pctChange = ((last.close - last.open) / last.open) * 100
  const isGreenCandle = last.close >= last.open

  // Buy/sell pressure: approximate using up-volume vs down-volume over last 20
  const last20 = klines.slice(-20)
  const buyVol = last20.filter((k) => k.close >= k.open).reduce((s, k) => s + k.volume, 0)
  const sellVol = last20.filter((k) => k.close < k.open).reduce((s, k) => s + k.volume, 0)
  const totalVol = buyVol + sellVol
  const buyPct = totalVol > 0 ? (buyVol / totalVol) * 100 : 50

  // Price-volume divergence check
  const priceTrend5 = klines[klines.length - 1].close > klines[klines.length - 5]?.close
  const volumeTrend5 = (() => {
    const recent5avg = klines.slice(-5).reduce((s, k) => s + k.volume, 0) / 5
    const prior5avg = klines.slice(-10, -5).reduce((s, k) => s + k.volume, 0) / 5
    return recent5avg > prior5avg
  })()

  const hasDivergence = priceTrend5 !== volumeTrend5
  const divergenceType = hasDivergence
    ? priceTrend5 && !volumeTrend5
      ? 'bearish'  // price up, volume down = weak rally
      : 'bullish'  // price down, volume down = weak selling
    : null

  // Volume trend over last 10 candles
  const vol10 = klines.slice(-10).map((k) => k.volume)
  const volTrendUp = vol10[9] > vol10[0]

  // Interpretation
  const interpretation = (): string => {
    if (level === 'Extreme' && isGreenCandle)
      return 'Extreme buying volume on a bullish candle — potential breakout or blow-off top. Confirm with price action at key levels.'
    if (level === 'Extreme' && !isGreenCandle)
      return 'Extreme selling volume on a bearish candle — potential capitulation or breakdown. High-probability reversal zone if at support.'
    if (level === 'Spike' && isGreenCandle)
      return 'Significant volume spike with bullish price action — strong buying conviction. Bulls are in control this candle.'
    if (level === 'Spike' && !isGreenCandle)
      return 'Significant volume spike with bearish price action — strong selling pressure. Could mark a local top if near resistance.'
    if (level === 'Above Average' && isGreenCandle)
      return 'Above-average volume on a bullish candle supports the upward move with moderate conviction.'
    if (level === 'Above Average' && !isGreenCandle)
      return 'Above-average volume on a bearish candle supports the downward move with moderate conviction.'
    if (level === 'Low')
      return 'Below-average volume — market participation is thin. Moves on low volume are less reliable.'
    return 'Volume is within normal range — no significant institutional activity detected.'
  }

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">Volume Analysis</h3>
        <div className={`flex items-center gap-2 border rounded-lg px-2.5 py-1 ${spikeBg(level)}`}>
          <span className={`text-xs font-bold ${spikeColor(level)}`}>{level}</span>
          <span className={`text-xs font-mono font-bold ${spikeColor(level)}`}>{ratio.toFixed(2)}×</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-surface-muted rounded-lg p-2">
          <div className="text-xs text-gray-500 mb-0.5">Current Vol</div>
          <div className="font-mono text-sm text-gray-100 font-semibold">{formatVol(last.volume)}</div>
        </div>
        <div className="bg-surface-muted rounded-lg p-2">
          <div className="text-xs text-gray-500 mb-0.5">SMA 20 Vol</div>
          <div className="font-mono text-sm text-gray-100">{formatVol(avgVol)}</div>
        </div>
        <div className="bg-surface-muted rounded-lg p-2">
          <div className="text-xs text-gray-500 mb-0.5">Candle</div>
          <div className={`font-mono text-sm font-bold ${isGreenCandle ? 'text-bull' : 'text-bear'}`}>
            {isGreenCandle ? '▲' : '▼'} {Math.abs(pctChange).toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Buy/Sell pressure bar (last 20 candles) */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Buy Pressure (20c)</span>
          <span className="font-mono">
            <span className="text-bull">{buyPct.toFixed(0)}%</span>
            {' / '}
            <span className="text-bear">{(100 - buyPct).toFixed(0)}%</span>
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-bull transition-all"
            style={{ width: `${buyPct}%` }}
          />
          <div
            className="h-full bg-bear transition-all"
            style={{ width: `${100 - buyPct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs mt-0.5 text-gray-600">
          <span>Buy vol: {formatVol(buyVol)}</span>
          <span>Sell vol: {formatVol(sellVol)}</span>
        </div>
      </div>

      {/* Volume trend */}
      <div className="flex items-center gap-3 text-xs">
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${volTrendUp ? 'bg-green-500/10 text-bull' : 'bg-red-500/10 text-bear'}`}>
          {volTrendUp ? '↑' : '↓'} Volume trending {volTrendUp ? 'up' : 'down'} (10c)
        </div>
        {hasDivergence && divergenceType && (
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${divergenceType === 'bearish' ? 'bg-amber-500/10 text-warn' : 'bg-blue-500/10 text-blue-400'}`}>
            ⚡ {divergenceType === 'bearish' ? 'Bearish divergence' : 'Bullish divergence'}
          </div>
        )}
      </div>

      {/* Divergence explanation */}
      {hasDivergence && divergenceType && (
        <p className="text-xs text-gray-400 leading-relaxed bg-surface-muted rounded-lg px-3 py-2">
          {divergenceType === 'bearish'
            ? 'Price is rising but volume is declining over the last 5 candles — a bearish divergence. The rally may lack conviction and could fade.'
            : 'Price is falling but volume is declining — a bullish divergence. Sellers are losing conviction; a reversal or consolidation is possible.'}
        </p>
      )}

      {/* Main interpretation */}
      <p className="text-xs text-gray-400 leading-relaxed">{interpretation()}</p>
    </div>
  )
}
