'use client'

import type { Kline } from '@/lib/binance'
import { calcEMA, calcRSI, calcMACD, calcATR, calcBollingerBands } from '@/lib/indicators'
import { detectPatterns, analyzeTrend } from '@/lib/patterns'
import type { CandlePattern } from '@/lib/patterns'

interface Props {
  klines: Kline[]
  symbol: string
}

function fmtPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (n >= 1) return n.toFixed(4)
  return n.toFixed(6)
}

function PatternBadge({ pattern }: { pattern: CandlePattern }) {
  const colors = {
    bullish: 'bg-green-500/10 text-bull border-green-500/20',
    bearish: 'bg-red-500/10 text-bear border-red-500/20',
    neutral: 'bg-amber-500/10 text-warn border-amber-500/20',
  }
  const strengthIcon = { strong: '●●●', moderate: '●●○', weak: '●○○' }

  return (
    <div className={`border rounded-lg p-3 ${colors[pattern.type]}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-xs">{pattern.name}</span>
        <span className="text-xs opacity-60">{strengthIcon[pattern.strength]}</span>
      </div>
      <p className="text-xs opacity-80 leading-relaxed">{pattern.description}</p>
    </div>
  )
}

function MeterBar({ label, value, min, max, lowColor = 'text-bull', highColor = 'text-bear' }: {
  label: string; value: number; min: number; max: number; lowColor?: string; highColor?: string
}) {
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
  const isHigh = pct > 70
  const isLow = pct < 30

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className={`font-mono font-semibold ${isHigh ? highColor : isLow ? lowColor : 'text-gray-300'}`}>
          {value.toFixed(2)}
        </span>
      </div>
      <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isHigh ? 'bg-bear' : isLow ? 'bg-bull' : 'bg-blue-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function TechnicalSummary({ klines, symbol }: Props) {
  if (klines.length < 30) return null

  const closes = klines.map((k) => k.close)
  const price = closes[closes.length - 1]

  // Calculate all indicators
  const ema12 = calcEMA(closes, 12)
  const ema26 = calcEMA(closes, 26)
  const ema50 = calcEMA(closes, 50)
  const ema200 = calcEMA(closes, 200)
  const rsi = calcRSI(closes, 14)
  const macd = calcMACD(closes)
  const atr = calcATR(klines, 14)
  const bb = calcBollingerBands(closes, 20, 2)

  const lastRSI = rsi[rsi.length - 1]
  const lastMACD = macd[macd.length - 1]
  const lastATR = atr[atr.length - 1]
  const lastBB = bb[bb.length - 1]
  const lastEMA12 = ema12[ema12.length - 1]
  const lastEMA26 = ema26[ema26.length - 1]
  const lastEMA50 = ema50[ema50.length - 1]
  const lastEMA200 = ema200[ema200.length - 1]

  // Patterns
  const patterns = detectPatterns(klines, 15)

  // Trend analysis
  const trend = analyzeTrend(klines, ema12, ema26, ema200)

  // ATR % of price (volatility)
  const atrPct = !isNaN(lastATR) ? (lastATR / price) * 100 : null

  // BB width % (squeeze indicator)
  const bbWidth = !isNaN(lastBB.upper) ? ((lastBB.upper - lastBB.lower) / lastBB.middle) * 100 : null

  // BB position (0 = at lower, 50 = at mid, 100 = at upper)
  const bbPosition = !isNaN(lastBB.upper) && lastBB.upper !== lastBB.lower
    ? ((price - lastBB.lower) / (lastBB.upper - lastBB.lower)) * 100
    : 50

  // MACD momentum direction
  const macdPrev = macd[macd.length - 2]
  const histAccel = lastMACD && macdPrev
    ? lastMACD.histogram - macdPrev.histogram
    : 0

  // Trend phase color
  const phaseColor = {
    'Strong Uptrend': 'text-bull bg-green-500/10 border-green-500/20',
    'Uptrend': 'text-green-400 bg-green-500/8 border-green-500/15',
    'Sideways / Consolidation': 'text-warn bg-amber-500/10 border-amber-500/20',
    'Downtrend': 'text-orange-400 bg-red-500/8 border-red-500/15',
    'Strong Downtrend': 'text-bear bg-red-500/10 border-red-500/20',
  }[trend.phase]

  // EMA distance
  const ema200Dist = !isNaN(lastEMA200)
    ? ((price - lastEMA200) / lastEMA200 * 100)
    : null
  const ema50Dist = !isNaN(lastEMA50)
    ? ((price - lastEMA50) / lastEMA50 * 100)
    : null

  // Build RSI interpretation
  const rsiInterpretation = !isNaN(lastRSI)
    ? lastRSI > 80 ? 'Severely overbought — high reversal risk'
    : lastRSI > 70 ? 'Overbought — consider reducing longs'
    : lastRSI > 60 ? 'Bullish momentum, approaching overbought'
    : lastRSI > 50 ? 'Mild bullish momentum'
    : lastRSI > 40 ? 'Mild bearish momentum'
    : lastRSI > 30 ? 'Bearish momentum, approaching oversold'
    : lastRSI > 20 ? 'Oversold — potential bounce zone'
    : 'Severely oversold — high bounce probability'
    : 'N/A'

  return (
    <div className="space-y-4">
      {/* ── Trend Phase Banner ─────────────────────────────────────────── */}
      <div className={`card border ${phaseColor} space-y-2`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Trend Phase</div>
            <div className="text-lg font-bold">{trend.phase}</div>
          </div>
          <div className="text-right text-xs space-y-1">
            <div className={`font-medium ${trend.emaAlignment === 'Bullish Stack' ? 'text-bull' : trend.emaAlignment === 'Bearish Stack' ? 'text-bear' : 'text-warn'}`}>
              {trend.emaAlignment}
            </div>
            <div className={`${trend.priceVsEMA200 === 'Above' ? 'text-bull' : trend.priceVsEMA200 === 'Below' ? 'text-bear' : 'text-gray-400'}`}>
              {trend.priceVsEMA200 !== 'N/A' ? `${trend.priceVsEMA200} EMA200` : 'EMA200 N/A'}
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-300 leading-relaxed">{trend.description}</p>
      </div>

      {/* ── Two-column layout ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── EMA Levels Table ────────────────────────────────────────── */}
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-gray-300">Moving Average Levels</h3>
          <div className="space-y-2 text-xs">
            {[
              { label: 'EMA 12 (fast)', val: lastEMA12, dist: !isNaN(lastEMA12) ? (price - lastEMA12) / lastEMA12 * 100 : null },
              { label: 'EMA 26 (slow)', val: lastEMA26, dist: !isNaN(lastEMA26) ? (price - lastEMA26) / lastEMA26 * 100 : null },
              { label: 'EMA 50 (mid)', val: lastEMA50, dist: ema50Dist },
              { label: 'EMA 200 (trend)', val: lastEMA200, dist: ema200Dist },
            ].map(({ label, val, dist }) => (
              <div key={label} className="flex items-center justify-between py-1 border-b border-surface-border/50 last:border-0">
                <span className="text-gray-400">{label}</span>
                <div className="text-right">
                  {isNaN(val) ? (
                    <span className="text-gray-600">Not enough data</span>
                  ) : (
                    <>
                      <span className="font-mono text-gray-100">${fmtPrice(val)}</span>
                      {dist !== null && (
                        <span className={`ml-2 font-mono font-bold ${dist >= 0 ? 'text-bull' : 'text-bear'}`}>
                          {dist >= 0 ? '+' : ''}{dist.toFixed(2)}%
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          {trend.consecutiveBullCandles > 1 && (
            <div className="text-xs text-bull bg-green-500/10 rounded px-2 py-1">
              {trend.consecutiveBullCandles} consecutive bullish candles
            </div>
          )}
          {trend.consecutiveBearCandles > 1 && (
            <div className="text-xs text-bear bg-red-500/10 rounded px-2 py-1">
              {trend.consecutiveBearCandles} consecutive bearish candles
            </div>
          )}
        </div>

        {/* ── Momentum Dashboard ──────────────────────────────────────── */}
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-gray-300">Momentum Dashboard</h3>

          {/* RSI meter */}
          {!isNaN(lastRSI) && (
            <div className="space-y-1">
              <MeterBar label={`RSI (14) — ${rsiInterpretation}`} value={lastRSI} min={0} max={100} />
              <div className="flex justify-between text-xs text-gray-600 font-mono">
                <span>Oversold (30)</span>
                <span>Neutral</span>
                <span>Overbought (70)</span>
              </div>
            </div>
          )}

          {/* BB Position */}
          {!isNaN(lastBB.upper) && (
            <div className="space-y-1">
              <MeterBar
                label={`BB Position — ${bbPosition < 20 ? 'Near lower band (oversold)' : bbPosition > 80 ? 'Near upper band (overbought)' : 'Mid-range'}`}
                value={bbPosition}
                min={0}
                max={100}
              />
              <div className="flex justify-between text-xs text-gray-600 font-mono">
                <span>Lower: ${fmtPrice(lastBB.lower)}</span>
                <span>Mid: ${fmtPrice(lastBB.middle)}</span>
                <span>Upper: ${fmtPrice(lastBB.upper)}</span>
              </div>
            </div>
          )}

          {/* MACD state */}
          {lastMACD && !isNaN(lastMACD.histogram) && (
            <div className="p-3 bg-surface-muted rounded-lg text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-400">MACD Line</span>
                <span className={`font-mono font-bold ${lastMACD.macd > 0 ? 'text-bull' : 'text-bear'}`}>
                  {lastMACD.macd > 0 ? '+' : ''}{lastMACD.macd.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Signal Line</span>
                <span className="font-mono text-gray-300">{lastMACD.signal.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Histogram</span>
                <span className={`font-mono font-bold ${lastMACD.histogram > 0 ? 'text-bull' : 'text-bear'}`}>
                  {lastMACD.histogram > 0 ? '+' : ''}{lastMACD.histogram.toFixed(4)}
                  <span className={`ml-1 text-xs ${histAccel > 0 ? 'text-bull' : 'text-bear'}`}>
                    {histAccel > 0 ? '▲ accel' : '▼ decel'}
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Volatility & Squeeze ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {atrPct !== null && (
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-gray-300">Volatility (ATR)</h3>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-mono font-bold text-gray-100">{atrPct.toFixed(2)}%</div>
                <div className="text-xs text-gray-500">ATR as % of price</div>
              </div>
              <div className="flex-1 text-xs text-gray-400 leading-relaxed">
                {atrPct > 5
                  ? 'Extremely high volatility — price swings are large. Risk management critical.'
                  : atrPct > 3
                    ? 'High volatility. Wide stops required; use smaller position sizes.'
                    : atrPct > 1.5
                      ? 'Moderate volatility — normal trading conditions.'
                      : atrPct > 0.5
                        ? 'Low volatility. Potential squeeze forming — big move may be imminent.'
                        : 'Very low volatility — market is compressed. Breakout watch.'}
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>ATR value</span>
                <span className="font-mono">${fmtPrice(lastATR)}</span>
              </div>
              <div className="text-xs text-gray-500">
                Expected daily range: ${fmtPrice(price - lastATR)} – ${fmtPrice(price + lastATR)}
              </div>
            </div>
          </div>
        )}

        {bbWidth !== null && (
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-gray-300">Bollinger Band Analysis</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Band Width</span>
                <span className={`font-mono font-bold ${bbWidth < 5 ? 'text-warn' : bbWidth > 15 ? 'text-blue-400' : 'text-gray-100'}`}>
                  {bbWidth.toFixed(2)}%
                  {bbWidth < 5 && ' (SQUEEZE)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Upper Band</span>
                <span className="font-mono text-bear">${fmtPrice(lastBB.upper)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Middle (SMA20)</span>
                <span className="font-mono text-gray-300">${fmtPrice(lastBB.middle)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Lower Band</span>
                <span className="font-mono text-bull">${fmtPrice(lastBB.lower)}</span>
              </div>
              <p className="text-gray-500 leading-relaxed pt-1">
                {bbWidth < 5
                  ? 'Bands are very tight — a volatility expansion is likely near. Watch for breakout.'
                  : price > lastBB.upper
                    ? 'Price above upper band — statistically extended. Mean reversion risk is elevated.'
                    : price < lastBB.lower
                      ? 'Price below lower band — potential bounce zone, but can stay low in strong downtrends.'
                      : `Price is at ${bbPosition.toFixed(0)}% of the band range.`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Candlestick Patterns ─────────────────────────────────────────── */}
      {patterns.length > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-300">Candlestick Patterns Detected</h3>
            <span className="text-xs text-gray-500">(last 15 candles)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {patterns.map((p, i) => <PatternBadge key={i} pattern={p} />)}
          </div>
          <p className="text-xs text-gray-600">
            Patterns are more reliable at confirmed support/resistance levels with above-average volume.
          </p>
        </div>
      )}

      {/* ── Interpretation Summary ────────────────────────────────────────── */}
      <div className="card space-y-3 border-blue-500/20">
        <h3 className="text-sm font-semibold text-blue-400">Analysis Summary — {symbol.toUpperCase()}</h3>
        <div className="text-xs text-gray-300 leading-relaxed space-y-2">
          <p>
            <strong className="text-gray-100">Trend:</strong>{' '}
            {trend.phase}. {trend.emaAlignment === 'Bullish Stack'
              ? 'All EMAs are aligned bullishly, confirming the uptrend.'
              : trend.emaAlignment === 'Bearish Stack'
                ? 'All EMAs are aligned bearishly, confirming the downtrend.'
                : 'EMAs are mixed, suggesting a transitional or ranging market.'}
          </p>
          {!isNaN(lastRSI) && (
            <p>
              <strong className="text-gray-100">Momentum:</strong>{' '}
              RSI at {lastRSI.toFixed(1)} — {rsiInterpretation.toLowerCase()}.
              {lastMACD && !isNaN(lastMACD.histogram) && (
                <> MACD histogram is {lastMACD.histogram > 0 ? 'positive' : 'negative'} and{' '}
                {histAccel > 0 ? 'accelerating' : 'decelerating'}, {lastMACD.histogram > 0 && histAccel > 0
                  ? 'reinforcing bullish momentum.'
                  : lastMACD.histogram < 0 && histAccel < 0
                    ? 'reinforcing bearish momentum.'
                    : 'suggesting momentum may be shifting.'}</>
              )}
            </p>
          )}
          {atrPct !== null && (
            <p>
              <strong className="text-gray-100">Volatility:</strong>{' '}
              ATR is {atrPct.toFixed(2)}% of price — {atrPct > 3 ? 'elevated, requiring wider stops.' : atrPct < 1 ? 'compressed, suggesting a potential squeeze breakout.' : 'normal trading conditions.'}{' '}
              {bbWidth !== null && bbWidth < 5 && 'Bollinger Bands are in a squeeze — a high-probability breakout setup may be forming.'}
            </p>
          )}
          {patterns.length > 0 && (
            <p>
              <strong className="text-gray-100">Price Action:</strong>{' '}
              {patterns[0].name} detected on the most recent candles
              ({patterns[0].type === 'bullish' ? 'bullish' : patterns[0].type === 'bearish' ? 'bearish' : 'neutral'} signal).
              {patterns.length > 1 && ` Also: ${patterns.slice(1, 3).map(p => p.name).join(', ')}.`}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
