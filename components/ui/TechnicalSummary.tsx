'use client'

import type { Kline } from '@/lib/binance'
import {
  calcEMA, calcRSI, calcMACD, calcATR, calcBollingerBands,
  calcADX, calcStochRSI, calcOBV, calcWilliamsR,
  calcFibLevels, calcPivotPoints, detectRSIDivergence,
  calcSqueezeMomentum, calcIchimoku,
} from '@/lib/indicators'
import { detectPatterns, analyzeTrend, detectWyckoffPhase } from '@/lib/patterns'
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

  // Extended indicators
  const adx       = calcADX(klines, 14)
  const stochRSI  = calcStochRSI(closes, 14, 3, 3)
  const obv       = calcOBV(klines)
  const willR     = calcWilliamsR(klines, 14)
  const fib       = calcFibLevels(klines, 50)
  const pivots    = calcPivotPoints(klines)
  const divergence = detectRSIDivergence(klines, rsi, 40)

  const lastRSI   = rsi[rsi.length - 1]
  const lastMACD  = macd[macd.length - 1]
  const lastATR   = atr[atr.length - 1]
  const lastBB    = bb[bb.length - 1]
  const lastEMA12  = ema12[ema12.length - 1]
  const lastEMA26  = ema26[ema26.length - 1]
  const lastEMA50  = ema50[ema50.length - 1]
  const lastEMA200 = ema200[ema200.length - 1]

  // Extended last values
  const lastADX      = adx[adx.length - 1]
  const lastStoch    = stochRSI[stochRSI.length - 1]
  const lastOBV      = obv[obv.length - 1]
  const prevOBV      = obv[obv.length - 6] ?? 0   // 5-period OBV trend
  const lastWillR    = willR[willR.length - 1]

  // Patterns
  const patterns = detectPatterns(klines, 15)

  // Trend analysis
  const trend = analyzeTrend(klines, ema12, ema26, ema200)

  // Squeeze Momentum
  const squeeze = calcSqueezeMomentum(klines)
  const lastSqz = squeeze[squeeze.length - 1]

  // Ichimoku Cloud
  const ichimoku = calcIchimoku(klines)
  const lastIchi = ichimoku[ichimoku.length - 1]
  const prevIchi = ichimoku[ichimoku.length - 2]

  // Wyckoff Phase
  const wyckoff = detectWyckoffPhase(klines)

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

      {/* ── Divergence Alert ─────────────────────────────────────────────── */}
      {divergence && (
        <div className={`card border ${divergence === 'bullish' ? 'border-green-500/40 bg-green-500/5' : 'border-amber-500/40 bg-amber-500/5'}`}>
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none mt-0.5">{divergence === 'bullish' ? '📈' : '📉'}</span>
            <div>
              <div className={`text-sm font-bold ${divergence === 'bullish' ? 'text-bull' : 'text-warn'}`}>
                {divergence === 'bullish' ? 'Bullish RSI Divergence Detected' : 'Bearish RSI Divergence Detected'}
              </div>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                {divergence === 'bullish'
                  ? 'Price made a lower low but RSI made a higher low — selling momentum is weakening. This is a classic early reversal signal. Confirm with volume and structure before acting.'
                  : 'Price made a higher high but RSI made a lower high — buying momentum is fading on the way up. This is a bearish warning sign. Watch for a potential trend reversal or distribution phase.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── ADX + Directional Index ───────────────────────────────────────── */}
      {lastADX && !isNaN(lastADX.adx) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-gray-300">ADX — Trend Strength</h3>
            <div className="flex items-center gap-4">
              <div className="text-center shrink-0">
                <div className={`text-3xl font-mono font-bold ${
                  lastADX.adx > 50 ? 'text-bull' :
                  lastADX.adx > 25 ? 'text-blue-400' :
                  'text-gray-400'
                }`}>
                  {lastADX.adx.toFixed(0)}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">ADX (14)</div>
              </div>
              <div className="flex-1 space-y-2 text-xs">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-bull">+DI (bullish)</span>
                    <span className="font-mono font-bold text-bull">{lastADX.plusDI.toFixed(1)}</span>
                  </div>
                  <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden">
                    <div className="h-full bg-bull rounded-full" style={{ width: `${Math.min(100, lastADX.plusDI)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-bear">−DI (bearish)</span>
                    <span className="font-mono font-bold text-bear">{lastADX.minusDI.toFixed(1)}</span>
                  </div>
                  <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden">
                    <div className="h-full bg-bear rounded-full" style={{ width: `${Math.min(100, lastADX.minusDI)}%` }} />
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              {lastADX.adx < 20
                ? 'ADX below 20 — market is ranging/choppy. Trend-following strategies have low edge here.'
                : lastADX.adx < 25
                  ? 'ADX borderline — weak trend developing. Wait for confirmation above 25.'
                  : lastADX.adx < 40
                    ? `ADX ${lastADX.adx.toFixed(0)} — ${lastADX.plusDI > lastADX.minusDI ? 'bullish' : 'bearish'} trend in play. ${lastADX.plusDI > lastADX.minusDI ? '+DI dominant' : '-DI dominant'}, trend-following is valid.`
                    : lastADX.adx < 60
                      ? `ADX ${lastADX.adx.toFixed(0)} — strong trend. ${lastADX.plusDI > lastADX.minusDI ? 'Bulls are firmly in control.' : 'Bears are firmly in control.'}`
                      : `ADX ${lastADX.adx.toFixed(0)} — extremely strong trend. Momentum is very high; watch for exhaustion near round numbers.`}
            </p>
          </div>

          {/* Stochastic RSI */}
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-gray-300">Stochastic RSI</h3>
            {lastStoch && !isNaN(lastStoch.k) ? (
              <>
                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-blue-400">%K (fast)</span>
                      <span className={`font-mono font-bold ${lastStoch.k > 80 ? 'text-bear' : lastStoch.k < 20 ? 'text-bull' : 'text-blue-300'}`}>
                        {lastStoch.k.toFixed(1)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden relative">
                      <div className="absolute h-full w-px bg-gray-600" style={{ left: '80%' }} />
                      <div className="absolute h-full w-px bg-gray-600" style={{ left: '20%' }} />
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${lastStoch.k}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-orange-400">%D (signal)</span>
                      <span className={`font-mono font-bold ${lastStoch.d > 80 ? 'text-bear' : lastStoch.d < 20 ? 'text-bull' : 'text-orange-300'}`}>
                        {lastStoch.d.toFixed(1)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500 rounded-full" style={{ width: `${lastStoch.d}%` }} />
                    </div>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-600 font-mono">
                  <span>Oversold (20)</span>
                  <span>Overbought (80)</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {lastStoch.k > 80 && lastStoch.d > 80
                    ? 'Both lines above 80 — overbought. A %K cross below %D here is a short-term sell signal.'
                    : lastStoch.k < 20 && lastStoch.d < 20
                      ? 'Both lines below 20 — oversold. A %K cross above %D here is a short-term buy signal.'
                      : lastStoch.k > lastStoch.d
                        ? '%K above %D — short-term bullish momentum. Watch for overbought cross.'
                        : '%K below %D — short-term bearish momentum. Watch for oversold cross.'}
                </p>
              </>
            ) : (
              <div className="text-xs text-gray-600">Insufficient data (need 28+ candles)</div>
            )}
          </div>
        </div>
      )}

      {/* ── OBV + Williams %R ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-gray-300">OBV — Volume Pressure</h3>
          <div className="flex items-center gap-4">
            <div className="text-center shrink-0">
              <div className={`text-2xl leading-none ${lastOBV > prevOBV ? 'text-bull' : 'text-bear'}`}>
                {lastOBV > prevOBV ? '↑' : '↓'}
              </div>
              <div className="text-xs text-gray-500 mt-1">Trend</div>
            </div>
            <div className="flex-1 text-xs text-gray-400 leading-relaxed">
              {lastOBV > prevOBV
                ? 'OBV is rising — buyers are absorbing more volume than sellers over the last 5 periods. Smart money may be accumulating.'
                : 'OBV is falling — sellers are dominant on volume. Distribution may be occurring; be cautious on longs.'}
              {Math.abs(lastOBV - prevOBV) / Math.max(Math.abs(prevOBV), 1) > 0.05 && (
                <span className="block mt-1 font-medium">Significant 5-period OBV shift detected — trend has conviction.</span>
              )}
            </div>
          </div>
        </div>

        {!isNaN(lastWillR) && (
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-gray-300">Williams %R</h3>
            <div className="space-y-1">
              <MeterBar
                label={`W%R (14) — ${lastWillR > -20 ? 'Overbought' : lastWillR < -80 ? 'Oversold' : 'Neutral'}`}
                value={-lastWillR}
                min={0}
                max={100}
                lowColor="text-bear"
                highColor="text-bull"
              />
              <div className="flex justify-between text-xs text-gray-600 font-mono">
                <span>Overbought (0 to -20)</span>
                <span>Oversold (-80 to -100)</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              {lastWillR > -20
                ? `W%R at ${lastWillR.toFixed(1)} — severely overbought. High probability of a short-term pullback.`
                : lastWillR < -80
                  ? `W%R at ${lastWillR.toFixed(1)} — oversold. Potential bounce zone, watch for confirmation candle.`
                  : `W%R at ${lastWillR.toFixed(1)} — neutral territory. No extreme reading.`}
            </p>
          </div>
        )}
      </div>

      {/* ── Fibonacci Retracement ─────────────────────────────────────────── */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-300">Fibonacci Retracement</h3>
          <span className="text-xs text-gray-600">Based on last 50 candles</span>
        </div>
        <div className="text-xs text-gray-500 mb-2">
          Swing: <span className="font-mono text-bear">${fmtPrice(fib.low)}</span>
          {' → '}
          <span className="font-mono text-bull">${fmtPrice(fib.high)}</span>
          <span className="ml-2 text-gray-600">({(((fib.high - fib.low) / fib.low) * 100).toFixed(2)}% range)</span>
        </div>
        <div className="space-y-0.5">
          {fib.levels.map(({ ratio, price: lvlPrice, label }) => {
            const isCurrentZone = Math.abs(price - lvlPrice) / price < 0.005
            const abovePrice = lvlPrice > price
            const isMajor = [0.382, 0.5, 0.618].includes(ratio)
            return (
              <div
                key={label}
                className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs ${
                  isCurrentZone ? 'bg-amber-500/15 border border-amber-500/30' :
                  isMajor ? 'bg-surface-muted' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`font-mono w-12 ${isMajor ? 'font-bold text-gray-200' : 'text-gray-500'}`}>
                    {label}
                  </span>
                  {isCurrentZone && (
                    <span className="text-xs text-amber-400 font-medium">← current zone</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-mono ${abovePrice ? 'text-bear' : 'text-bull'}`}>
                    ${fmtPrice(lvlPrice)}
                  </span>
                  <span className="text-gray-600 w-20 text-right">
                    {abovePrice ? '+' : ''}{(((lvlPrice - price) / price) * 100).toFixed(2)}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-gray-600">
          Fibonacci levels act as natural support and resistance. The 38.2%, 50%, and 61.8% levels are the most significant. Price near a major fib level combined with volume confirmation is a high-probability trade setup.
        </p>
      </div>

      {/* ── Pivot Points ──────────────────────────────────────────────────── */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-300">Pivot Points (Classic)</h3>
          <span className="text-xs text-gray-600">Based on previous candle</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {/* Resistances */}
          {[
            { label: 'R3', value: pivots.r3, isRes: true },
            { label: 'R2', value: pivots.r2, isRes: true },
            { label: 'R1', value: pivots.r1, isRes: true },
          ].map(({ label, value, isRes }) => (
            <div key={label} className={`p-2 rounded-lg text-center ${Math.abs(price - value) / price < 0.005 ? 'bg-bear/20 border border-bear/30' : 'bg-red-500/8 border border-red-500/15'}`}>
              <div className="text-gray-500 font-mono">{label}</div>
              <div className="font-mono font-bold text-bear mt-0.5">${fmtPrice(value)}</div>
              <div className="text-gray-600 mt-0.5">{isRes && ((value - price) / price * 100).toFixed(2)}%</div>
            </div>
          ))}
          {/* PP */}
          <div className={`p-2 rounded-lg text-center ${Math.abs(price - pivots.pp) / price < 0.003 ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-blue-500/8 border border-blue-500/20'}`}>
            <div className="text-gray-400 font-mono font-bold">PP</div>
            <div className="font-mono font-bold text-blue-300 mt-0.5">${fmtPrice(pivots.pp)}</div>
            <div className="text-gray-600 mt-0.5">{((pivots.pp - price) / price * 100).toFixed(2)}%</div>
          </div>
          {/* Supports */}
          {[
            { label: 'S1', value: pivots.s1 },
            { label: 'S2', value: pivots.s2 },
            { label: 'S3', value: pivots.s3 },
          ].map(({ label, value }) => (
            <div key={label} className={`p-2 rounded-lg text-center ${Math.abs(price - value) / price < 0.005 ? 'bg-bull/20 border border-bull/30' : 'bg-green-500/8 border border-green-500/15'}`}>
              <div className="text-gray-500 font-mono">{label}</div>
              <div className="font-mono font-bold text-bull mt-0.5">${fmtPrice(value)}</div>
              <div className="text-gray-600 mt-0.5">{((value - price) / price * 100).toFixed(2)}%</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600">
          {price > pivots.pp
            ? `Price is above the Pivot Point — bullish bias for this session. R1 at $${fmtPrice(pivots.r1)} is the next major target.`
            : `Price is below the Pivot Point — bearish bias for this session. S1 at $${fmtPrice(pivots.s1)} is the nearest key support.`}
        </p>
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

      {/* ── Squeeze Momentum ─────────────────────────────────────────────── */}
      {lastSqz && !isNaN(lastSqz.momentum) && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-300">Squeeze Momentum (Lazybear)</h3>
            <span className={`text-xs font-medium px-2 py-0.5 rounded border ${
              lastSqz.sqzOn
                ? 'bg-amber-500/10 text-warn border-amber-500/30'
                : lastSqz.sqzOff
                  ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                  : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
            }`}>
              {lastSqz.sqzOn ? 'SQUEEZE ON' : lastSqz.sqzOff ? 'SQUEEZE FIRED' : 'No Squeeze'}
            </span>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className={`text-2xl font-mono font-bold ${lastSqz.momentum > 0 ? 'text-bull' : 'text-bear'}`}>
                {lastSqz.momentum > 0 ? '+' : ''}{lastSqz.momentum.toFixed(4)}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">Momentum</div>
            </div>
            <div className="text-center">
              <div className={`text-lg font-bold ${lastSqz.rising ? 'text-bull' : 'text-bear'}`}>
                {lastSqz.rising ? '▲ Rising' : '▼ Falling'}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">Direction</div>
            </div>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            {lastSqz.sqzOn
              ? 'Bollinger Bands are inside Keltner Channels — volatility is compressed. An explosive directional move is likely building. Wait for the squeeze to release before entering.'
              : lastSqz.sqzOff
                ? `Squeeze just released! Momentum is ${lastSqz.momentum > 0 ? 'positive and' : 'negative and'} ${lastSqz.rising ? 'rising' : 'falling'} — this is the highest-probability entry window.`
                : `No active squeeze. Momentum is ${lastSqz.momentum > 0 ? 'positive' : 'negative'} and ${lastSqz.rising ? 'accelerating' : 'decelerating'}.`}
          </p>
        </div>
      )}

      {/* ── Ichimoku Cloud ────────────────────────────────────────────────── */}
      {lastIchi && !isNaN(lastIchi.tenkan) && !isNaN(lastIchi.kijun) && (
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-gray-300">Ichimoku Cloud</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {[
              { label: 'Tenkan-sen (9)', val: lastIchi.tenkan, color: 'text-blue-300' },
              { label: 'Kijun-sen (26)', val: lastIchi.kijun,  color: 'text-orange-300' },
              { label: 'Senkou A',       val: lastIchi.senkouA, color: 'text-green-300' },
              { label: 'Senkou B',       val: lastIchi.senkouB, color: 'text-red-300' },
            ].map(({ label, val, color }) => (
              <div key={label} className="p-2 bg-surface-muted rounded-lg text-center">
                <div className="text-gray-500 mb-1">{label}</div>
                <div className={`font-mono font-bold ${color}`}>
                  {isNaN(val) ? 'N/A' : `$${fmtPrice(val)}`}
                </div>
                {!isNaN(val) && (
                  <div className={`text-xs mt-0.5 ${val > price ? 'text-bear' : 'text-bull'}`}>
                    {((val - price) / price * 100).toFixed(2)}%
                  </div>
                )}
              </div>
            ))}
          </div>

          {(() => {
            const aboveCloud = !isNaN(lastIchi.senkouA) && !isNaN(lastIchi.senkouB) &&
              price > Math.max(lastIchi.senkouA, lastIchi.senkouB)
            const belowCloud = !isNaN(lastIchi.senkouA) && !isNaN(lastIchi.senkouB) &&
              price < Math.min(lastIchi.senkouA, lastIchi.senkouB)
            const tkBullish = !isNaN(lastIchi.tenkan) && !isNaN(lastIchi.kijun) && lastIchi.tenkan > lastIchi.kijun
            const tkCross = prevIchi && !isNaN(prevIchi.tenkan) && !isNaN(prevIchi.kijun) &&
              ((lastIchi.tenkan > lastIchi.kijun) !== (prevIchi.tenkan > prevIchi.kijun))
            const cloudBull = !isNaN(lastIchi.senkouA) && !isNaN(lastIchi.senkouB) &&
              lastIchi.senkouA > lastIchi.senkouB

            return (
              <div className="space-y-2 text-xs">
                <div className="flex flex-wrap gap-2">
                  <span className={`px-2 py-0.5 rounded border text-xs font-medium ${
                    aboveCloud ? 'bg-green-500/10 text-bull border-green-500/30'
                    : belowCloud ? 'bg-red-500/10 text-bear border-red-500/30'
                    : 'bg-amber-500/10 text-warn border-amber-500/30'
                  }`}>
                    {aboveCloud ? 'Above Cloud (bullish)' : belowCloud ? 'Below Cloud (bearish)' : 'Inside Cloud (neutral)'}
                  </span>
                  <span className={`px-2 py-0.5 rounded border text-xs font-medium ${
                    tkBullish ? 'bg-green-500/10 text-bull border-green-500/30' : 'bg-red-500/10 text-bear border-red-500/30'
                  }`}>
                    TK {tkBullish ? 'Bullish' : 'Bearish'}
                    {tkCross && <span className="ml-1 font-bold">(CROSS!)</span>}
                  </span>
                  <span className={`px-2 py-0.5 rounded border text-xs font-medium ${
                    cloudBull ? 'bg-green-500/10 text-bull border-green-500/30' : 'bg-red-500/10 text-bear border-red-500/30'
                  }`}>
                    {cloudBull ? 'Green Cloud' : 'Red Cloud'}
                  </span>
                </div>
                <p className="text-gray-500 leading-relaxed">
                  {aboveCloud && tkBullish
                    ? 'Price above the cloud with Tenkan above Kijun — strong bullish Ichimoku structure. The cloud acts as layered support below.'
                    : belowCloud && !tkBullish
                      ? 'Price below the cloud with Tenkan below Kijun — strong bearish Ichimoku structure. The cloud acts as layered resistance above.'
                      : aboveCloud
                        ? 'Price above the cloud but TK cross is mixed — moderate bullish. Watch for Tenkan to cross above Kijun for confirmation.'
                        : belowCloud
                          ? 'Price below the cloud — bearish. Even short-term rallies may stall at the cloud.'
                          : 'Price inside the cloud — indecision zone. Breakout above cloud = bullish; breakdown below = bearish.'}
                </p>
              </div>
            )
          })()}
        </div>
      )}

      {/* ── Wyckoff Phase ─────────────────────────────────────────────────── */}
      {wyckoff.phase !== 'Undetermined' && (
        <div className={`card border space-y-2 ${
          wyckoff.phase === 'Accumulation' || wyckoff.phase === 'Markup'
            ? 'border-green-500/30 bg-green-500/5'
            : 'border-red-500/30 bg-red-500/5'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">Wyckoff Phase</div>
              <div className={`text-base font-bold ${
                wyckoff.phase === 'Accumulation' || wyckoff.phase === 'Markup' ? 'text-bull' : 'text-bear'
              }`}>
                {wyckoff.phase}
              </div>
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded border ${
              wyckoff.confidence === 'High'
                ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                : wyckoff.confidence === 'Medium'
                  ? 'bg-amber-500/10 text-warn border-amber-500/30'
                  : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
            }`}>
              {wyckoff.confidence} Confidence
            </span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">{wyckoff.description}</p>
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
