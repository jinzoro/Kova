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
