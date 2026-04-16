'use client'

import { useState, useEffect } from 'react'
import { useAlerts } from '@/hooks/useAlerts'
import { fetchPrice } from '@/lib/binance'
import { searchCoins } from '@/lib/coingecko'
import toast from 'react-hot-toast'

const POPULAR = ['BTC', 'ETH', 'SOL', 'BNB', 'ADA', 'XRP', 'DOGE', 'AVAX', 'LINK', 'DOT']

function fmt(n: number): string {
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (n >= 1) return n.toFixed(4)
  return n.toFixed(6)
}

export default function AlertsClient() {
  const { alerts, addAlert, removeAlert } = useAlerts()
  const [symbol, setSymbol] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<{ symbol: string; name: string }[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Fetch current price when symbol changes
  useEffect(() => {
    if (!symbol) { setCurrentPrice(null); return }
    const timer = setTimeout(async () => {
      try {
        const p = await fetchPrice(symbol)
        setCurrentPrice(p)
      } catch {
        setCurrentPrice(null)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [symbol])

  // Autocomplete
  useEffect(() => {
    if (!symbol || symbol.length < 2) { setSuggestions([]); return }
    const timer = setTimeout(async () => {
      try {
        const res = await searchCoins(symbol)
        setSuggestions(res.coins.slice(0, 5).map((c) => ({ symbol: c.symbol.toUpperCase(), name: c.name })))
        setShowSuggestions(true)
      } catch {
        setSuggestions([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [symbol])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!symbol || !targetPrice) return
    setLoading(true)
    try {
      const price = currentPrice ?? await fetchPrice(symbol)
      addAlert(symbol, parseFloat(targetPrice), price)
      toast.success(`Alert set for ${symbol.toUpperCase()} at $${parseFloat(targetPrice).toLocaleString()}`)
      setSymbol('')
      setTargetPrice('')
      setCurrentPrice(null)
    } catch {
      toast.error('Could not find price for this symbol')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Price Alerts</h1>
        <p className="text-sm text-gray-500 mt-1">
          Get notified when a coin reaches your target price. Alerts are stored locally and checked every 60 seconds.
        </p>
      </div>

      {/* Form */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">New Alert</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Symbol input with autocomplete */}
          <div className="relative">
            <label className="block text-xs text-gray-500 mb-1">Coin Symbol</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="BTC, ETH, SOL…"
                  className="input font-mono uppercase"
                  required
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full mt-1 w-full bg-surface-card border border-surface-border rounded-xl z-10 overflow-hidden shadow-xl">
                    {suggestions.map((s) => (
                      <button
                        key={s.symbol}
                        type="button"
                        onMouseDown={() => { setSymbol(s.symbol); setShowSuggestions(false) }}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-surface-muted text-left"
                      >
                        <span className="font-mono text-gray-100">{s.symbol}</span>
                        <span className="text-gray-500 text-xs">{s.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {currentPrice && (
                <div className="text-xs text-gray-400 font-mono shrink-0">
                  Now: ${fmt(currentPrice)}
                </div>
              )}
            </div>

            {/* Quick select */}
            <div className="flex flex-wrap gap-1 mt-2">
              {POPULAR.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSymbol(s)}
                  className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
                    symbol === s
                      ? 'bg-blue-600 text-white'
                      : 'bg-surface-muted text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Target Price (USD)</label>
            <input
              type="number"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="e.g. 100000"
              step="any"
              min="0"
              className="input font-mono"
              required
            />
            {currentPrice && targetPrice && (
              <div className="text-xs mt-1 text-gray-500">
                Distance: {(((parseFloat(targetPrice) - currentPrice) / currentPrice) * 100).toFixed(2)}% from current
              </div>
            )}
          </div>

          <button type="submit" disabled={loading || !symbol || !targetPrice} className="btn-primary w-full">
            {loading ? 'Setting alert…' : 'Set Alert'}
          </button>
        </form>
      </div>

      {/* Active Alerts Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-300">Active Alerts</h2>
          <span className="text-xs text-gray-500 font-mono">{alerts.length} alert{alerts.length !== 1 ? 's' : ''}</span>
        </div>

        {alerts.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">No active alerts. Add one above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-surface-border">
                  <th className="text-left pb-2 font-medium">Coin</th>
                  <th className="text-right pb-2 font-medium">Target</th>
                  <th className="text-right pb-2 font-medium">Created</th>
                  <th className="text-right pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {alerts.map((alert) => (
                  <AlertRow key={alert.id} alert={alert} onRemove={() => removeAlert(alert.id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-600 text-center">
        Alerts trigger when price is within 0.5% of target. Requires tab to be open.
        {' '}
        {typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'denied' && (
          <span className="text-warn">Browser notifications blocked — enable in site settings.</span>
        )}
      </p>
    </div>
  )
}

interface AlertRowProps {
  alert: { id: string; symbol: string; targetPrice: number; currentPrice: number; createdAt: number }
  onRemove: () => void
}

function AlertRow({ alert, onRemove }: AlertRowProps) {
  const [livePrice, setLivePrice] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const p = await fetchPrice(alert.symbol)
        setLivePrice(p)
      } catch {
        setLivePrice(null)
      }
    }
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [alert.symbol])

  const price = livePrice ?? alert.currentPrice
  const dist = (((alert.targetPrice - price) / price) * 100).toFixed(2)
  const isAbove = alert.targetPrice > price

  return (
    <tr>
      <td className="py-2">
        <span className="font-mono font-bold text-gray-100">{alert.symbol}</span>
      </td>
      <td className="py-2 text-right">
        <div className="font-mono text-gray-100">${fmt(alert.targetPrice)}</div>
        <div className={`text-xs font-mono ${isAbove ? 'text-bull' : 'text-bear'}`}>
          {isAbove ? '▲' : '▼'} {Math.abs(parseFloat(dist))}%
        </div>
      </td>
      <td className="py-2 text-right text-xs text-gray-500">
        {new Date(alert.createdAt).toLocaleDateString()}
      </td>
      <td className="py-2 text-right">
        <button
          onClick={onRemove}
          className="text-xs text-gray-500 hover:text-bear transition-colors"
        >
          Remove
        </button>
      </td>
    </tr>
  )
}
