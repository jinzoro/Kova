import {
  calcEMA,
  calcRSI,
  calcMACD,
  calcBollingerBands,
  calcATR,
  calcOBV,
  calcStochRSI,
  detectSwingLevels,
} from '../lib/indicators'
import type { Kline } from '../lib/binance'

// Synthetic price series — linear ramp + sine wave
function makePrices(n: number): number[] {
  return Array.from({ length: n }, (_, i) => 100 + i * 0.5 + Math.sin(i * 0.3) * 5)
}

function makeKlines(n: number): Kline[] {
  const prices = makePrices(n + 1)
  return Array.from({ length: n }, (_, i) => ({
    openTime: (1_700_000_000 + i * 3600) * 1000,
    open: prices[i],
    high: prices[i] * 1.01,
    low: prices[i] * 0.99,
    close: prices[i + 1],
    volume: 1000 + Math.random() * 500,
    closeTime: (1_700_000_000 + (i + 1) * 3600) * 1000,
  }))
}

describe('calcEMA', () => {
  it('returns correct length', () => {
    const prices = makePrices(50)
    expect(calcEMA(prices, 12)).toHaveLength(50)
  })

  it('first period-1 values are NaN', () => {
    const prices = makePrices(30)
    const ema = calcEMA(prices, 12)
    for (let i = 0; i < 11; i++) expect(isNaN(ema[i])).toBe(true)
  })

  it('seed equals SMA for position period-1', () => {
    const prices = makePrices(20)
    const ema = calcEMA(prices, 5)
    const sma5 = prices.slice(0, 5).reduce((a, b) => a + b, 0) / 5
    expect(ema[4]).toBeCloseTo(sma5, 6)
  })

  it('short period responds quickly', () => {
    const prices = [100, 100, 100, 100, 100, 200]
    const ema = calcEMA(prices, 2)
    expect(ema[5]).toBeGreaterThan(100)
    expect(ema[5]).toBeLessThanOrEqual(200)
  })
})

describe('calcRSI', () => {
  it('returns correct length', () => {
    const prices = makePrices(50)
    expect(calcRSI(prices, 14)).toHaveLength(50)
  })

  it('all upward prices give RSI ~100', () => {
    const prices = Array.from({ length: 30 }, (_, i) => i + 1)
    const rsi = calcRSI(prices, 14)
    const last = rsi[rsi.length - 1]
    expect(last).toBeGreaterThan(95)
  })

  it('all downward prices give RSI ~0', () => {
    const prices = Array.from({ length: 30 }, (_, i) => 100 - i)
    const rsi = calcRSI(prices, 14)
    const last = rsi[rsi.length - 1]
    expect(last).toBeLessThan(5)
  })

  it('RSI is bounded 0-100', () => {
    const prices = makePrices(100)
    const rsi = calcRSI(prices, 14)
    rsi.filter((v) => !isNaN(v)).forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    })
  })
})

describe('calcMACD', () => {
  it('returns same length as input', () => {
    const prices = makePrices(60)
    expect(calcMACD(prices)).toHaveLength(60)
  })

  it('histogram = macd - signal', () => {
    const prices = makePrices(60)
    const macd = calcMACD(prices)
    macd.filter((m) => !isNaN(m.histogram)).forEach((m) => {
      expect(m.histogram).toBeCloseTo(m.macd - m.signal, 8)
    })
  })
})

describe('calcBollingerBands', () => {
  it('upper > middle > lower for valid values', () => {
    const prices = makePrices(50)
    const bb = calcBollingerBands(prices, 20, 2)
    bb.filter((b) => !isNaN(b.upper)).forEach((b) => {
      expect(b.upper).toBeGreaterThan(b.middle)
      expect(b.middle).toBeGreaterThan(b.lower)
    })
  })

  it('flat prices give zero-width band (upper == lower)', () => {
    const prices = new Array(30).fill(100)
    const bb = calcBollingerBands(prices, 20, 2)
    const last = bb[bb.length - 1]
    expect(last.upper).toBeCloseTo(last.lower, 6)
  })
})

describe('calcATR', () => {
  it('returns same length as input', () => {
    const klines = makeKlines(50)
    expect(calcATR(klines, 14)).toHaveLength(50)
  })

  it('all ATR values are non-negative', () => {
    const klines = makeKlines(50)
    calcATR(klines, 14)
      .filter((v) => !isNaN(v))
      .forEach((v) => expect(v).toBeGreaterThanOrEqual(0))
  })
})

describe('calcOBV', () => {
  it('starts at 0', () => {
    const klines = makeKlines(10)
    expect(calcOBV(klines)[0]).toBe(0)
  })

  it('length matches input', () => {
    const klines = makeKlines(30)
    expect(calcOBV(klines)).toHaveLength(30)
  })
})

describe('calcStochRSI', () => {
  it('returns same length as input', () => {
    const prices = makePrices(60)
    expect(calcStochRSI(prices, 14)).toHaveLength(60)
  })
})

describe('detectSwingLevels', () => {
  it('detects high in a simple V shape', () => {
    const prices = [100, 110, 120, 110, 100, 110, 120, 110, 100]
    const klines: Kline[] = prices.map((p, i) => ({
      openTime: i * 3600000,
      open: p,
      high: p + 2,
      low: p - 2,
      close: p,
      volume: 1000,
      closeTime: (i + 1) * 3600000,
    }))
    const levels = detectSwingLevels(klines, 2)
    expect(levels.some((l) => l.type === 'high')).toBe(true)
  })
})
