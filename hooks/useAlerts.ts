'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { fetchPrice } from '@/lib/binance'

export interface PriceAlert {
  id: string
  symbol: string
  targetPrice: number
  currentPrice: number
  createdAt: number
}

const STORAGE_KEY = 'kova:alerts'
const THRESHOLD = 0.005  // 0.5%

function loadAlerts(): PriceAlert[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveAlerts(alerts: PriceAlert[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts))
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([])

  useEffect(() => {
    setAlerts(loadAlerts())
  }, [])

  const addAlert = useCallback((symbol: string, targetPrice: number, currentPrice: number) => {
    const alert: PriceAlert = {
      id: `${symbol}-${Date.now()}`,
      symbol: symbol.toUpperCase(),
      targetPrice,
      currentPrice,
      createdAt: Date.now(),
    }
    setAlerts((prev) => {
      const next = [...prev, alert]
      saveAlerts(next)
      return next
    })
  }, [])

  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => {
      const next = prev.filter((a) => a.id !== id)
      saveAlerts(next)
      return next
    })
  }, [])

  // Poll every 60 seconds
  useEffect(() => {
    if (alerts.length === 0) return

    const check = async () => {
      const triggered: string[] = []
      await Promise.all(
        alerts.map(async (alert) => {
          try {
            const price = await fetchPrice(alert.symbol)
            const dist = Math.abs(price - alert.targetPrice) / alert.targetPrice
            if (dist <= THRESHOLD) {
              triggered.push(alert.id)
              toast.success(`${alert.symbol} reached $${alert.targetPrice.toLocaleString()}`, {
                duration: 8000,
                icon: '🔔',
              })
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(`Kova Alert: ${alert.symbol}`, {
                  body: `Price hit $${alert.targetPrice.toLocaleString()} (current: $${price.toLocaleString()})`,
                })
              }
            }
          } catch {
            // ignore fetch errors
          }
        }),
      )
      if (triggered.length > 0) {
        setAlerts((prev) => {
          const next = prev.filter((a) => !triggered.includes(a.id))
          saveAlerts(next)
          return next
        })
      }
    }

    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [alerts])

  return { alerts, addAlert, removeAlert }
}
