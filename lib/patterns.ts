/**
 * Candlestick pattern detection library.
 * All functions operate on Kline arrays and return detected pattern info.
 */

import type { Kline } from './binance'

export interface CandlePattern {
  name: string
  type: 'bullish' | 'bearish' | 'neutral'
  strength: 'strong' | 'moderate' | 'weak'
  description: string
  index: number
}

// ─── Candle geometry helpers ──────────────────────────────────────────────────

function body(k: Kline): number {
  return Math.abs(k.close - k.open)
}

function range(k: Kline): number {
  return k.high - k.low
}

function upperWick(k: Kline): number {
  return k.high - Math.max(k.open, k.close)
}

function lowerWick(k: Kline): number {
  return Math.min(k.open, k.close) - k.low
}

function isBull(k: Kline): boolean {
  return k.close > k.open
}

function isBear(k: Kline): boolean {
  return k.close < k.open
}

function bodyPct(k: Kline): number {
  return range(k) === 0 ? 0 : body(k) / range(k)
}

// ─── Pattern detectors ────────────────────────────────────────────────────────

/** Doji — open ≈ close, body < 10% of range */
function isDoji(k: Kline): boolean {
  return bodyPct(k) < 0.1 && range(k) > 0
}

/** Hammer — small body at top, long lower wick (≥2× body), tiny upper wick */
function isHammer(k: Kline): boolean {
  const b = body(k)
  const lw = lowerWick(k)
  const uw = upperWick(k)
  return b > 0 && lw >= 2 * b && uw <= 0.3 * b
}

/** Shooting Star — small body at bottom, long upper wick (≥2× body), tiny lower wick */
function isShootingStar(k: Kline): boolean {
  const b = body(k)
  const uw = upperWick(k)
  const lw = lowerWick(k)
  return b > 0 && uw >= 2 * b && lw <= 0.3 * b
}

/** Marubozu — body covers nearly entire range (>85%), very small wicks */
function isMarubozu(k: Kline): boolean {
  return bodyPct(k) > 0.85
}

/** Spinning Top — body < 30% of range, significant wicks both sides */
function isSpinningTop(k: Kline): boolean {
  return bodyPct(k) < 0.3 && upperWick(k) > body(k) && lowerWick(k) > body(k)
}

// ─── Multi-candle patterns ────────────────────────────────────────────────────

/** Bullish Engulfing: prev is bearish, curr bullish body fully covers prev body */
function isBullishEngulfing(prev: Kline, curr: Kline): boolean {
  return (
    isBear(prev) &&
    isBull(curr) &&
    curr.open < prev.close &&
    curr.close > prev.open
  )
}

/** Bearish Engulfing: prev is bullish, curr bearish body fully covers prev body */
function isBearishEngulfing(prev: Kline, curr: Kline): boolean {
  return (
    isBull(prev) &&
    isBear(curr) &&
    curr.open > prev.close &&
    curr.close < prev.open
  )
}

/** Bullish Harami: large bearish body contains a small bullish body */
function isBullishHarami(prev: Kline, curr: Kline): boolean {
  return (
    isBear(prev) &&
    isBull(curr) &&
    curr.open > prev.close &&
    curr.close < prev.open &&
    body(curr) < body(prev) * 0.5
  )
}

/** Bearish Harami: large bullish body contains a small bearish body */
function isBearishHarami(prev: Kline, curr: Kline): boolean {
  return (
    isBull(prev) &&
    isBear(curr) &&
    curr.open < prev.close &&
    curr.close > prev.open &&
    body(curr) < body(prev) * 0.5
  )
}

/** Morning Star: bearish → doji/small → bullish (3-candle) */
function isMorningStar(a: Kline, b: Kline, c: Kline): boolean {
  return (
    isBear(a) &&
    body(b) < body(a) * 0.3 &&
    isBull(c) &&
    c.close > (a.open + a.close) / 2
  )
}

/** Evening Star: bullish → doji/small → bearish (3-candle) */
function isEveningStar(a: Kline, b: Kline, c: Kline): boolean {
  return (
    isBull(a) &&
    body(b) < body(a) * 0.3 &&
    isBear(c) &&
    c.close < (a.open + a.close) / 2
  )
}

/** Three White Soldiers: 3 consecutive bullish marubozu-ish candles */
function isThreeWhiteSoldiers(a: Kline, b: Kline, c: Kline): boolean {
  return (
    isBull(a) && isBull(b) && isBull(c) &&
    bodyPct(a) > 0.6 && bodyPct(b) > 0.6 && bodyPct(c) > 0.6 &&
    b.open > a.open && b.close > a.close &&
    c.open > b.open && c.close > b.close
  )
}

/** Three Black Crows: 3 consecutive bearish marubozu-ish candles */
function isThreeBlackCrows(a: Kline, b: Kline, c: Kline): boolean {
  return (
    isBear(a) && isBear(b) && isBear(c) &&
    bodyPct(a) > 0.6 && bodyPct(b) > 0.6 && bodyPct(c) > 0.6 &&
    b.open < a.open && b.close < a.close &&
    c.open < b.open && c.close < b.close
  )
}

// ─── Main detector ────────────────────────────────────────────────────────────

/**
 * Scan the last N candles and return detected patterns, most recent first.
 */
export function detectPatterns(klines: Kline[], lookback = 10): CandlePattern[] {
  const patterns: CandlePattern[] = []
  const start = Math.max(0, klines.length - lookback)

  for (let i = start; i < klines.length; i++) {
    const k = klines[i]
    const prev = klines[i - 1]
    const prev2 = klines[i - 2]

    // Single-candle
    if (isDoji(k)) {
      patterns.push({
        name: 'Doji',
        type: 'neutral',
        strength: 'moderate',
        description: 'Open ≈ Close — buyers and sellers in equilibrium; watch for directional follow-through.',
        index: i,
      })
    }

    if (isHammer(k)) {
      patterns.push({
        name: isBull(k) ? 'Hammer' : 'Hanging Man',
        type: isBull(k) ? 'bullish' : 'bearish',
        strength: 'strong',
        description: isBull(k)
          ? 'Long lower wick rejected selling pressure — potential reversal from downtrend.'
          : 'Long lower wick in an uptrend — potential distribution / reversal warning.',
        index: i,
      })
    }

    if (isShootingStar(k)) {
      patterns.push({
        name: isBear(k) ? 'Shooting Star' : 'Inverted Hammer',
        type: isBear(k) ? 'bearish' : 'bullish',
        strength: 'strong',
        description: isBear(k)
          ? 'Long upper wick rejected rally attempt — bearish reversal signal at resistance.'
          : 'Long upper wick probing higher levels — bullish if confirmed by next candle.',
        index: i,
      })
    }

    if (isMarubozu(k)) {
      patterns.push({
        name: isBull(k) ? 'Bullish Marubozu' : 'Bearish Marubozu',
        type: isBull(k) ? 'bullish' : 'bearish',
        strength: 'strong',
        description: isBull(k)
          ? 'Full-body bullish candle with minimal wicks — strong buying conviction with no rejection.'
          : 'Full-body bearish candle with minimal wicks — strong selling conviction with no bounce.',
        index: i,
      })
    }

    if (isSpinningTop(k)) {
      patterns.push({
        name: 'Spinning Top',
        type: 'neutral',
        strength: 'weak',
        description: 'Small body with long wicks both sides — indecision; momentum likely stalling.',
        index: i,
      })
    }

    // Two-candle (need prev)
    if (prev) {
      if (isBullishEngulfing(prev, k)) {
        patterns.push({
          name: 'Bullish Engulfing',
          type: 'bullish',
          strength: 'strong',
          description: 'Current candle fully engulfs the prior bearish candle — strong reversal signal, especially near support.',
          index: i,
        })
      }
      if (isBearishEngulfing(prev, k)) {
        patterns.push({
          name: 'Bearish Engulfing',
          type: 'bearish',
          strength: 'strong',
          description: 'Current candle fully engulfs the prior bullish candle — strong reversal signal, especially near resistance.',
          index: i,
        })
      }
      if (isBullishHarami(prev, k)) {
        patterns.push({
          name: 'Bullish Harami',
          type: 'bullish',
          strength: 'moderate',
          description: 'Small bullish candle inside prior bearish — selling momentum may be exhausting.',
          index: i,
        })
      }
      if (isBearishHarami(prev, k)) {
        patterns.push({
          name: 'Bearish Harami',
          type: 'bearish',
          strength: 'moderate',
          description: 'Small bearish candle inside prior bullish — buying momentum may be fading.',
          index: i,
        })
      }
    }

    // Three-candle (need prev2)
    if (prev && prev2) {
      if (isMorningStar(prev2, prev, k)) {
        patterns.push({
          name: 'Morning Star',
          type: 'bullish',
          strength: 'strong',
          description: 'Classic 3-candle bottom reversal — bearish momentum exhausted, bulls regained control.',
          index: i,
        })
      }
      if (isEveningStar(prev2, prev, k)) {
        patterns.push({
          name: 'Evening Star',
          type: 'bearish',
          strength: 'strong',
          description: 'Classic 3-candle top reversal — bullish momentum exhausted, bears regained control.',
          index: i,
        })
      }
      if (isThreeWhiteSoldiers(prev2, prev, k)) {
        patterns.push({
          name: 'Three White Soldiers',
          type: 'bullish',
          strength: 'strong',
          description: '3 consecutive strong bullish candles — sustained buying pressure, trend likely accelerating upward.',
          index: i,
        })
      }
      if (isThreeBlackCrows(prev2, prev, k)) {
        patterns.push({
          name: 'Three Black Crows',
          type: 'bearish',
          strength: 'strong',
          description: '3 consecutive strong bearish candles — sustained selling pressure, trend likely accelerating downward.',
          index: i,
        })
      }
    }
  }

  // Return most recent first, deduplicate by name keeping latest
  const seen = new Set<string>()
  return patterns
    .reverse()
    .filter((p) => {
      if (seen.has(p.name)) return false
      seen.add(p.name)
      return true
    })
    .slice(0, 6)
}

// ─── Trend phase detection ────────────────────────────────────────────────────

export type TrendPhase =
  | 'Strong Uptrend'
  | 'Uptrend'
  | 'Sideways / Consolidation'
  | 'Downtrend'
  | 'Strong Downtrend'

export interface TrendAnalysis {
  phase: TrendPhase
  emaAlignment: 'Bullish Stack' | 'Bearish Stack' | 'Mixed'
  priceVsEMA200: 'Above' | 'Below' | 'N/A'
  consecutiveBullCandles: number
  consecutiveBearCandles: number
  recentBodyAvg: number     // avg candle body as % of price over last 10
  description: string
}

export function analyzeTrend(klines: Kline[], ema12: number[], ema26: number[], ema200: number[]): TrendAnalysis {
  const last = klines.length - 1
  const price = klines[last].close
  const e12 = ema12[last]
  const e26 = ema26[last]
  const e200 = ema200[last]

  const bullStack = !isNaN(e12) && !isNaN(e26) && !isNaN(e200) && e12 > e26 && e26 > e200
  const bearStack = !isNaN(e12) && !isNaN(e26) && !isNaN(e200) && e12 < e26 && e26 < e200
  const emaAlignment: TrendAnalysis['emaAlignment'] = bullStack ? 'Bullish Stack' : bearStack ? 'Bearish Stack' : 'Mixed'

  const priceVsEMA200: TrendAnalysis['priceVsEMA200'] = isNaN(e200) ? 'N/A' : price > e200 ? 'Above' : 'Below'

  // Consecutive candles
  let consecutiveBullCandles = 0
  let consecutiveBearCandles = 0
  for (let i = last; i >= 0; i--) {
    if (klines[i].close > klines[i].open) consecutiveBullCandles++
    else break
  }
  for (let i = last; i >= 0; i--) {
    if (klines[i].close < klines[i].open) consecutiveBearCandles++
    else break
  }

  // Average body size as % of price (last 10 candles)
  const recent = klines.slice(-10)
  const recentBodyAvg = recent.reduce((sum, k) => sum + body(k) / k.close, 0) / recent.length * 100

  // Determine phase
  let phase: TrendPhase
  if (bullStack && consecutiveBullCandles >= 3) phase = 'Strong Uptrend'
  else if (bullStack || (e12 > e26 && price > e200)) phase = 'Uptrend'
  else if (bearStack && consecutiveBearCandles >= 3) phase = 'Strong Downtrend'
  else if (bearStack || (e12 < e26 && price < e200)) phase = 'Downtrend'
  else phase = 'Sideways / Consolidation'

  const descriptions: Record<TrendPhase, string> = {
    'Strong Uptrend': `All three EMAs are stacked bullishly (EMA12 > EMA26 > EMA200) with ${consecutiveBullCandles} consecutive green candles. Price is well above long-term support. Bulls are firmly in control.`,
    'Uptrend': `Price is trending upward. EMA12 is above EMA26 and price trades ${!isNaN(e200) ? `${((price / e200 - 1) * 100).toFixed(1)}% above EMA200` : 'above key moving averages'}. Pullbacks toward EMAs are likely buying opportunities.`,
    'Sideways / Consolidation': `Mixed EMA signals suggest consolidation. Price is compressing — expect a breakout directional move. Watch for volume expansion to confirm direction.`,
    'Downtrend': `Price is in a downtrend. EMA12 is below EMA26 and price is under key moving averages. Rallies toward EMAs are potential short opportunities until structure changes.`,
    'Strong Downtrend': `Bearish EMA stack (EMA12 < EMA26 < EMA200) with ${consecutiveBearCandles} consecutive red candles. Bears are firmly in control. No long setups until price reclaims at least EMA26.`,
  }

  return {
    phase,
    emaAlignment,
    priceVsEMA200,
    consecutiveBullCandles,
    consecutiveBearCandles,
    recentBodyAvg,
    description: descriptions[phase],
  }
}
