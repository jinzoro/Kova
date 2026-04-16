'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchKlines, type KlineInterval } from '@/lib/binance'

export function useKlines(symbol: string, interval: KlineInterval = '1h', limit = 200) {
  return useQuery({
    queryKey: ['klines', symbol, interval, limit],
    queryFn: () => fetchKlines(symbol, interval, limit),
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled: !!symbol,
  })
}
