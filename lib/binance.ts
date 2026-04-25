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
  signal?: AbortSignal,
): Promise<Kline[]> {
  const sym = symbol.toUpperCase().endsWith('USDT')
    ? symbol.toUpperCase()
    : `${symbol.toUpperCase()}USDT`
  const url = `${BASE}/klines?symbol=${sym}&interval=${interval}&limit=${limit}`
  const res = await fetch(url, { next: { revalidate: 60 }, signal })
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

// CryptoCompare interval map (used as fallback when Binance blocks cloud IPs)
const CC_INTERVAL: Record<string, { endpoint: string; aggregate: number }> = {
  '1h': { endpoint: 'histohour', aggregate: 1  },
  '4h': { endpoint: 'histohour', aggregate: 4  },
  '1d': { endpoint: 'histoday',  aggregate: 1  },
}

/**
 * Fetch OHLCV klines from CryptoCompare (works from cloud server IPs).
 * Used as a fallback for the screener when Binance blocks the server.
 */
export async function fetchKlinesCryptoCompare(
  symbol: string,
  interval: KlineInterval = '1h',
  limit = 200,
  signal?: AbortSignal,
): Promise<Kline[]> {
  const iv = CC_INTERVAL[interval] ?? CC_INTERVAL['1h']
  const url = `https://min-api.cryptocompare.com/data/v2/${iv.endpoint}?fsym=${symbol.toUpperCase()}&tsym=USD&limit=${limit}&aggregate=${iv.aggregate}`
  const res = await fetch(url, { cache: 'no-store', signal })
  if (!res.ok) throw new Error(`CryptoCompare klines error: ${res.status}`)
  const json: {
    Response: string
    Data: { Data: { time: number; open: number; high: number; low: number; close: number; volumefrom: number }[] }
  } = await res.json()
  if (json.Response !== 'Success') throw new Error(`CryptoCompare: ${json.Response}`)
  return json.Data.Data.map((k) => ({
    openTime:  k.time * 1000,
    open:      k.open,
    high:      k.high,
    low:       k.low,
    close:     k.close,
    volume:    k.volumefrom,
    closeTime: k.time * 1000 + 3_600_000,
  }))
}

// Kraken interval map — free, no auth, no cloud IP blocking
const KRAKEN_INTERVAL: Record<string, number> = {
  '1h': 60,
  '4h': 240,
  '1d': 1440,
}

// Kraken uses different pair naming for some symbols
const KRAKEN_SYMBOL_MAP: Record<string, string> = {
  BTC:  'XBT',
  SHIB: 'SHIB',
  PEPE: 'PEPE',
}

/**
 * Fetch OHLCV klines from Kraken (works from cloud server IPs, no rate limiting).
 * Primary kline source for the screener on Vercel.
 */
export async function fetchKlinesKraken(
  symbol: string,
  interval: KlineInterval = '1h',
  limit = 200,
  signal?: AbortSignal,
): Promise<Kline[]> {
  const sym = symbol.toUpperCase()
  const krakenSym = KRAKEN_SYMBOL_MAP[sym] ?? sym
  const krakenInterval = KRAKEN_INTERVAL[interval] ?? 60
  const url = `https://api.kraken.com/0/public/OHLC?pair=${krakenSym}USD&interval=${krakenInterval}&count=${limit}`
  const res = await fetch(url, { cache: 'no-store', signal })
  if (!res.ok) throw new Error(`Kraken klines error: ${res.status}`)
  const json: {
    error: string[]
    result: Record<string, [number, string, string, string, string, string, string, number][]>
  } = await res.json()
  if (json.error?.length) throw new Error(`Kraken: ${json.error[0]}`)
  const pairKey = Object.keys(json.result).find((k) => k !== 'last')
  if (!pairKey) throw new Error(`Kraken: no pair data for ${sym}`)
  const candles = json.result[pairKey]
  const intervalMs = krakenInterval * 60 * 1000
  return candles.map((k) => ({
    openTime:  k[0] * 1000,
    open:      parseFloat(k[1]),
    high:      parseFloat(k[2]),
    low:       parseFloat(k[3]),
    close:     parseFloat(k[4]),
    volume:    parseFloat(k[6]),
    closeTime: k[0] * 1000 + intervalMs - 1,
  }))
}

/** Fetch 24h ticker for one or all symbols.
 *  Uses type=MINI for the all-symbols case to keep payload ≈600 KB (vs 2.4 MB).
 *  MINI response has lastPrice + openPrice (we compute priceChangePercent ourselves)
 *  and quoteVolume — sufficient for screener and top-movers.
 */
export async function fetch24hTicker(symbol?: string): Promise<Ticker24h[]> {
  const url = symbol
    ? `${BASE}/ticker/24hr?symbol=${symbol.toUpperCase()}USDT`
    : `${BASE}/ticker/24hr?type=MINI`
  const res = await fetch(url, { next: { revalidate: 30 } })
  if (!res.ok) throw new Error(`Binance ticker error: ${res.status}`)
  const data: (Ticker24h & { openPrice?: string })[] = await res.json()
  const arr = Array.isArray(data) ? data : [data]
  // MINI doesn't include priceChangePercent — compute it from openPrice
  return arr.map((t) => {
    if (t.priceChangePercent === undefined && t.openPrice) {
      const pct = ((parseFloat(t.lastPrice) - parseFloat(t.openPrice)) / parseFloat(t.openPrice)) * 100
      return { ...t, priceChangePercent: pct.toFixed(4) }
    }
    return t
  })
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

export interface PremiumIndex {
  symbol: string
  markPrice: string
  indexPrice: string
  estimatedSettlePrice: string
  lastFundingRate: string
  nextFundingTime: number
  interestRate: string
  time: number
}

/** Fetch premium index (funding rate) for all USDT perpetual futures in one call */
export async function fetchAllFundingRates(): Promise<PremiumIndex[]> {
  try {
    const res = await fetch(`${FUTURES_BASE}/premiumIndex`, { next: { revalidate: 300 } })
    if (!res.ok) return []
    const data: PremiumIndex[] = await res.json()
    return data.filter((d) => d.symbol.endsWith('USDT'))
  } catch {
    return []
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
