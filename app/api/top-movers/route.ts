import { NextResponse } from 'next/server'

const STABLECOINS = new Set([
  'USDC', 'BUSD', 'TUSD', 'USDP', 'DAI', 'FDUSD', 'USDT',
  'EURS', 'EURT', 'AEUR', 'PYUSD', 'SUSD', 'LUSD', 'FRAX',
  'USD1', 'RLUSD', 'USDE', 'USDX',
])

export interface MoverCoin {
  symbol: string
  pair: string
  price: number
  change24h: number
  volume: number
}

export interface HeatmapCoin extends MoverCoin {
  tier: 1 | 2 | 3
}

// ─── Binance source ───────────────────────────────────────────────────────────

async function fromBinance(): Promise<MoverCoin[]> {
  const res = await fetch('https://api.binance.com/api/v3/ticker/24hr', {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Binance ${res.status}`)

  const raw: {
    symbol: string
    lastPrice: string
    priceChangePercent: string
    quoteVolume: string
  }[] = await res.json()

  return raw
    .filter((t) => {
      if (!t.symbol.endsWith('USDT')) return false
      const base = t.symbol.slice(0, -4)
      if (STABLECOINS.has(base)) return false
      if (parseFloat(t.quoteVolume) < 10_000_000) return false
      return true
    })
    .map((t) => ({
      symbol: t.symbol.slice(0, -4),
      pair: t.symbol,
      price: parseFloat(t.lastPrice),
      change24h: parseFloat(t.priceChangePercent),
      volume: parseFloat(t.quoteVolume),
    }))
}

// ─── CoinPaprika fallback ─────────────────────────────────────────────────────

interface CPTicker {
  symbol: string
  rank: number
  quotes: { USD: { price: number; percent_change_24h: number; volume_24h: number } }
}

async function fromCoinPaprika(): Promise<MoverCoin[]> {
  const res = await fetch('https://api.coinpaprika.com/v1/tickers?quotes=USD', {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`CoinPaprika ${res.status}`)
  const raw: CPTicker[] = await res.json()

  return raw
    .filter((t) => {
      if (STABLECOINS.has(t.symbol)) return false
      const vol = t.quotes?.USD?.volume_24h ?? 0
      if (vol < 10_000_000) return false
      return true
    })
    .map((t) => ({
      symbol: t.symbol,
      pair: `${t.symbol}USDT`,
      price: t.quotes.USD.price,
      change24h: t.quotes.USD.percent_change_24h,
      volume: t.quotes.USD.volume_24h,
    }))
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  try {
    let coins: MoverCoin[]

    try {
      coins = await fromBinance()
    } catch {
      coins = await fromCoinPaprika()
    }

    const sorted = [...coins].sort((a, b) => b.change24h - a.change24h)
    const gainers = sorted.slice(0, 6)
    const losers = sorted.slice(-6).reverse()
    const byVolume = [...coins].sort((a, b) => b.volume - a.volume).slice(0, 10)

    const heatmapRaw = [...coins].sort((a, b) => b.volume - a.volume).slice(0, 40)
    const maxVol = heatmapRaw[0]?.volume ?? 1
    const heatmap: HeatmapCoin[] = heatmapRaw.map((c) => ({
      ...c,
      tier: c.volume > maxVol * 0.3 ? 1 : c.volume > maxVol * 0.05 ? 2 : 3,
    }))

    return NextResponse.json({ gainers, losers, byVolume, heatmap })
  } catch (err) {
    console.error('top-movers route error:', err)
    return NextResponse.json({ gainers: [], losers: [], byVolume: [], heatmap: [] }, { status: 500 })
  }
}
