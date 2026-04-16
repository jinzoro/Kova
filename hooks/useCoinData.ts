'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchCoinMarkets, fetchCoinDetail, fetchGlobal, fetchFearGreed, symbolToId } from '@/lib/coingecko'

const DEFAULT_COINS = ['bitcoin', 'ethereum', 'solana', 'binancecoin', 'cardano']

export function useWatchlist(ids = DEFAULT_COINS) {
  return useQuery({
    queryKey: ['watchlist', ids],
    queryFn: () => fetchCoinMarkets(ids, true),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

export function useCoinDetail(symbol: string) {
  const id = symbolToId(symbol)
  return useQuery({
    queryKey: ['coinDetail', id],
    queryFn: () => fetchCoinDetail(id),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

export function useGlobalData() {
  return useQuery({
    queryKey: ['global'],
    queryFn: fetchGlobal,
    refetchInterval: 120_000,
    staleTime: 60_000,
  })
}

export function useFearGreed() {
  return useQuery({
    queryKey: ['fearGreed'],
    queryFn: fetchFearGreed,
    refetchInterval: 3_600_000,  // 1 hour
    staleTime: 1_800_000,
  })
}
