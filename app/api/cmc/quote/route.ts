import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const CMC_BASE = 'https://pro-api.coinmarketcap.com/v1'

export async function GET(req: NextRequest) {
  const apiKey = process.env.CMC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'CMC_API_KEY not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol')?.toUpperCase()
  if (!symbol) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `${CMC_BASE}/cryptocurrency/quotes/latest?symbol=${symbol}&convert=USD`,
      {
        headers: {
          'X-CMC_PRO_API_KEY': apiKey,
          Accept: 'application/json',
        },
        next: { revalidate: 60 },
      },
    )

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `CMC error ${res.status}`, detail: text }, { status: res.status })
    }

    const json = await res.json()
    if (json.status?.error_code !== 0) {
      return NextResponse.json({ error: json.status?.error_message }, { status: 400 })
    }

    const coinData = json.data?.[symbol]
    if (!coinData) {
      return NextResponse.json({ error: `Symbol ${symbol} not found in CMC` }, { status: 404 })
    }

    // Normalise to the same shape our app expects
    const q = coinData.quote?.USD
    return NextResponse.json({
      id: String(coinData.id),
      name: coinData.name,
      symbol: coinData.symbol,
      rank: coinData.cmc_rank,
      price: q?.price ?? 0,
      market_cap: q?.market_cap ?? 0,
      volume_24h: q?.volume_24h ?? 0,
      pct_change_24h: q?.percent_change_24h ?? 0,
      pct_change_7d: q?.percent_change_7d ?? 0,
      circulating_supply: coinData.circulating_supply ?? 0,
      total_supply: coinData.total_supply ?? null,
      max_supply: coinData.max_supply ?? null,
      logo: `https://s2.coinmarketcap.com/static/img/coins/64x64/${coinData.id}.png`,
    })
  } catch (err) {
    console.error('[cmc/quote]', err)
    return NextResponse.json({ error: 'CMC fetch failed' }, { status: 500 })
  }
}
