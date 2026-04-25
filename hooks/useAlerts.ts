'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'

export type AlertType = 'above' | 'below'

export interface PriceAlert {
  id: string
  symbol: string
  targetPrice: number
  currentPrice: number   // price at creation time
  type: AlertType        // 'above' | 'below'
  createdAt: number
}

export interface TriggeredAlert {
  id: string
  symbol: string
  targetPrice: number
  triggerPrice: number
  type: AlertType
  triggeredAt: number
}

const STORAGE_KEY          = 'kova:alerts'
const HISTORY_STORAGE_KEY  = 'kova:alerts-history'
const MAX_HISTORY          = 20

function loadAlerts(): PriceAlert[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}

function saveAlerts(alerts: PriceAlert[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts))
}

function loadHistory(): TriggeredAlert[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) ?? '[]') } catch { return [] }
}

function saveHistory(h: TriggeredAlert[]) {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(h.slice(0, MAX_HISTORY)))
}

// ─── Check if an alert should fire ───────────────────────────────────────────

function shouldFire(alert: PriceAlert, price: number): boolean {
  if (alert.type === 'above') return price >= alert.targetPrice
  return price <= alert.targetPrice
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAlerts() {
  const [alerts,  setAlerts]  = useState<PriceAlert[]>([])
  const [history, setHistory] = useState<TriggeredAlert[]>([])
  // Live prices from WebSocket (symbol → price)
  const [livePrices, setLivePrices] = useState<Record<string, number>>({})

  const alertsRef = useRef<PriceAlert[]>([])
  alertsRef.current = alerts

  // Load from storage on mount
  useEffect(() => {
    setAlerts(loadAlerts())
    setHistory(loadHistory())
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // ── WebSocket price stream for all alert symbols ──────────────────────────
  useEffect(() => {
    const symbols = [...new Set(alerts.map((a) => a.symbol))]
    if (symbols.length === 0) return

    const streams = symbols.map((s) => `${s.toLowerCase()}usdt@miniTicker`).join('/')
    const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`)

    ws.onmessage = (ev) => {
      try {
        const msg: { stream: string; data: { s: string; c: string } } = JSON.parse(ev.data)
        const sym = msg.data.s.replace('USDT', '')
        const price = parseFloat(msg.data.c)
        setLivePrices((prev) => ({ ...prev, [sym]: price }))

        // Check alerts in real time
        const toFire = alertsRef.current.filter(
          (a) => a.symbol === sym && shouldFire(a, price)
        )
        if (toFire.length > 0) fireAlerts(toFire, price)
      } catch { /* ignore parse errors */ }
    }

    return () => ws.close()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts.map((a) => a.symbol).sort().join(',')])

  // ── Fire triggered alerts ─────────────────────────────────────────────────
  const fireAlerts = useCallback((toFire: PriceAlert[], price: number) => {
    const ids = toFire.map((a) => a.id)

    toFire.forEach((alert) => {
      const dir = alert.type === 'above' ? '▲ crossed above' : '▼ crossed below'
      toast.success(`${alert.symbol} ${dir} $${alert.targetPrice.toLocaleString()}`, {
        duration: 8000, icon: '🔔',
      })
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`Kova Alert: ${alert.symbol}`, {
          body: `${dir} $${alert.targetPrice.toLocaleString()} (price: $${price.toLocaleString()})`,
        })
      }
    })

    const newHistory: TriggeredAlert[] = toFire.map((a) => ({
      id: a.id,
      symbol: a.symbol,
      targetPrice: a.targetPrice,
      triggerPrice: price,
      type: a.type,
      triggeredAt: Date.now(),
    }))

    setHistory((prev) => {
      const updated = [...newHistory, ...prev]
      saveHistory(updated)
      return updated
    })

    setAlerts((prev) => {
      const next = prev.filter((a) => !ids.includes(a.id))
      saveAlerts(next)
      return next
    })
  }, [])

  // ── Add alert ─────────────────────────────────────────────────────────────
  const addAlert = useCallback((
    symbol: string,
    targetPrice: number,
    currentPrice: number,
    type: AlertType = 'above',
  ) => {
    const alert: PriceAlert = {
      id: `${symbol}-${Date.now()}`,
      symbol: symbol.toUpperCase(),
      targetPrice,
      currentPrice,
      type,
      createdAt: Date.now(),
    }
    setAlerts((prev) => {
      const next = [...prev, alert]
      saveAlerts(next)
      return next
    })
  }, [])

  // ── Remove alert ──────────────────────────────────────────────────────────
  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => {
      const next = prev.filter((a) => a.id !== id)
      saveAlerts(next)
      return next
    })
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    saveHistory([])
  }, [])

  return { alerts, history, livePrices, addAlert, removeAlert, clearHistory }
}
