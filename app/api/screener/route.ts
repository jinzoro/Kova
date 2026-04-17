import { NextResponse } from 'next/server'
import { fetchKlines, fetch24hTicker } from '@/lib/binance'
import { scoreSignal } from '@/lib/scoring'
import { calcRSI } from '@/lib/indicators'
import { detectPatterns } from '@/lib/patterns'

export const runtime = 'nodejs'
export const revalidate = 300

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

export async function GET() {
  try {
    const tickers = await fetch24hTicker()
    const top25 = tickers
      .filter((t) => t.symbol.endsWith('USDT') && !t.symbol.includes('BUSD') && !t.symbol.includes('DOWN') && !t.symbol.includes('UP'))
      .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, 25)

    const settled = await Promise.allSettled(
      top25.map(async (ticker): Promise<ScreenerCoin | null> => {
        const symbol = ticker.symbol.replace('USDT', '')
        try {
          const klines = await fetchKlines(symbol, '1h', 200)
          if (klines.length < 30) return null

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
        } catch {
          return null
        }
      }),
    )

    const coins: ScreenerCoin[] = settled
      .filter((r): r is PromiseFulfilledResult<ScreenerCoin> => r.status === 'fulfilled' && r.value !== null)
      .map((r) => r.value as ScreenerCoin)

    return NextResponse.json({ coins, updatedAt: new Date().toISOString() })
  } catch (err) {
    console.error('[screener] error', err)
    return NextResponse.json({ error: 'Screener fetch failed' }, { status: 500 })
  }
}
