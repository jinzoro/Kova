import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const revalidate = 30   // ISR cache: re-use response for 30s, no hammering Binance

const STABLECOINS = new Set([
  'USDC', 'BUSD', 'TUSD', 'USDP', 'DAI', 'FDUSD', 'USDT',
  'EURS', 'EURT', 'AEUR', 'PYUSD', 'SUSD', 'LUSD', 'FRAX',
  'USD1', 'RLUSD', 'USDE', 'USDX',
])

function isClean(base: string) {
  if (STABLECOINS.has(base)) return false
  if (!/^[A-Z0-9]+$/.test(base)) return false
  if (base.includes('UP') || base.includes('DOWN')) return false
  return true
}

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

// ─── Binance MINI ticker — same data, ≈600 KB instead of 2.4 MB ──────────────
// type=MINI: { symbol, openPrice, highPrice, lowPrice, lastPrice, volume, quoteVolume }

async function fromBinance(): Promise<MoverCoin[]> {
  const res = await fetch('https://api.binance.com/api/v3/ticker/24hr?type=MINI', {
    next: { revalidate: 30 },   // let Next.js ISR cache the response for 30s
  })
  if (!res.ok) throw new Error(`Binance ${res.status}`)

  const raw: {
    symbol: string
    lastPrice: string
    openPrice: string
    quoteVolume: string
  }[] = await res.json()

  return raw
    .filter((t) => {
      if (!t.symbol.endsWith('USDT')) return false
      const base = t.symbol.slice(0, -4)
      if (!isClean(base)) return false
      if (parseFloat(t.quoteVolume) < 5_000_000) return false
      return true
    })
    .map((t) => ({
      symbol: t.symbol.slice(0, -4),
      pair: t.symbol,
      price: parseFloat(t.lastPrice),
      // MINI ticker doesn't have priceChangePercent — compute from openPrice
      change24h: ((parseFloat(t.lastPrice) - parseFloat(t.openPrice)) / parseFloat(t.openPrice)) * 100,
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
    next: { revalidate: 60 },
  })
  if (!res.ok) throw new Error(`CoinPaprika ${res.status}`)
  const raw: CPTicker[] = await res.json()

  return raw
    .filter((t) => {
      if (!isClean(t.symbol)) return false
      const vol = t.quotes?.USD?.volume_24h ?? 0
      if (vol < 5_000_000) return false
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
    } catch (e) {
      console.warn('[top-movers] Binance failed, falling back to CoinPaprika:', e)
      coins = await fromCoinPaprika()
    }

    if (coins.length === 0) throw new Error('Both sources returned empty')

    const sorted = [...coins].sort((a, b) => b.change24h - a.change24h)
    const gainers = sorted.slice(0, 6)
    const losers  = sorted.slice(-6).reverse()
    const byVolume = [...coins].sort((a, b) => b.volume - a.volume).slice(0, 10)

    const heatmapRaw = [...coins].sort((a, b) => b.volume - a.volume).slice(0, 40)
    const maxVol = heatmapRaw[0]?.volume ?? 1
    const heatmap: HeatmapCoin[] = heatmapRaw.map((c) => ({
      ...c,
      tier: c.volume > maxVol * 0.3 ? 1 : c.volume > maxVol * 0.05 ? 2 : 3,
    }))

    return NextResponse.json({ gainers, losers, byVolume, heatmap })
  } catch (err) {
    console.error('[top-movers] fatal:', err)
    return NextResponse.json(
      { error: 'Market data unavailable', gainers: [], losers: [], byVolume: [], heatmap: [] },
      { status: 500 },
    )
  }
}
