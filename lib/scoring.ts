/**
 * Signal Scoring Engine.
 * Produces a composite score from -10 to +10 with per-indicator breakdown.
 */

import type { Kline } from './binance'
import {
  calcEMA,
  calcRSI,
  calcMACD,
  calcBollingerBands,
  calcOBV,
} from './indicators'

export type SignalLabel =
  | 'Strong Buy'
  | 'Buy'
  | 'Neutral'
  | 'Sell'
  | 'Strong Sell'

export interface IndicatorBreakdown {
  indicator: string
  value: number
  reason: string
}

export interface SignalScore {
  total: number              // clamped -10 to +10
  label: SignalLabel
  breakdown: IndicatorBreakdown[]
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function labelFromScore(total: number): SignalLabel {
  if (total >= 6) return 'Strong Buy'
  if (total >= 2) return 'Buy'
  if (total > -2) return 'Neutral'
  if (total > -6) return 'Sell'
  return 'Strong Sell'
}

/**
 * Compute composite signal score from an array of OHLCV klines.
 */
export function scoreSignal(klines: Kline[]): SignalScore {
  if (klines.length < 30) {
    return { total: 0, label: 'Neutral', breakdown: [] }
  }

  const closes = klines.map((k) => k.close)
  const current = closes[closes.length - 1]
  const breakdown: IndicatorBreakdown[] = []
  let raw = 0

  // ── EMA 12/26 crossover ──────────────────────────────────────────────────
  const ema12 = calcEMA(closes, 12)
  const ema26 = calcEMA(closes, 26)
  const e12 = ema12[ema12.length - 1]
  const e26 = ema26[ema26.length - 1]
  const e12Prev = ema12[ema12.length - 2]
  const e26Prev = ema26[ema26.length - 2]

  if (!isNaN(e12) && !isNaN(e26)) {
    const crossedAbove = e12 > e26 && e12Prev <= e26Prev
    const crossedBelow = e12 < e26 && e12Prev >= e26Prev
    const bullish = e12 > e26
    const score = crossedAbove ? 2 : crossedBelow ? -2 : bullish ? 1 : -1
    raw += score
    breakdown.push({
      indicator: 'EMA 12/26',
      value: score,
      reason: crossedAbove
        ? 'Bullish crossover'
        : crossedBelow
          ? 'Bearish crossover'
          : bullish
            ? 'EMA12 above EMA26'
            : 'EMA12 below EMA26',
    })
  }

  // ── Price vs EMA 200 ─────────────────────────────────────────────────────
  const ema200 = calcEMA(closes, 200)
  const e200 = ema200[ema200.length - 1]
  if (!isNaN(e200)) {
    const score = current > e200 ? 2 : -2
    raw += score
    breakdown.push({
      indicator: 'EMA 200',
      value: score,
      reason: current > e200
        ? `Price ${((current / e200 - 1) * 100).toFixed(1)}% above EMA200`
        : `Price ${((1 - current / e200) * 100).toFixed(1)}% below EMA200`,
    })
  }

  // ── RSI ──────────────────────────────────────────────────────────────────
  const rsiArr = calcRSI(closes, 14)
  const rsi = rsiArr[rsiArr.length - 1]
  if (!isNaN(rsi)) {
    let score = 0
    let reason = ''
    if (rsi < 30) { score = 2; reason = `RSI ${rsi.toFixed(1)} — oversold` }
    else if (rsi >= 30 && rsi < 40) { score = 1; reason = `RSI ${rsi.toFixed(1)} — approaching oversold` }
    else if (rsi >= 40 && rsi <= 60) { score = 1; reason = `RSI ${rsi.toFixed(1)} — neutral momentum` }
    else if (rsi > 60 && rsi <= 70) { score = -1; reason = `RSI ${rsi.toFixed(1)} — approaching overbought` }
    else { score = -2; reason = `RSI ${rsi.toFixed(1)} — overbought` }
    raw += score
    breakdown.push({ indicator: 'RSI (14)', value: score, reason })
  }

  // ── MACD histogram ───────────────────────────────────────────────────────
  const macdArr = calcMACD(closes)
  const macd = macdArr[macdArr.length - 1]
  const macdPrev = macdArr[macdArr.length - 2]
  if (macd && !isNaN(macd.histogram) && macdPrev && !isNaN(macdPrev.histogram)) {
    const h = macd.histogram
    const hPrev = macdPrev.histogram
    let score = 0
    let reason = ''
    if (h > 0 && h > hPrev) { score = 2; reason = `Histogram +${h.toFixed(4)}, accelerating` }
    else if (h > 0) { score = 1; reason = `Histogram +${h.toFixed(4)}, positive` }
    else if (h < 0 && h < hPrev) { score = -2; reason = `Histogram ${h.toFixed(4)}, accelerating down` }
    else if (h < 0) { score = -1; reason = `Histogram ${h.toFixed(4)}, negative` }
    raw += score
    breakdown.push({ indicator: 'MACD Histogram', value: score, reason })
  }

  // ── Bollinger Bands ──────────────────────────────────────────────────────
  const bbArr = calcBollingerBands(closes, 20, 2)
  const bb = bbArr[bbArr.length - 1]
  if (bb && !isNaN(bb.upper)) {
    let score = 0
    let reason = ''
    if (current <= bb.lower) { score = 1; reason = `Price at/below lower BB (${bb.lower.toFixed(2)})` }
    else if (current >= bb.upper) { score = -1; reason = `Price at/above upper BB (${bb.upper.toFixed(2)})` }
    else if (current >= bb.middle) { score = 1; reason = `Price above BB midline` }
    else { score = -1; reason = `Price below BB midline` }
    raw += score
    breakdown.push({ indicator: 'Bollinger Bands', value: score, reason })
  }

  // ── OBV 5-bar trend ──────────────────────────────────────────────────────
  const obvArr = calcOBV(klines)
  if (obvArr.length >= 6) {
    const recentOBV = obvArr.slice(-6)
    const obvUp = recentOBV[5] > recentOBV[0]
    const score = obvUp ? 1 : -1
    raw += score
    breakdown.push({
      indicator: 'OBV Trend',
      value: score,
      reason: obvUp ? 'OBV rising (accumulation)' : 'OBV falling (distribution)',
    })
  }

  const total = clamp(Math.round(raw), -10, 10)
  return { total, label: labelFromScore(total), breakdown }
}

// ── Multi-timeframe consensus ─────────────────────────────────────────────────

export interface MTFScore {
  timeframe: string
  score: SignalScore
  weight: number
}

export interface MTFConsensus {
  weighted: number
  label: SignalLabel
  agreement: 'Strong Agreement' | 'Agreement' | 'Mixed' | 'Disagreement'
  scores: MTFScore[]
}

export function calcMTFConsensus(
  entries: Array<{ timeframe: string; score: SignalScore; weight: number }>,
): MTFConsensus {
  const scores: MTFScore[] = entries.map((e) => ({
    timeframe: e.timeframe,
    score: e.score,
    weight: e.weight,
  }))

  const totalWeight = scores.reduce((a, s) => a + s.weight, 0)
  const weighted = scores.reduce((a, s) => a + s.score.total * s.weight, 0) / totalWeight
  const rounded = clamp(Math.round(weighted), -10, 10)

  const allBull = scores.every((s) => s.score.total > 0)
  const allBear = scores.every((s) => s.score.total < 0)
  const allSame = scores.every((s) => s.score.label === scores[0].score.label)

  const agreement = allSame
    ? 'Strong Agreement'
    : allBull || allBear
      ? 'Agreement'
      : Math.abs(weighted) > 2
        ? 'Mixed'
        : 'Disagreement'

  return {
    weighted: rounded,
    label: labelFromScore(rounded),
    agreement,
    scores,
  }
}
