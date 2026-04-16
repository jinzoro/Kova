import { NextResponse } from 'next/server'

const STABLECOINS = new Set([
  'USDC', 'BUSD', 'TUSD', 'USDP', 'DAI', 'FDUSD', 'USDT',
  'EURS', 'EURT', 'AEUR', 'PYUSD', 'SUSD', 'LUSD', 'FRAX',
])

export interface MoverCoin {
  symbol: string     // e.g. "BTC"
  pair: string       // e.g. "BTCUSDT"
  price: number
  change24h: number  // percent
  volume: number     // in USDT
}

export interface HeatmapCoin extends MoverCoin {
  /** Rough market cap tier for sizing tiles: 1=large, 2=mid, 3=small */
  tier: 1 | 2 | 3
}

export async function GET() {
  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/24hr', {
      next: { revalidate: 30 },
    })
    if (!res.ok) throw new Error(`Binance ticker error: ${res.status}`)

    const raw: {
      symbol: string
      lastPrice: string
      priceChangePercent: string
      quoteVolume: string
    }[] = await res.json()

    // Filter: USDT pairs only, exclude stablecoins, minimum $10M volume
    const filtered = raw.filter((t) => {
      if (!t.symbol.endsWith('USDT')) return false
      const base = t.symbol.replace('USDT', '')
      if (STABLECOINS.has(base)) return false
      if (parseFloat(t.quoteVolume) < 10_000_000) return false
      return true
    })

    const mapped: MoverCoin[] = filtered.map((t) => ({
      symbol: t.symbol.replace('USDT', ''),
      pair: t.symbol,
      price: parseFloat(t.lastPrice),
      change24h: parseFloat(t.priceChangePercent),
      volume: parseFloat(t.quoteVolume),
    }))

    // Sort by absolute change for gainers/losers
    const sorted = [...mapped].sort((a, b) => b.change24h - a.change24h)

    const gainers = sorted.slice(0, 6)
    const losers = sorted.slice(-6).reverse()

    // Top by volume
    const byVolume = [...mapped]
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10)

    // Heatmap: top 40 by volume with tier sizing
    const heatmapRaw = [...mapped]
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 40)

    const maxVol = heatmapRaw[0]?.volume ?? 1
    const heatmap: HeatmapCoin[] = heatmapRaw.map(c => ({
      ...c,
      tier: c.volume > maxVol * 0.3 ? 1 : c.volume > maxVol * 0.05 ? 2 : 3,
    }))

    return NextResponse.json({ gainers, losers, byVolume, heatmap })
  } catch (err) {
    console.error('top-movers route error:', err)
    return NextResponse.json({ gainers: [], losers: [], byVolume: [], heatmap: [] }, { status: 500 })
  }
}
