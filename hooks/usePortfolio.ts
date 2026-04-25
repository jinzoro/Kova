'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'

const STORAGE_KEY = 'kova:portfolio'

export interface Holding {
  id: string          // uuid-lite — Date.now() + random
  symbol: string      // uppercase, e.g. 'BTC'
  amount: number      // quantity held
  avgCost: number     // avg purchase price in USD
  addedAt: number     // unix ms
}

export interface HoldingWithLive extends Holding {
  currentPrice: number | null
  value: number | null
  pnl: number | null
  pnlPct: number | null
}

// ─── Persistence ──────────────────────────────────────────────────────────────

function loadHoldings(): Holding[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Holding[]
  } catch {
    return []
  }
}

function saveHoldings(h: Holding[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(h))
}

// ─── Live prices via Binance REST (no WebSocket needed — 30s poll) ────────────

async function fetchPrices(symbols: string[]): Promise<Record<string, number>> {
  if (symbols.length === 0) return {}
  // Binance batch price endpoint
  const pairs = symbols.map((s) => `"${s.toUpperCase()}USDT"`).join(',')
  const res = await fetch(
    `https://api.binance.com/api/v3/ticker/price?symbols=[${pairs}]`,
    { cache: 'no-store' },
  )
  if (!res.ok) return {}
  const data: { symbol: string; price: string }[] = await res.json()
  return Object.fromEntries(
    data.map((d) => [d.symbol.replace('USDT', ''), parseFloat(d.price)])
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePortfolio() {
  const [holdings, setHoldings] = useState<Holding[]>([])

  // Load from localStorage on mount
  useEffect(() => {
    setHoldings(loadHoldings())
  }, [])

  const symbols = [...new Set(holdings.map((h) => h.symbol))]

  const { data: prices = {} } = useQuery<Record<string, number>>({
    queryKey: ['portfolio-prices', symbols.sort().join(',')],
    queryFn: () => fetchPrices(symbols),
    staleTime: 30_000,
    refetchInterval: 30_000,
    enabled: symbols.length > 0,
  })

  // Add a holding
  const addHolding = useCallback((symbol: string, amount: number, avgCost: number) => {
    const next: Holding = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      symbol: symbol.toUpperCase(),
      amount,
      avgCost,
      addedAt: Date.now(),
    }
    setHoldings((prev) => {
      const updated = [...prev, next]
      saveHoldings(updated)
      return updated
    })
  }, [])

  // Remove a holding by id
  const removeHolding = useCallback((id: string) => {
    setHoldings((prev) => {
      const updated = prev.filter((h) => h.id !== id)
      saveHoldings(updated)
      return updated
    })
  }, [])

  // Merge live prices into holdings
  const holdingsWithLive: HoldingWithLive[] = holdings.map((h) => {
    const currentPrice = prices[h.symbol] ?? null
    const value = currentPrice !== null ? currentPrice * h.amount : null
    const cost = h.avgCost * h.amount
    const pnl = value !== null ? value - cost : null
    const pnlPct = pnl !== null && cost > 0 ? (pnl / cost) * 100 : null
    return { ...h, currentPrice, value, pnl, pnlPct }
  })

  const totalValue = holdingsWithLive.reduce((s, h) => s + (h.value ?? 0), 0)
  const totalCost  = holdingsWithLive.reduce((s, h) => s + h.avgCost * h.amount, 0)
  const totalPnl   = totalValue - totalCost
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0

  return {
    holdings: holdingsWithLive,
    addHolding,
    removeHolding,
    prices,
    totalValue,
    totalCost,
    totalPnl,
    totalPnlPct,
    isLoading: symbols.length > 0 && Object.keys(prices).length === 0,
  }
}
