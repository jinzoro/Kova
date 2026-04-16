'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchFundingRate } from '@/lib/binance'

export function useFundingRate(symbol: string) {
  return useQuery({
    queryKey: ['fundingRate', symbol],
    queryFn: () => fetchFundingRate(symbol),
    refetchInterval: 300_000,  // 5 min
    staleTime: 240_000,
    enabled: !!symbol,
  })
}
