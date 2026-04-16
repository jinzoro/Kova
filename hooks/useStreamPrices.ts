'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export interface StreamPrice {
  price: number
  open: number
  high: number
  low: number
  change24h: number    // % relative to 24h open
  volume: number       // quote volume (USDT)
  updatedAt: number    // timestamp ms
}

const WS_BASE = 'wss://stream.binance.com:9443/stream'
const MAX_RECONNECT_DELAY = 30_000
const INITIAL_RECONNECT_DELAY = 1_000

/**
 * Subscribes to Binance 24hr miniTicker WebSocket streams for the given symbols.
 * Updates in real-time (every ~1 second per trade).
 *
 * @param symbols - Base symbols without USDT, e.g. ['BTC', 'ETH', 'SOL']
 * @returns A map of SYMBOL → StreamPrice, updated live
 */
export function useStreamPrices(symbols: string[]) {
  const [prices, setPrices] = useState<Record<string, StreamPrice>>({})
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const symbolsKey = symbols.join(',')

  const connect = useCallback(() => {
    if (symbols.length === 0) return

    const streams = symbols
      .map((s) => `${s.toLowerCase()}usdt@miniTicker`)
      .join('/')
    const url = `${WS_BASE}?streams=${streams}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY
    }

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(event.data) as {
          stream: string
          data: {
            e: string
            s: string  // e.g. "BTCUSDT"
            c: string  // last price
            o: string  // open price (24h)
            h: string  // high
            l: string  // low
            q: string  // quote asset volume
          }
        }
        const d = msg.data
        if (d.e !== '24hrMiniTicker') return

        const sym = d.s.endsWith('USDT') ? d.s.slice(0, -4) : d.s
        const price = parseFloat(d.c)
        const open = parseFloat(d.o)

        setPrices((prev) => ({
          ...prev,
          [sym]: {
            price,
            open,
            high: parseFloat(d.h),
            low: parseFloat(d.l),
            change24h: open > 0 ? ((price - open) / open) * 100 : 0,
            volume: parseFloat(d.q),
            updatedAt: Date.now(),
          },
        }))
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      wsRef.current = null
      // Reconnect with exponential backoff
      reconnectTimerRef.current = setTimeout(() => {
        reconnectDelayRef.current = Math.min(
          reconnectDelayRef.current * 2,
          MAX_RECONNECT_DELAY,
        )
        connect()
      }, reconnectDelayRef.current)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [symbolsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      if (wsRef.current) {
        // Remove onclose so it doesn't trigger reconnect after unmount
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  return prices
}
