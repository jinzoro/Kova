import { scoreSignal, calcMTFConsensus } from '../lib/scoring'
import type { Kline } from '../lib/binance'

function makeKlines(closes: number[]): Kline[] {
  return closes.map((c, i) => ({
    openTime: i * 3600000,
    open: c * 0.999,
    high: c * 1.005,
    low: c * 0.995,
    close: c,
    volume: 1000 + i * 10,
    closeTime: (i + 1) * 3600000,
  }))
}

describe('scoreSignal', () => {
  it('returns Neutral for < 30 klines', () => {
    const result = scoreSignal(makeKlines([100, 101, 102]))
    expect(result.label).toBe('Neutral')
    expect(result.total).toBe(0)
  })

  it('score is clamped to [-10, 10]', () => {
    const uptrend = Array.from({ length: 250 }, (_, i) => 100 + i * 2)
    const result = scoreSignal(makeKlines(uptrend))
    expect(result.total).toBeLessThanOrEqual(10)
    expect(result.total).toBeGreaterThanOrEqual(-10)
  })

  it('strong uptrend produces positive score', () => {
    const uptrend = Array.from({ length: 250 }, (_, i) => 100 + i * 2)
    const result = scoreSignal(makeKlines(uptrend))
    expect(result.total).toBeGreaterThan(0)
  })

  it('strong downtrend produces negative score', () => {
    const downtrend = Array.from({ length: 250 }, (_, i) => 600 - i * 2)
    const result = scoreSignal(makeKlines(downtrend))
    expect(result.total).toBeLessThan(0)
  })

  it('breakdown is non-empty when data is sufficient', () => {
    const prices = Array.from({ length: 250 }, (_, i) => 100 + Math.sin(i * 0.1) * 10)
    const result = scoreSignal(makeKlines(prices))
    expect(result.breakdown.length).toBeGreaterThan(0)
  })

  it('all breakdown values are integers', () => {
    const prices = Array.from({ length: 250 }, (_, i) => 100 + i * 0.1)
    const result = scoreSignal(makeKlines(prices))
    result.breakdown.forEach((b) => {
      expect(Number.isInteger(b.value)).toBe(true)
    })
  })
})

describe('calcMTFConsensus', () => {
  const strongBuy = { total: 8, label: 'Strong Buy' as const, breakdown: [] }
  const neutral = { total: 0, label: 'Neutral' as const, breakdown: [] }
  const strongSell = { total: -8, label: 'Strong Sell' as const, breakdown: [] }

  it('all bullish → positive weighted', () => {
    const result = calcMTFConsensus(strongBuy, strongBuy, strongBuy)
    expect(result.weighted).toBeGreaterThan(0)
  })

  it('all bearish → negative weighted', () => {
    const result = calcMTFConsensus(strongSell, strongSell, strongSell)
    expect(result.weighted).toBeLessThan(0)
  })

  it('1d has highest weight', () => {
    const result = calcMTFConsensus(strongSell, neutral, strongBuy)
    // 1d=3×8 = 24, 4h=2×0 = 0, 1h=1×(-8) = -8, total=16, weight=6 → ~2.67
    expect(result.weighted).toBeGreaterThan(0)
  })

  it('agreement label present', () => {
    const result = calcMTFConsensus(strongBuy, strongBuy, strongBuy)
    expect(['Strong Agreement', 'Agreement', 'Mixed', 'Disagreement']).toContain(result.agreement)
  })
})
