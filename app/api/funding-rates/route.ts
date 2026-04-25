import { NextResponse } from 'next/server'
import { fetchAllFundingRates } from '@/lib/binance'

export const runtime = 'nodejs'
export const revalidate = 300

// Well-known USDT-M perpetuals we care about — keep the list curated
// so the response is small and useful (not 300+ altcoin pairs)
const FOCUS_SYMBOLS = new Set([
  'BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT','DOGEUSDT',
  'AVAXUSDT','LINKUSDT','DOTUSDT','MATICUSDT','LTCUSDT','ATOMUSDT','NEARUSDT',
  'UNIUSDT','AAVEUSDT','INJUSDT','SUIUSDT','APTUSDT','ARBUSDT','OPUSDT',
  'FTMUSDT','FILUSDT','SANDUSDT','MANAUSDT','GALAUSDT','AXSUSDT','GMTUSDT',
  'LDOUSDT','SEIUSDT','TIAUSDT','WIFUSDT','PEPEUSDT','BONKUSDT','SHIBUSDT',
])

export async function GET() {
  const all = await fetchAllFundingRates()

  const filtered = all
    .filter((p) => FOCUS_SYMBOLS.has(p.symbol))
    .map((p) => ({
      symbol: p.symbol.replace('USDT', ''),
      fundingRate: parseFloat(p.lastFundingRate),
      markPrice: parseFloat(p.markPrice),
      nextFundingTime: p.nextFundingTime,
    }))
    .sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate))

  // Split into extreme longs (positive) and extreme shorts (negative)
  const longs  = filtered.filter((f) => f.fundingRate > 0).slice(0, 8)
  const shorts = filtered.filter((f) => f.fundingRate < 0).slice(0, 8)

  return NextResponse.json({
    longs,
    shorts,
    all: filtered,
    updatedAt: new Date().toISOString(),
  })
}
