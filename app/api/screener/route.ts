import { NextResponse } from 'next/server'
import { fetchKlines, fetch24hTicker } from '@/lib/binance'
import { scoreSignal } from '@/lib/scoring'
import { calcRSI } from '@/lib/indicators'
import { detectPatterns } from '@/lib/patterns'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Stablecoins and leveraged tokens to exclude from screener results
const EXCLUDE_SYMBOLS = new Set([
  'USDC', 'USDT', 'BUSD', 'TUSD', 'USDP', 'GUSD', 'DAI', 'FDUSD',
  'USD1', 'RLUSD', 'USDD', 'PYUSD', 'EURC', 'FRAX', 'LUSD', 'SUSD',
  'CUSD', 'OUSD', 'USDX', 'HUSD', 'EURS',
])

const KLINE_TIMEOUT_MS = 8_000
const BATCH_SIZE = 5

interface ScreenerCoin {
  symbol: string
  price: number
  change24h: number
  volume24h: number
  signal: number
  label: string
  rsi: number | null
  pattern: { name: string; type: string } | null
}

type Interval = '1h' | '4h' | '1d'

async function fetchCoinData(
  symbol: string,
  ticker: Awaited<ReturnType<typeof fetch24hTicker>>[number],
  interval: Interval = '1h',
): Promise<ScreenerCoin | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), KLINE_TIMEOUT_MS)
  try {
    const klines = await fetchKlines(symbol, interval, 200, controller.signal)
    clearTimeout(timer)
    if (klines.length < 14) return null

    const score = scoreSignal(klines)
    const closes = klines.map((k) => k.close)
    const rsiArr = calcRSI(closes, 14)
    const rsi = rsiArr[rsiArr.length - 1]
    const patterns = detectPatterns(klines, 5)
    const topPattern = patterns[0] ?? null

    return {
      symbol,
      price: parseFloat(ticker.lastPrice),
      change24h: parseFloat(ticker.priceChangePercent),
      volume24h: parseFloat(ticker.quoteVolume),
      signal: score.total,
      label: score.label,
      rsi: isNaN(rsi) ? null : Math.round(rsi * 10) / 10,
      pattern: topPattern ? { name: topPattern.name, type: topPattern.type } : null,
    }
  } catch (err) {
    clearTimeout(timer)
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[screener] ${symbol} failed: ${msg}`)
    return null
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const raw = searchParams.get('interval') ?? '1h'
  const interval: Interval = ['1h', '4h', '1d'].includes(raw) ? (raw as Interval) : '1h'

  try {
    const tickers = await fetch24hTicker()

    // Top USDT pairs by volume, excluding stablecoins and leveraged tokens
    const candidates = tickers
      .filter((t) => {
        const base = t.symbol.endsWith('USDT') ? t.symbol.slice(0, -4) : null
        if (!base) return false
        if (EXCLUDE_SYMBOLS.has(base)) return false
        if (base.includes('UP') || base.includes('DOWN') || base.includes('BUSD')) return false
        // Skip symbols with non-ASCII characters (e.g. Chinese)
        if (!/^[A-Z0-9]+$/.test(base)) return false
        return true
      })
      .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, 60)  // wider pool so filter-based views have more coins to show

    // Process all candidates in batches — no early stop so every coin is scored
    const coins: ScreenerCoin[] = []
    let failedCount = 0

    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE)
      const settled = await Promise.allSettled(
        batch.map((ticker) => {
          const symbol = ticker.symbol.slice(0, -4) // strip trailing USDT
          return fetchCoinData(symbol, ticker, interval)
        }),
      )

      for (const r of settled) {
        if (r.status === 'fulfilled' && r.value !== null) {
          coins.push(r.value)
        } else {
          failedCount++
        }
      }
    }

    if (coins.length === 0) {
      console.error('[screener] all coin fetches failed — Binance may be rate-limiting this IP')
      return NextResponse.json(
        { error: 'No data available — Binance API unreachable from server. Try again shortly.' },
        { status: 503 },
      )
    }

    return NextResponse.json({ coins, updatedAt: new Date().toISOString(), failedCount, interval })
  } catch (err) {
    console.error('[screener] fatal error', err)
    return NextResponse.json({ error: 'Screener fetch failed' }, { status: 500 })
  }
}
