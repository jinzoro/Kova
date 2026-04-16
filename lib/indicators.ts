/**
 * Technical Analysis indicator library.
 * All functions are pure — operate on plain number arrays or OHLCV objects.
 */

import type { Kline } from './binance'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BollingerBand {
  upper: number
  middle: number
  lower: number
}

export interface MACDResult {
  macd: number
  signal: number
  histogram: number
}

export interface SwingLevel {
  index: number
  price: number
  type: 'high' | 'low'
  time: number
}

// ─── EMA ─────────────────────────────────────────────────────────────────────

/**
 * Exponential Moving Average.
 * Returns an array the same length as prices; early values use SMA seed.
 */
export function calcEMA(prices: number[], period: number): number[] {
  if (prices.length === 0 || period <= 0) return []
  const k = 2 / (period + 1)
  const result: number[] = new Array(prices.length).fill(NaN)

  // Seed with SMA of first `period` values
  if (prices.length < period) return result
  let sum = 0
  for (let i = 0; i < period; i++) sum += prices[i]
  result[period - 1] = sum / period

  for (let i = period; i < prices.length; i++) {
    result[i] = prices[i] * k + result[i - 1] * (1 - k)
  }
  return result
}

// ─── RSI ─────────────────────────────────────────────────────────────────────

/**
 * Relative Strength Index using Wilder smoothing.
 * Returns NaN for the first `period` values.
 */
export function calcRSI(prices: number[], period = 14): number[] {
  if (prices.length < period + 1) return new Array(prices.length).fill(NaN)
  const result: number[] = new Array(prices.length).fill(NaN)

  // First average gain/loss
  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1]
    if (diff > 0) avgGain += diff
    else avgLoss += Math.abs(diff)
  }
  avgGain /= period
  avgLoss /= period

  const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs)

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1]
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? Math.abs(diff) : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    const r = avgLoss === 0 ? Infinity : avgGain / avgLoss
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + r)
  }
  return result
}

// ─── MACD ─────────────────────────────────────────────────────────────────────

/**
 * MACD = EMA12 − EMA26, signal = EMA9(MACD), histogram = MACD − signal.
 */
export function calcMACD(
  prices: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): MACDResult[] {
  const ema12 = calcEMA(prices, fastPeriod)
  const ema26 = calcEMA(prices, slowPeriod)
  const macdLine: number[] = prices.map((_, i) =>
    isNaN(ema12[i]) || isNaN(ema26[i]) ? NaN : ema12[i] - ema26[i],
  )

  // Signal = EMA9 of MACD line (skip NaN prefix)
  const validStart = macdLine.findIndex((v) => !isNaN(v))
  const signalInput = macdLine.slice(validStart)
  const signalRaw = calcEMA(signalInput, signalPeriod)

  const result: MACDResult[] = prices.map((_, i) => {
    const idx = i - validStart
    const macd = macdLine[i]
    const signal = idx >= 0 ? signalRaw[idx] : NaN
    return {
      macd: isNaN(macd) ? NaN : macd,
      signal: isNaN(signal) ? NaN : signal,
      histogram: isNaN(macd) || isNaN(signal) ? NaN : macd - signal,
    }
  })
  return result
}

// ─── Bollinger Bands ─────────────────────────────────────────────────────────

export function calcBollingerBands(
  prices: number[],
  period = 20,
  stdDevMult = 2,
): BollingerBand[] {
  return prices.map((_, i) => {
    if (i < period - 1) return { upper: NaN, middle: NaN, lower: NaN }
    const slice = prices.slice(i - period + 1, i + 1)
    const mean = slice.reduce((a, b) => a + b, 0) / period
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period
    const sd = Math.sqrt(variance)
    return {
      upper: mean + stdDevMult * sd,
      middle: mean,
      lower: mean - stdDevMult * sd,
    }
  })
}

// ─── ATR ─────────────────────────────────────────────────────────────────────

/**
 * Average True Range using Wilder smoothing.
 */
export function calcATR(klines: Kline[], period = 14): number[] {
  if (klines.length < 2) return new Array(klines.length).fill(NaN)
  const tr: number[] = [NaN]
  for (let i = 1; i < klines.length; i++) {
    const { high, low } = klines[i]
    const prevClose = klines[i - 1].close
    tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)))
  }

  const result: number[] = new Array(klines.length).fill(NaN)
  if (klines.length <= period) return result

  // Seed
  let atr = tr.slice(1, period + 1).reduce((a, b) => a + b, 0) / period
  result[period] = atr

  for (let i = period + 1; i < klines.length; i++) {
    atr = (atr * (period - 1) + tr[i]) / period
    result[i] = atr
  }
  return result
}

// ─── OBV ─────────────────────────────────────────────────────────────────────

/**
 * On-Balance Volume.
 */
export function calcOBV(klines: Kline[]): number[] {
  const result: number[] = [0]
  for (let i = 1; i < klines.length; i++) {
    const prev = klines[i - 1].close
    const curr = klines[i].close
    const vol = klines[i].volume
    if (curr > prev) result.push(result[i - 1] + vol)
    else if (curr < prev) result.push(result[i - 1] - vol)
    else result.push(result[i - 1])
  }
  return result
}

// ─── Stochastic RSI ───────────────────────────────────────────────────────────

/**
 * Stochastic RSI: (RSI − lowest RSI over period) / (highest − lowest)
 */
export function calcStochRSI(
  prices: number[],
  period = 14,
  smoothK = 3,
  smoothD = 3,
): { k: number; d: number }[] {
  const rsi = calcRSI(prices, period)
  const stoch: number[] = rsi.map((_, i) => {
    if (i < period * 2 - 1) return NaN
    const window = rsi.slice(i - period + 1, i + 1)
    const validWindow = window.filter((v) => !isNaN(v))
    if (validWindow.length < period) return NaN
    const lo = Math.min(...validWindow)
    const hi = Math.max(...validWindow)
    return hi === lo ? 50 : ((rsi[i] - lo) / (hi - lo)) * 100
  })

  // Smooth K and D
  const kSmoothed = calcEMA(stoch.map((v) => (isNaN(v) ? 0 : v)), smoothK)
  const dSmoothed = calcEMA(kSmoothed, smoothD)

  return stoch.map((_, i) => ({
    k: isNaN(stoch[i]) ? NaN : kSmoothed[i],
    d: isNaN(stoch[i]) ? NaN : dSmoothed[i],
  }))
}

// ─── Volume SMA ───────────────────────────────────────────────────────────────

export function calcVolumeSMA(klines: Kline[], period = 20): number[] {
  return klines.map((_, i) => {
    if (i < period - 1) return NaN
    const slice = klines.slice(i - period + 1, i + 1)
    return slice.reduce((a, k) => a + k.volume, 0) / period
  })
}

// ─── Swing Levels ─────────────────────────────────────────────────────────────

/**
 * Detect pivot swing highs and lows within a rolling window.
 */
export function detectSwingLevels(klines: Kline[], window = 5): SwingLevel[] {
  const levels: SwingLevel[] = []
  for (let i = window; i < klines.length - window; i++) {
    const slice = klines.slice(i - window, i + window + 1)
    const mid = klines[i]

    const isHigh = slice.every((k) => k.high <= mid.high)
    const isLow = slice.every((k) => k.low >= mid.low)

    if (isHigh) {
      levels.push({ index: i, price: mid.high, type: 'high', time: mid.openTime })
    }
    if (isLow && !isHigh) {
      levels.push({ index: i, price: mid.low, type: 'low', time: mid.openTime })
    }
  }
  return levels
}

// ─── Support & Resistance helpers ────────────────────────────────────────────

export interface SRLevel {
  price: number
  type: 'resistance' | 'support'
  strength: number  // how many times price tested this zone
}

export function getNearestSRLevels(
  klines: Kline[],
  currentPrice: number,
  count = 3,
): { resistance: SRLevel[]; support: SRLevel[] } {
  const swings = detectSwingLevels(klines)

  const resistances = swings
    .filter((s) => s.type === 'high' && s.price > currentPrice)
    .sort((a, b) => a.price - b.price)
    .slice(0, count)
    .map((s) => ({ price: s.price, type: 'resistance' as const, strength: 1 }))

  const supports = swings
    .filter((s) => s.type === 'low' && s.price < currentPrice)
    .sort((a, b) => b.price - a.price)
    .slice(0, count)
    .map((s) => ({ price: s.price, type: 'support' as const, strength: 1 }))

  return { resistance: resistances, support: supports }
}

// ─── VWAP ─────────────────────────────────────────────────────────────────────

/**
 * Cumulative Volume-Weighted Average Price.
 * tp = (high + low + close) / 3
 * VWAP = Σ(tp × volume) / Σ(volume)
 *
 * Resets when the calendar day (UTC) changes — so on 1h/4h charts each day
 * starts a fresh VWAP, matching the standard intraday interpretation.
 * On 1d/1w charts it accumulates across all candles (less conventional but still useful).
 */
export function calcVWAP(klines: Kline[]): number[] {
  const result: number[] = new Array(klines.length).fill(NaN)
  let cumTpV = 0
  let cumV = 0
  let prevDay = -1

  for (let i = 0; i < klines.length; i++) {
    const k = klines[i]
    const day = Math.floor(k.openTime / 86_400_000) // UTC day index

    if (day !== prevDay) {
      // New session — reset accumulator
      cumTpV = 0
      cumV = 0
      prevDay = day
    }

    const tp = (k.high + k.low + k.close) / 3
    cumTpV += tp * k.volume
    cumV += k.volume
    result[i] = cumV === 0 ? NaN : cumTpV / cumV
  }
  return result
}

// ─── ADX ─────────────────────────────────────────────────────────────────────

export interface ADXResult {
  adx: number    // Trend strength 0-100 (>25 = trending, >50 = strong)
  plusDI: number  // +DI (bullish directional pressure)
  minusDI: number // -DI (bearish directional pressure)
}

/**
 * Average Directional Index (Wilder, period=14).
 * adx > 25 → trending; < 20 → ranging/choppy.
 * +DI > -DI → bullish trend; -DI > +DI → bearish trend.
 */
export function calcADX(klines: Kline[], period = 14): ADXResult[] {
  const n = klines.length
  const result: ADXResult[] = new Array(n).fill({ adx: NaN, plusDI: NaN, minusDI: NaN })
  if (n < period * 2) return result

  const tr: number[] = [0]
  const plusDM: number[] = [0]
  const minusDM: number[] = [0]

  for (let i = 1; i < n; i++) {
    const { high, low } = klines[i]
    const prevHigh = klines[i - 1].high
    const prevLow = klines[i - 1].low
    const prevClose = klines[i - 1].close

    const upMove = high - prevHigh
    const downMove = prevLow - low

    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0)
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0)
    tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)))
  }

  // Wilder smooth over `period`
  const smooth = (arr: number[]) => {
    const out: number[] = new Array(n).fill(NaN)
    let sum = arr.slice(1, period + 1).reduce((a, b) => a + b, 0)
    out[period] = sum
    for (let i = period + 1; i < n; i++) {
      sum = sum - sum / period + arr[i]
      out[i] = sum
    }
    return out
  }

  const smoothTR = smooth(tr)
  const smoothPlus = smooth(plusDM)
  const smoothMinus = smooth(minusDM)

  const dx: number[] = new Array(n).fill(NaN)
  for (let i = period; i < n; i++) {
    const sTR = smoothTR[i]
    if (!sTR) continue
    const pdi = (smoothPlus[i] / sTR) * 100
    const mdi = (smoothMinus[i] / sTR) * 100
    const dxVal = Math.abs(pdi - mdi) / (pdi + mdi || 1) * 100
    dx[i] = dxVal
    result[i] = { adx: NaN, plusDI: pdi, minusDI: mdi }
  }

  // Smooth DX → ADX
  let adxSum = dx.slice(period, period * 2).filter(v => !isNaN(v)).reduce((a, b) => a + b, 0)
  const firstADXIdx = period * 2 - 1
  if (firstADXIdx < n) {
    let adx = adxSum / period
    const r0 = result[firstADXIdx]
    result[firstADXIdx] = { ...r0, adx }
    for (let i = firstADXIdx + 1; i < n; i++) {
      if (isNaN(dx[i])) continue
      adx = (adx * (period - 1) + dx[i]) / period
      result[i] = { ...result[i], adx }
    }
  }

  return result
}

// ─── Williams %R ──────────────────────────────────────────────────────────────

/**
 * Williams Percent Range. Range: 0 to -100.
 * > -20 → overbought; < -80 → oversold.
 */
export function calcWilliamsR(klines: Kline[], period = 14): number[] {
  return klines.map((_, i) => {
    if (i < period - 1) return NaN
    const slice = klines.slice(i - period + 1, i + 1)
    const highest = Math.max(...slice.map(k => k.high))
    const lowest = Math.min(...slice.map(k => k.low))
    if (highest === lowest) return -50
    return ((highest - klines[i].close) / (highest - lowest)) * -100
  })
}

// ─── Fibonacci Retracement Levels ─────────────────────────────────────────────

export interface FibLevel {
  ratio: number
  price: number
  label: string
}

/**
 * Fibonacci retracement levels from the recent high/low (last `lookback` candles).
 */
export function calcFibLevels(
  klines: Kline[],
  lookback = 50,
): { high: number; low: number; levels: FibLevel[] } {
  const slice = klines.slice(-lookback)
  const high = Math.max(...slice.map(k => k.high))
  const low  = Math.min(...slice.map(k => k.low))
  const diff = high - low
  return {
    high, low,
    levels: [
      { r: 0,     label: '0%'    },
      { r: 0.236, label: '23.6%' },
      { r: 0.382, label: '38.2%' },
      { r: 0.5,   label: '50%'   },
      { r: 0.618, label: '61.8%' },
      { r: 0.786, label: '78.6%' },
      { r: 1,     label: '100%'  },
    ].map(({ r, label }) => ({ ratio: r, price: high - diff * r, label })),
  }
}

// ─── Pivot Points (Classic) ───────────────────────────────────────────────────

export interface PivotPoints {
  pp: number
  r1: number; r2: number; r3: number
  s1: number; s2: number; s3: number
}

/** Classic daily pivot points based on the most recently closed candle. */
export function calcPivotPoints(klines: Kline[]): PivotPoints {
  const last = klines.length >= 2 ? klines[klines.length - 2] : klines[klines.length - 1]
  const { high: h, low: l, close: c } = last
  const pp = (h + l + c) / 3
  return {
    pp,
    r1: 2 * pp - l,   r2: pp + (h - l),       r3: h + 2 * (pp - l),
    s1: 2 * pp - h,   s2: pp - (h - l),        s3: l - 2 * (h - pp),
  }
}

// ─── RSI Divergence Detection ─────────────────────────────────────────────────

export type DivergenceSignal = 'bullish' | 'bearish' | null

/**
 * Bearish divergence: price makes higher high but RSI makes lower high.
 * Bullish divergence: price makes lower low but RSI makes higher low.
 */
export function detectRSIDivergence(
  klines: Kline[],
  rsiValues: number[],
  lookback = 40,
): DivergenceSignal {
  const n = Math.min(klines.length, rsiValues.length, lookback)
  if (n < 20) return null
  const pSlice = klines.slice(-n)
  const rSlice = rsiValues.slice(-n)
  const mid = Math.floor(n / 2)
  const valid = (arr: number[]) => arr.filter(v => !isNaN(v))

  const phPrev   = Math.max(...pSlice.slice(0, mid).map(k => k.high))
  const phRecent = Math.max(...pSlice.slice(mid).map(k => k.high))
  const plPrev   = Math.min(...pSlice.slice(0, mid).map(k => k.low))
  const plRecent = Math.min(...pSlice.slice(mid).map(k => k.low))
  const rhPrev   = Math.max(...valid(rSlice.slice(0, mid)))
  const rhRecent = Math.max(...valid(rSlice.slice(mid)))
  const rlPrev   = Math.min(...valid(rSlice.slice(0, mid)))
  const rlRecent = Math.min(...valid(rSlice.slice(mid)))

  if (phRecent > phPrev * 1.002 && rhRecent < rhPrev - 3) return 'bearish'
  if (plRecent < plPrev * 0.998 && rlRecent > rlPrev + 3) return 'bullish'
  return null
}
