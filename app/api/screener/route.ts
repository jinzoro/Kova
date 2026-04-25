import { NextResponse } from 'next/server'
import { fetchKlinesKraken } from '@/lib/binance'
import { scoreSignal } from '@/lib/scoring'
import { calcRSI } from '@/lib/indicators'
import { detectPatterns } from '@/lib/patterns'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─── Config ───────────────────────────────────────────────────────────────────

const BATCH_SIZE      = 10   // Kraken has no rate limiting — run more in parallel
const KLINE_TIMEOUT   = 10_000
const CANDIDATE_LIMIT = 60   // top coins by volume to score

const STABLECOINS = new Set([
  'USDC','USDT','BUSD','TUSD','USDP','GUSD','DAI','FDUSD',
  'USD1','RLUSD','USDD','PYUSD','EURC','FRAX','LUSD','SUSD',
  'CUSD','OUSD','USDX','HUSD','EURS','USDE',
])

function isClean(sym: string) {
  if (STABLECOINS.has(sym)) return false
  if (!/^[A-Z0-9]+$/.test(sym)) return false
  if (sym.includes('UP') || sym.includes('DOWN')) return false
  return true
}

type Interval = '1h' | '4h' | '1d'

interface ScreenerCoin {
  symbol:    string
  price:     number
  change24h: number
  volume24h: number
  signal:    number
  label:     string
  rsi:       number | null
  pattern:   { name: string; type: string } | null
}

interface Candidate {
  symbol:    string
  price:     number
  change24h: number
  volume24h: number
}

// ─── Candidate list ───────────────────────────────────────────────────────────
// Source A: Binance MINI ticker — just metadata (price/vol), not klines.
// The lightweight MINI ticker is rarely blocked even on cloud IPs.
// Source B: CoinGecko /coins/markets — fallback, reliable, cloud-friendly.

async function candidatesFromBinance(limit: number): Promise<Candidate[]> {
  const res = await fetch('https://api.binance.com/api/v3/ticker/24hr?type=MINI', {
    next: { revalidate: 60 },
  })
  if (!res.ok) throw new Error(`Binance MINI ticker: ${res.status}`)

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
      return isClean(base) && parseFloat(t.quoteVolume) >= 10_000_000
    })
    .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
    .slice(0, limit)
    .map((t) => {
      const base = t.symbol.slice(0, -4)
      const last = parseFloat(t.lastPrice)
      const open = parseFloat(t.openPrice)
      return {
        symbol:    base,
        price:     last,
        change24h: open > 0 ? ((last - open) / open) * 100 : 0,
        volume24h: parseFloat(t.quoteVolume),
      }
    })
}

async function candidatesFromCoinGecko(limit: number): Promise<Candidate[]> {
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=${limit}&page=1`
  const res = await fetch(url, { next: { revalidate: 60 } })
  if (!res.ok) throw new Error(`CoinGecko markets: ${res.status}`)

  const raw: {
    symbol: string
    current_price: number
    price_change_percentage_24h: number
    total_volume: number
  }[] = await res.json()

  return raw
    .filter((c) => {
      const sym = c.symbol.toUpperCase()
      return isClean(sym) && (c.total_volume ?? 0) >= 10_000_000
    })
    .map((c) => ({
      symbol:    c.symbol.toUpperCase(),
      price:     c.current_price,
      change24h: c.price_change_percentage_24h ?? 0,
      volume24h: c.total_volume,
    }))
}

async function fetchCandidates(limit: number): Promise<Candidate[]> {
  try {
    return await candidatesFromBinance(limit)
  } catch (e) {
    console.warn('[screener] Binance ticker blocked, falling back to CoinGecko:', e)
    return await candidatesFromCoinGecko(limit)
  }
}

// ─── Per-coin klines + scoring — CryptoCompare only (no Binance klines) ───────

async function scoreCoin(c: Candidate, interval: Interval): Promise<ScreenerCoin | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), KLINE_TIMEOUT)
  try {
    const klines = await fetchKlinesKraken(c.symbol, interval, 200, controller.signal)
    clearTimeout(timer)
    if (klines.length < 14) return null

    const score   = scoreSignal(klines)
    const closes  = klines.map((k) => k.close)
    const rsiArr  = calcRSI(closes, 14)
    const rsi     = rsiArr[rsiArr.length - 1]
    const pattern = detectPatterns(klines, 5)[0] ?? null

    return {
      symbol:    c.symbol,
      price:     c.price,
      change24h: c.change24h,
      volume24h: c.volume24h,
      signal:    score.total,
      label:     score.label,
      rsi:       isNaN(rsi) ? null : Math.round(rsi * 10) / 10,
      pattern:   pattern ? { name: pattern.name, type: pattern.type } : null,
    }
  } catch (err) {
    clearTimeout(timer)
    console.warn(`[screener] ${c.symbol}:`, err instanceof Error ? err.message : err)
    return null
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const raw = searchParams.get('interval') ?? '1h'
  const interval: Interval = (['1h', '4h', '1d'] as const).includes(raw as Interval)
    ? (raw as Interval) : '1h'

  try {
    const candidates = await fetchCandidates(CANDIDATE_LIMIT)

    const coins: ScreenerCoin[] = []
    let failedCount = 0

    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch   = candidates.slice(i, i + BATCH_SIZE)
      const results = await Promise.allSettled(batch.map((c) => scoreCoin(c, interval)))
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) coins.push(r.value)
        else failedCount++
      }
    }

    if (coins.length === 0) {
      return NextResponse.json(
        { error: 'No screener data available. Try again shortly.' },
        { status: 503 },
      )
    }

    return NextResponse.json({ coins, updatedAt: new Date().toISOString(), failedCount, interval })
  } catch (err) {
    console.error('[screener] fatal:', err)
    return NextResponse.json({ error: 'Screener fetch failed' }, { status: 500 })
  }
}
