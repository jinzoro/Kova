/**
 * Market data client.
 *
 * Primary source  : CoinPaprika  (free, no key, full CORS support)
 * Fallback source : CoinMarketCap (proxied via /api/cmc/quote — requires CMC_API_KEY in .env.local)
 *
 * Coin ID resolution order:
 *   1. Static SYMBOL_TO_ID map
 *   2. Dynamic CoinPaprika /search  (handles any coin in their database)
 *   3. CMC fallback if CoinPaprika has no ticker data
 */

const BASE = 'https://api.coinpaprika.com/v1'

async function cpFetch<T>(path: string, revalidate = 60): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { next: { revalidate } })
  if (!res.ok) {
    if (res.status === 429) throw new Error('CoinPaprika rate limit exceeded')
    throw new Error(`CoinPaprika ${res.status}: ${path}`)
  }
  return res.json() as Promise<T>
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CoinMarket {
  id: string
  symbol: string
  name: string
  image: string
  current_price: number
  market_cap: number
  market_cap_rank: number
  price_change_percentage_24h: number
  total_volume: number
  high_24h: number
  low_24h: number
  ath: number
  ath_change_percentage: number
  circulating_supply: number
  total_supply: number | null
  sparkline_in_7d?: { price: number[] }
}

export interface CoinDetail {
  id: string
  symbol: string
  name: string
  image: { thumb: string; small: string; large: string }
  market_cap_rank: number
  market_data: {
    current_price: { usd: number }
    market_cap: { usd: number }
    total_volume: { usd: number }
    high_24h: { usd: number }
    low_24h: { usd: number }
    price_change_percentage_24h: number
    ath: { usd: number }
    ath_change_percentage: { usd: number }
    circulating_supply: number
    total_supply: number | null
    max_supply: number | null
  }
  description: { en: string }
}

export interface GlobalData {
  data: {
    total_market_cap: { usd: number }
    total_volume: { usd: number }
    market_cap_percentage: { btc: number; eth: number }
    market_cap_change_percentage_24h_usd: number
  }
}

export interface SearchResult {
  coins: {
    id: string
    name: string
    symbol: string
    market_cap_rank: number
    thumb: string
  }[]
}

export interface FearGreedData {
  data: { value: string; value_classification: string; timestamp: string }[]
  metadata: { error: null | string }
}

// ─── CoinPaprika raw types ────────────────────────────────────────────────────

interface CPTicker {
  id: string
  name: string
  symbol: string
  rank: number
  quotes: {
    USD: {
      price: number
      volume_24h: number
      market_cap: number
      percent_change_24h: number
      ath_price: number
      percent_from_price_ath: number
    }
  }
}

interface CPCoin {
  id: string
  name: string
  symbol: string
  rank: number
  description: string
}

interface CPGlobal {
  market_cap_usd: number
  volume_24h_usd: number
  bitcoin_dominance_percentage: number
  market_cap_change_24h: number
}

interface CPSearchResult {
  currencies: { id: string; name: string; symbol: string; rank: number }[]
}

function logoUrl(id: string): string {
  return `https://static.coinpaprika.com/coin/${id}/logo.png`
}

// ─── Dynamic ID resolution ────────────────────────────────────────────────────

/**
 * Resolve a URL symbol (e.g. "shib") to a valid CoinPaprika ID.
 * 1. Check static map.
 * 2. Search CoinPaprika and pick the best symbol match.
 */
async function resolveId(symbolOrSlug: string): Promise<string> {
  const upper = symbolOrSlug.toUpperCase()
  if (SYMBOL_TO_ID[upper]) return SYMBOL_TO_ID[upper]

  // Already looks like a full CoinPaprika ID (contains a hyphen)
  if (symbolOrSlug.includes('-')) return symbolOrSlug

  // Dynamic search
  try {
    const data = await cpFetch<CPSearchResult>(
      `/search?q=${encodeURIComponent(symbolOrSlug)}&c=currencies&limit=10`,
      600,
    )
    const currencies = data.currencies ?? []

    // Exact symbol match first
    const exact = currencies.find((c) => c.symbol.toUpperCase() === upper)
    if (exact) return exact.id

    // Fallback: first result
    if (currencies.length > 0) return currencies[0].id
  } catch {
    // ignore search errors — fall through to guessed ID
  }

  // Last resort: guess the canonical format
  return `${symbolOrSlug.toLowerCase()}-${symbolOrSlug.toLowerCase()}`
}

// ─── CMC fallback ─────────────────────────────────────────────────────────────

async function fetchFromCMC(symbol: string): Promise<CoinDetail | null> {
  try {
    const res = await fetch(`/api/cmc/quote?symbol=${encodeURIComponent(symbol.toUpperCase())}`)
    if (!res.ok) return null
    const d = await res.json()
    if (d.error) return null

    const logo = d.logo ?? ''
    return {
      id: d.id,
      symbol: d.symbol,
      name: d.name,
      image: { thumb: logo, small: logo, large: logo },
      market_cap_rank: d.rank ?? 0,
      market_data: {
        current_price: { usd: d.price },
        market_cap: { usd: d.market_cap },
        total_volume: { usd: d.volume_24h },
        high_24h: { usd: d.price },
        low_24h: { usd: d.price },
        price_change_percentage_24h: d.pct_change_24h,
        ath: { usd: d.price },
        ath_change_percentage: { usd: 0 },
        circulating_supply: d.circulating_supply ?? 0,
        total_supply: d.total_supply ?? null,
        max_supply: d.max_supply ?? null,
      },
      description: { en: '' },
    }
  } catch {
    return null
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchCoinMarkets(
  ids: string[],
  _sparkline = true,
): Promise<CoinMarket[]> {
  const results = await Promise.allSettled(
    ids.map((id) => cpFetch<CPTicker>(`/tickers/${id}?quotes=USD`, 60)),
  )
  return results
    .filter((r): r is PromiseFulfilledResult<CPTicker> => r.status === 'fulfilled')
    .map((r) => tickerToCoinMarket(r.value))
}

export async function fetchTopCoins(n = 50): Promise<CoinMarket[]> {
  const tickers = await cpFetch<CPTicker[]>('/tickers?quotes=USD', 120)
  return tickers.slice(0, n).map(tickerToCoinMarket)
}

/**
 * Fetch detail for a coin identified by symbol or slug.
 * Falls back to CMC if CoinPaprika has no data.
 */
export async function fetchCoinDetail(symbolOrSlug: string): Promise<CoinDetail> {
  const id = await resolveId(symbolOrSlug)
  const symbol = symbolOrSlug.toUpperCase().split('-')[0]

  try {
    const [coin, ticker] = await Promise.all([
      cpFetch<CPCoin>(`/coins/${id}`, 60),
      cpFetch<CPTicker>(`/tickers/${id}?quotes=USD`, 60),
    ])
    const usd = ticker.quotes.USD
    const logo = logoUrl(id)
    return {
      id,
      symbol: coin.symbol,
      name: coin.name,
      image: { thumb: logo, small: logo, large: logo },
      market_cap_rank: ticker.rank,
      market_data: {
        current_price: { usd: usd.price },
        market_cap: { usd: usd.market_cap },
        total_volume: { usd: usd.volume_24h },
        high_24h: { usd: usd.price * 1.01 },
        low_24h: { usd: usd.price * 0.99 },
        price_change_percentage_24h: usd.percent_change_24h,
        ath: { usd: usd.ath_price ?? usd.price },
        ath_change_percentage: { usd: usd.percent_from_price_ath ?? 0 },
        circulating_supply: 0,
        total_supply: null,
        max_supply: null,
      },
      description: { en: coin.description ?? '' },
    }
  } catch {
    // CoinPaprika failed — try CMC
    const cmc = await fetchFromCMC(symbol)
    if (cmc) return cmc
    throw new Error(`No data found for "${symbolOrSlug}" on CoinPaprika or CoinMarketCap.`)
  }
}

export async function searchCoins(query: string): Promise<SearchResult> {
  const data = await cpFetch<CPSearchResult>(
    `/search?q=${encodeURIComponent(query)}&c=currencies&limit=10`,
    300,
  )
  return {
    coins: (data.currencies ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      symbol: c.symbol,
      market_cap_rank: c.rank,
      thumb: logoUrl(c.id),
    })),
  }
}

export async function fetchGlobal(): Promise<GlobalData> {
  const g = await cpFetch<CPGlobal>('/global', 120)
  return {
    data: {
      total_market_cap: { usd: g.market_cap_usd },
      total_volume: { usd: g.volume_24h_usd },
      market_cap_percentage: { btc: g.bitcoin_dominance_percentage, eth: 0 },
      market_cap_change_percentage_24h_usd: g.market_cap_change_24h ?? 0,
    },
  }
}

export async function fetchFearGreed(): Promise<FearGreedData> {
  const res = await fetch('https://api.alternative.me/fng/?limit=1', {
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error('Fear & Greed fetch failed')
  return res.json()
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tickerToCoinMarket(t: CPTicker): CoinMarket {
  const usd = t.quotes.USD
  return {
    id: t.id,
    symbol: t.symbol,
    name: t.name,
    image: logoUrl(t.id),
    current_price: usd.price,
    market_cap: usd.market_cap,
    market_cap_rank: t.rank,
    price_change_percentage_24h: usd.percent_change_24h,
    total_volume: usd.volume_24h,
    high_24h: usd.price,
    low_24h: usd.price,
    ath: usd.ath_price ?? usd.price,
    ath_change_percentage: usd.percent_from_price_ath ?? 0,
    circulating_supply: 0,
    total_supply: null,
  }
}

// ─── Symbol → CoinPaprika ID map ──────────────────────────────────────────────

export const SYMBOL_TO_ID: Record<string, string> = {
  BTC:   'btc-bitcoin',
  ETH:   'eth-ethereum',
  SOL:   'sol-solana',
  BNB:   'bnb-binance-coin',
  ADA:   'ada-cardano',
  XRP:   'xrp-xrp',
  DOGE:  'doge-dogecoin',
  DOT:   'dot-polkadot',
  AVAX:  'avax-avalanche',
  MATIC: 'matic-polygon',
  LINK:  'link-chainlink',
  UNI:   'uni-uniswap',
  ATOM:  'atom-cosmos',
  LTC:   'ltc-litecoin',
  BCH:   'bch-bitcoin-cash',
  NEAR:  'near-near-protocol',
  APT:   'apt-aptos',
  ARB:   'arb-arbitrum',
  OP:    'op-optimism',
  SUI:   'sui-sui',
  TRX:   'trx-tron',
  TON:   'ton-toncoin',
  SHIB:  'shib-shiba-inu',
  PEPE:  'pepe-pepe',
  FLOKI: 'floki-floki-inu',
  BONK:  'bonk-bonk',
  WIF:   'wif-dogwifhat',
  TRUMP: 'trump-official-trump',
  FET:   'fet-fetch-ai',
  INJ:   'inj-injective-protocol',
  SEI:   'sei-sei',
  TAO:   'tao-bittensor',
  RENDER:'rndr-render-token',
  RNDR:  'rndr-render-token',
  JUP:   'jup-jupiter',
  WLD:   'wld-worldcoin',
  STX:   'stx-stacks',
  ICP:   'icp-internet-computer',
  FIL:   'fil-filecoin',
  HBAR:  'hbar-hedera-hashgraph',
  VET:   'vet-vechain',
  GRT:   'grt-the-graph',
  LDO:   'ldo-lido-dao',
  MKR:   'mkr-maker',
  AAVE:  'aave-aave',
  SNX:   'snx-synthetix-network-token',
  CRV:   'crv-curve-dao-token',
  ENA:   'ena-ethena',
  PYTH:  'pyth-pyth-network',
  JTO:   'jto-jito',
  MANTA: 'manta-manta-network',
  ALT:   'alt-altlayer',
  STRK:  'strk-starknet',
  DYM:   'dym-dymension',
  TIA:   'tia-celestia',
  BLUR:  'blur-blur',
  GMX:   'gmx-gmx',
  DYDX:  'dydx-dydx',
}

export function symbolToId(symbol: string): string {
  return SYMBOL_TO_ID[symbol.toUpperCase()] ?? symbol.toLowerCase()
}
