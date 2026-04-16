'use client'

import { useQuery } from '@tanstack/react-query'
import type { MoverCoin, HeatmapCoin } from '@/app/api/top-movers/route'

export type { MoverCoin, HeatmapCoin }

interface TopMoversData {
  gainers: MoverCoin[]
  losers: MoverCoin[]
  byVolume: MoverCoin[]
  heatmap: HeatmapCoin[]
}

async function fetchTopMovers(): Promise<TopMoversData> {
  const res = await fetch('/api/top-movers')
  if (!res.ok) throw new Error('Failed to fetch top movers')
  return res.json()
}

export function useTopMovers() {
  return useQuery<TopMoversData>({
    queryKey: ['topMovers'],
    queryFn: fetchTopMovers,
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
}
