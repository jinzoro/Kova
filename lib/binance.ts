// Binance REST API client — no API key required for public endpoints

const BASE = 'https://api.binance.com/api/v3'
const FUTURES_BASE = 'https://fapi.binance.com/fapi/v1'

export interface Kline {
  openTime: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  closeTime: number
}

export interface Ticker24h {
  symbol: string
  priceChange: string
  priceChangePercent: string
  lastPrice: string
  volume: string
  quoteVolume: string
  highPrice: string
  lowPrice: string
}

export interface FundingRate {
  symbol: string
  fundingRate: string
  fundingTime: number
}

export type KlineInterval =
  | '1m' | '5m' | '15m' | '30m'
  | '1h' | '4h' | '1d' | '1w'

/** Fetch OHLCV klines from Binance spot */
export async function fetchKlines(
  symbol: string,
  interval: KlineInterval = '1h',
  limit = 200,
): Promise<Kline[]> {
  const sym = symbol.toUpperCase().endsWith('USDT')
    ? symbol.toUpperCase()
    : `${symbol.toUpperCase()}USDT`
  const url = `${BASE}/klines?symbol=${sym}&interval=${interval}&limit=${limit}`
  const res = await fetch(url, { next: { revalidate: 60 } })
  if (!res.ok) throw new Error(`Binance klines error: ${res.status}`)
  const raw: unknown[][] = await res.json()
  return raw.map((k) => ({
    openTime: k[0] as number,
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
    volume: parseFloat(k[5] as string),
    closeTime: k[6] as number,
  }))
}

/** Fetch 24h ticker for one or all symbols */
export async function fetch24hTicker(symbol?: string): Promise<Ticker24h[]> {
  const url = symbol
    ? `${BASE}/ticker/24hr?symbol=${symbol.toUpperCase()}USDT`
    : `${BASE}/ticker/24hr`
  const res = await fetch(url, { next: { revalidate: 30 } })
  if (!res.ok) throw new Error(`Binance ticker error: ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : [data]
}

/** Fetch current price */
export async function fetchPrice(symbol: string): Promise<number> {
  const sym = symbol.toUpperCase().endsWith('USDT')
    ? symbol.toUpperCase()
    : `${symbol.toUpperCase()}USDT`
  const res = await fetch(`${BASE}/ticker/price?symbol=${sym}`, {
    next: { revalidate: 10 },
  })
  if (!res.ok) throw new Error(`Binance price error: ${res.status}`)
  const data: { price: string } = await res.json()
  return parseFloat(data.price)
}

export interface OpenInterest {
  symbol: string
  openInterest: string  // raw string from API
  time: number
}

/** Fetch current open interest from Binance Futures */
export async function fetchOpenInterest(symbol: string): Promise<OpenInterest | null> {
  const sym = symbol.toUpperCase().endsWith('USDT')
    ? symbol.toUpperCase()
    : `${symbol.toUpperCase()}USDT`
  try {
    const res = await fetch(
      `${FUTURES_BASE}/openInterest?symbol=${sym}`,
      { next: { revalidate: 60 } },
    )
    if (!res.ok) return null
    return await res.json() as OpenInterest
  } catch {
    return null
  }
}

/** Fetch latest funding rate from Binance Futures */
export async function fetchFundingRate(symbol: string): Promise<FundingRate | null> {
  const sym = symbol.toUpperCase().endsWith('USDT')
    ? symbol.toUpperCase()
    : `${symbol.toUpperCase()}USDT`
  try {
    const res = await fetch(
      `${FUTURES_BASE}/fundingRate?symbol=${sym}&limit=1`,
      { next: { revalidate: 300 } },
    )
    if (!res.ok) return null
    const data: FundingRate[] = await res.json()
    return data[0] ?? null
  } catch {
    return null
  }
}
