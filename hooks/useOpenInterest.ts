'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchOpenInterest } from '@/lib/binance'

export function useOpenInterest(symbol: string) {
  return useQuery({
    queryKey: ['openInterest', symbol],
    queryFn: () => fetchOpenInterest(symbol),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}
