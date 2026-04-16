'use client'

/**
 * Combines REST kline history with a Binance WebSocket kline stream.
 *
 * - Initial data: fetched via React Query (same as useKlines)
 * - Live updates: Binance wss kline stream replaces/appends the last candle
 *   every time a trade occurs, giving sub-second chart updates.
 * - Auto-reconnects with exponential backoff.
 */

import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchKlines, type Kline, type KlineInterval } from '@/lib/binance'

interface Result {
  klines: Kline[]
  isLoading: boolean
  isError: boolean
}

export function useStreamKlines(
  symbol: string,
  interval: KlineInterval = '1h',
  limit = 200,
): Result {
  // ── REST baseline (history) ──────────────────────────────────────────────
  const query = useQuery({
    queryKey: ['klines', symbol, interval, limit],
    queryFn: () => fetchKlines(symbol, interval, limit),
    refetchInterval: 120_000,   // Refresh history every 2 min (gap fill safety)
    staleTime: 60_000,
    enabled: !!symbol,
  })

  // ── Local state: history merged with live WebSocket candle ───────────────
  const [klines, setKlines] = useState<Kline[]>([])

  // Sync when REST data loads or refreshes (baseline reset)
  useEffect(() => {
    if (query.data && query.data.length > 0) {
      setKlines(query.data)
    }
  }, [query.data])

  // ── WebSocket live stream ────────────────────────────────────────────────
  const wsRef = useRef<WebSocket | null>(null)
  const reconnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnDelayRef = useRef(1_000)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    if (!symbol) return

    const connect = () => {
      if (!mountedRef.current) return

      const sym = symbol.toLowerCase().replace('usdt', '')
      const ws = new WebSocket(
        `wss://stream.binance.com:9443/ws/${sym}usdt@kline_${interval}`,
      )
      wsRef.current = ws

      ws.onopen = () => {
        reconnDelayRef.current = 1_000
      }

      ws.onmessage = (ev: MessageEvent<string>) => {
        if (!mountedRef.current) return
        try {
          const msg = JSON.parse(ev.data) as {
            e: string
            k: {
              t: number   // open time ms
              T: number   // close time ms
              o: string; h: string; l: string; c: string; v: string
              x: boolean  // candle is closed/final?
            }
          }
          if (msg.e !== 'kline') return

          const k = msg.k
          const incoming: Kline = {
            openTime: k.t,
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v),
            closeTime: k.T,
          }

          setKlines(prev => {
            if (prev.length === 0) return prev
            const last = prev[prev.length - 1]

            if (incoming.openTime === last.openTime) {
              // Update the currently-forming candle (most common path)
              return [...prev.slice(0, -1), incoming]
            }
            if (incoming.openTime > last.openTime) {
              // Previous candle closed; new one started. Slide window.
              return [...prev.slice(1), incoming]
            }
            return prev // Out of order / stale — ignore
          })
        } catch { /* ignore malformed */ }
      }

      ws.onclose = () => {
        wsRef.current = null
        if (!mountedRef.current) return
        reconnTimerRef.current = setTimeout(() => {
          reconnDelayRef.current = Math.min(reconnDelayRef.current * 2, 30_000)
          connect()
        }, reconnDelayRef.current)
      }

      ws.onerror = () => ws.close()
    }

    connect()

    return () => {
      mountedRef.current = false
      if (reconnTimerRef.current) clearTimeout(reconnTimerRef.current)
      if (wsRef.current) {
        wsRef.current.onclose = null  // Prevent reconnect on intentional close
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [symbol, interval]) // Re-connect when symbol or interval changes

  return {
    klines: klines.length > 0 ? klines : (query.data ?? []),
    isLoading: query.isLoading && klines.length === 0,
    isError: query.isError,
  }
}
