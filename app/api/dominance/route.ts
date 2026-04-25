import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const revalidate = 3600  // 1h — free CoinGecko tier is rate-limited

const CG = 'https://api.coingecko.com/api/v3'
// CoinGecko free tier requires a recognisable User-Agent
const HEADERS = { 'Accept': 'application/json' }

interface DominancePoint {
  timestamp: number
  btcDominance: number
  ethDominance: number
  totalMcap: number
}

interface AltseasonData {
  index: number
  label: 'Altcoin Season' | 'Bitcoin Season' | 'Neutral'
  outperforming: number
}

async function cgFetch(path: string) {
  const res = await fetch(`${CG}${path}`, {
    headers: HEADERS,
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`CoinGecko ${path} → ${res.status}`)
  return res.json()
}

export async function GET() {
  try {
    // ── 3 parallel calls — all free-tier endpoints ──────────────────────────
    const [btcChart, ethChart, globalData, top50] = await Promise.all([
      cgFetch('/coins/bitcoin/market_chart?vs_currency=usd&days=90&interval=daily'),
      cgFetch('/coins/ethereum/market_chart?vs_currency=usd&days=90&interval=daily'),
      cgFetch('/global'),
      cgFetch('/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&price_change_percentage=90d'),
    ])

    // Current BTC dominance → use as a scalar to estimate historical total mcap
    // (BTC dominance moves slowly; this gives a good-enough approximation)
    const currentBtcDom: number = globalData?.data?.market_cap_percentage?.btc ?? 50
    const currentEthDom: number = globalData?.data?.market_cap_percentage?.eth ?? 15

    const btcMcaps: [number, number][] = btcChart.market_caps ?? []
    const ethMcaps: [number, number][] = ethChart.market_caps ?? []

    // Build aligned daily points (BTC is our reference timeline)
    const points: DominancePoint[] = btcMcaps.map(([ts, btcMcap]) => {
      // Find ETH market cap closest in time (±24h)
      const ethEntry = ethMcaps.find((e) => Math.abs(e[0] - ts) < 86_400_000)
      const ethMcap = ethEntry?.[1] ?? 0

      // Approximate total from BTC market cap ÷ current BTC dom %
      // ETH dominance cross-check: eth / (eth / currentEthDom * 100) == currentEthDom
      const totalFromBtc  = currentBtcDom > 0 ? (btcMcap / currentBtcDom) * 100 : 0
      const totalFromEth  = currentEthDom > 0 && ethMcap > 0 ? (ethMcap / currentEthDom) * 100 : 0
      // Average both estimates for a more stable total
      const total = totalFromEth > 0 ? (totalFromBtc + totalFromEth) / 2 : totalFromBtc

      return {
        timestamp: ts,
        btcDominance: total > 0 ? (btcMcap / total) * 100 : 0,
        ethDominance: total > 0 ? (ethMcap / total) * 100 : 0,
        totalMcap: total,
      }
    })

    // ── Altcoin Season Index ────────────────────────────────────────────────
    // How many of the top 50 (excl. stablecoins + BTC) outperformed BTC over 90d?
    const STABLES = new Set(['USDT','USDC','BUSD','DAI','TUSD','FDUSD','USDP'])
    const btcReturn90d: number = top50.find(
      (c: { symbol: string; price_change_percentage_90d_in_currency?: number }) =>
        c.symbol?.toUpperCase() === 'BTC'
    )?.price_change_percentage_90d_in_currency ?? 0

    const altcoins = (top50 as { symbol: string; price_change_percentage_90d_in_currency?: number }[]).filter(
      (c) => c.symbol?.toUpperCase() !== 'BTC' && !STABLES.has(c.symbol?.toUpperCase() ?? '')
    )
    const outperforming = altcoins.filter(
      (c) => (c.price_change_percentage_90d_in_currency ?? -999) > btcReturn90d
    ).length
    const altseasonIndex = altcoins.length > 0
      ? Math.round((outperforming / altcoins.length) * 100)
      : 0

    const altseason: AltseasonData = {
      index: altseasonIndex,
      outperforming,
      label: altseasonIndex >= 75 ? 'Altcoin Season'
           : altseasonIndex <= 25 ? 'Bitcoin Season'
           : 'Neutral',
    }

    return NextResponse.json({ points, altseason, updatedAt: new Date().toISOString() })
  } catch (err) {
    console.error('[dominance]', err)
    return NextResponse.json({ error: 'Dominance data unavailable', points: [], altseason: { index: 0, label: 'Neutral', outperforming: 0 } }, { status: 500 })
  }
}
