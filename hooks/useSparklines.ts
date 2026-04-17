'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchKlines } from '@/lib/binance'

/** Fetches 7-day daily close prices for multiple symbols (for sparklines). */
export function useSparklines(symbols: string[]) {
  return useQuery({
    queryKey: ['sparklines', symbols],
    queryFn: async () => {
      const results = await Promise.allSettled(
        symbols.map(async (sym) => {
          const klines = await fetchKlines(sym, '1d', 7)
          return { sym, prices: klines.map((k) => k.close) }
        }),
      )
      const map: Record<string, number[]> = {}
      for (const r of results) {
        if (r.status === 'fulfilled') map[r.value.sym.toUpperCase()] = r.value.prices
      }
      return map
    },
    staleTime: 3_600_000,  // sparklines only need hourly refresh
    refetchInterval: 3_600_000,
  })
}
