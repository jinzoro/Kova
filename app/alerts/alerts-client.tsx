'use client'

import { useState, useEffect } from 'react'
import { useAlerts, AlertType, PriceAlert, TriggeredAlert } from '@/hooks/useAlerts'
import { fetchPrice } from '@/lib/binance'
import { searchCoins } from '@/lib/coingecko'
import toast from 'react-hot-toast'
import Link from 'next/link'

const POPULAR = ['BTC','ETH','SOL','BNB','ADA','XRP','DOGE','AVAX','LINK','DOT','MATIC','LTC']

function fmtPrice(n: number): string {
  if (n >= 10000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (n >= 1000)  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  if (n >= 1)     return `$${n.toFixed(4)}`
  return `$${n.toFixed(6)}`
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(ms).toLocaleDateString()
}

// ─── Active Alert Row ─────────────────────────────────────────────────────────

function AlertRow({ alert, livePrice, onRemove }: {
  alert: PriceAlert
  livePrice: number | undefined
  onRemove: () => void
}) {
  const price = livePrice ?? alert.currentPrice
  const dist = ((alert.targetPrice - price) / price) * 100
  const triggered = alert.type === 'above' ? price >= alert.targetPrice : price <= alert.targetPrice
  const dirColor = alert.type === 'above' ? 'text-bull' : 'text-bear'
  const dirIcon  = alert.type === 'above' ? '▲' : '▼'

  return (
    <tr className="hover:bg-surface-muted/40 transition-colors">
      <td className="py-3 pr-4">
        <Link href={`/coin/${alert.symbol.toLowerCase()}`} className="font-mono font-bold text-gray-100 hover:text-blue-300 transition-colors">
          {alert.symbol}
        </Link>
      </td>
      <td className="py-3 px-3">
        <span className={`inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded ${
          alert.type === 'above'
            ? 'bg-green-500/10 text-bull border border-green-500/20'
            : 'bg-red-500/10 text-bear border border-red-500/20'
        }`}>
          {dirIcon} {alert.type === 'above' ? 'Crosses above' : 'Drops below'}
        </span>
      </td>
      <td className="py-3 px-3 text-right font-mono text-gray-100">{fmtPrice(alert.targetPrice)}</td>
      <td className="py-3 px-3 text-right">
        <div className="font-mono text-xs text-gray-400">{fmtPrice(price)}</div>
        <div className={`text-xs font-mono font-bold ${dirColor}`}>
          {dist >= 0 ? '+' : ''}{dist.toFixed(2)}%
        </div>
      </td>
      <td className="py-3 px-3 text-right">
        {/* Progress bar toward target */}
        <div className="flex items-center justify-end gap-2">
          {triggered ? (
            <span className="text-xs text-warn font-mono animate-pulse">Triggering…</span>
          ) : (
            <div className="w-20 h-1.5 bg-surface-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${alert.type === 'above' ? 'bg-bull' : 'bg-bear'}`}
                style={{ width: `${Math.min(100, Math.max(0, 100 - Math.abs(dist)))}%`, opacity: 0.75 }}
              />
            </div>
          )}
        </div>
      </td>
      <td className="py-3 px-3 text-right text-xs text-gray-600">{timeAgo(alert.createdAt)}</td>
      <td className="py-3 pl-3 text-right">
        <button onClick={onRemove} className="text-gray-600 hover:text-bear transition-colors text-xs px-2 py-1 rounded hover:bg-red-500/10">
          Remove
        </button>
      </td>
    </tr>
  )
}

// ─── Triggered History Row ─────────────────────────────────────────────────────

function HistoryRow({ item }: { item: TriggeredAlert }) {
  return (
    <tr className="opacity-70">
      <td className="py-2 pr-4">
        <Link href={`/coin/${item.symbol.toLowerCase()}`} className="font-mono font-bold text-gray-400 hover:text-gray-200 transition-colors">
          {item.symbol}
        </Link>
      </td>
      <td className="py-2 px-3">
        <span className={`text-xs font-mono ${item.type === 'above' ? 'text-green-600' : 'text-red-600'}`}>
          {item.type === 'above' ? '▲ above' : '▼ below'} {fmtPrice(item.targetPrice)}
        </span>
      </td>
      <td className="py-2 px-3 text-right font-mono text-xs text-gray-500">
        triggered @ {fmtPrice(item.triggerPrice)}
      </td>
      <td className="py-2 pl-3 text-right text-xs text-gray-600">{timeAgo(item.triggeredAt)}</td>
    </tr>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AlertsClient() {
  const { alerts, history, livePrices, addAlert, removeAlert, clearHistory } = useAlerts()

  const [symbol, setSymbol]     = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [alertType, setAlertType]     = useState<AlertType>('above')
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [loading, setLoading]   = useState(false)
  const [suggestions, setSuggestions] = useState<{ symbol: string; name: string }[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [tab, setTab] = useState<'active' | 'history'>('active')

  // Fetch current price with debounce
  useEffect(() => {
    if (!symbol) { setCurrentPrice(null); return }
    const timer = setTimeout(async () => {
      try { setCurrentPrice(await fetchPrice(symbol)) }
      catch { setCurrentPrice(null) }
    }, 500)
    return () => clearTimeout(timer)
  }, [symbol])

  // Auto-set alert type based on target vs current price
  useEffect(() => {
    if (!targetPrice || !currentPrice) return
    setAlertType(parseFloat(targetPrice) >= currentPrice ? 'above' : 'below')
  }, [targetPrice, currentPrice])

  // Autocomplete
  useEffect(() => {
    if (!symbol || symbol.length < 2) { setSuggestions([]); return }
    const timer = setTimeout(async () => {
      try {
        const res = await searchCoins(symbol)
        setSuggestions(res.coins.slice(0, 5).map((c) => ({ symbol: c.symbol.toUpperCase(), name: c.name })))
        setShowSuggestions(true)
      } catch { setSuggestions([]) }
    }, 300)
    return () => clearTimeout(timer)
  }, [symbol])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!symbol || !targetPrice) return
    setLoading(true)
    try {
      const price = currentPrice ?? await fetchPrice(symbol)
      const target = parseFloat(targetPrice)
      addAlert(symbol, target, price, alertType)
      toast.success(`Alert set: ${symbol.toUpperCase()} ${alertType === 'above' ? '▲ above' : '▼ below'} ${fmtPrice(target)}`)
      setSymbol('')
      setTargetPrice('')
      setCurrentPrice(null)
    } catch {
      toast.error('Could not find price for this symbol')
    } finally {
      setLoading(false)
    }
  }

  const notifBlocked = typeof window !== 'undefined'
    && 'Notification' in window
    && Notification.permission === 'denied'

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="animate-slide-in-left">
        <h1 className="text-2xl font-bold text-shimmer">Price Alerts</h1>
        <p className="text-sm text-gray-500 mt-1">
          Real-time WebSocket notifications when coins cross your target price.
        </p>
      </div>

      {notifBlocked && (
        <div className="card bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400 px-4 py-3">
          Browser notifications are blocked. Enable them in site settings to receive alerts.
        </div>
      )}

      {/* WebSocket status */}
      {alerts.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Monitoring {[...new Set(alerts.map((a) => a.symbol))].join(', ')} via WebSocket
        </div>
      )}

      {/* New Alert Form */}
      <div className="card animate-slide-in-up delay-100">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">New Alert</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Symbol */}
          <div className="relative">
            <label className="block text-xs text-gray-500 mb-1">Coin Symbol</label>
            <div className="flex items-center gap-3">
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
                        key={s.symbol} type="button"
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
                <div className="text-xs text-gray-400 font-mono shrink-0 bg-surface-muted px-2 py-1.5 rounded-lg">
                  Now: {fmtPrice(currentPrice)}
                </div>
              )}
            </div>
            {/* Quick picks */}
            <div className="flex flex-wrap gap-1 mt-2">
              {POPULAR.map((s) => (
                <button key={s} type="button" onClick={() => setSymbol(s)}
                  className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
                    symbol === s ? 'bg-blue-600 text-white' : 'bg-surface-muted text-gray-400 hover:text-gray-200'
                  }`}>{s}</button>
              ))}
            </div>
          </div>

          {/* Target price + type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Target Price (USD)</label>
              <input
                type="number" value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="e.g. 100000" step="any" min="0"
                className="input font-mono" required
              />
              {currentPrice && targetPrice && (
                <div className="text-xs mt-1 text-gray-600">
                  {(((parseFloat(targetPrice) - currentPrice) / currentPrice) * 100).toFixed(2)}% from current price
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Alert Type</label>
              <div className="grid grid-cols-2 gap-2">
                {(['above', 'below'] as AlertType[]).map((t) => (
                  <button key={t} type="button" onClick={() => setAlertType(t)}
                    className={`py-2 rounded-lg text-sm font-medium transition-all ${
                      alertType === t
                        ? t === 'above'
                          ? 'bg-green-600/30 border border-green-500/50 text-bull'
                          : 'bg-red-600/30 border border-red-500/50 text-bear'
                        : 'bg-surface-muted text-gray-400 hover:text-gray-200 border border-transparent'
                    }`}
                  >
                    {t === 'above' ? '▲ Crosses Above' : '▼ Drops Below'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading || !symbol || !targetPrice} className="btn-primary w-full">
            {loading ? 'Setting alert…' : `Set Alert — ${alertType === 'above' ? '▲' : '▼'} ${symbol || '…'} ${targetPrice ? fmtPrice(parseFloat(targetPrice)) : ''}`}
          </button>
        </form>
      </div>

      {/* Tabs: Active / History */}
      <div className="animate-slide-in-up delay-200">
        <div className="flex items-center gap-1 mb-4">
          {(['active', 'history'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                tab === t ? 'bg-blue-600 text-white' : 'bg-surface-muted text-gray-400 hover:text-gray-200'
              }`}
            >
              {t}
              {t === 'active' && alerts.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-blue-500/30 text-xs">{alerts.length}</span>
              )}
            </button>
          ))}
          {tab === 'history' && history.length > 0 && (
            <button onClick={clearHistory} className="ml-auto text-xs text-gray-600 hover:text-gray-400 transition-colors">
              Clear history
            </button>
          )}
        </div>

        {/* Active alerts */}
        {tab === 'active' && (
          <div className="card overflow-x-auto">
            {alerts.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No active alerts. Add one above.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-surface-border">
                    <th className="text-left py-3 pr-4 font-medium">Coin</th>
                    <th className="text-left py-3 px-3 font-medium">Type</th>
                    <th className="text-right py-3 px-3 font-medium">Target</th>
                    <th className="text-right py-3 px-3 font-medium">Current</th>
                    <th className="text-right py-3 px-3 font-medium">Progress</th>
                    <th className="text-right py-3 px-3 font-medium">Set</th>
                    <th className="py-3 pl-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/50">
                  {alerts.map((a) => (
                    <AlertRow key={a.id} alert={a} livePrice={livePrices[a.symbol]} onRemove={() => removeAlert(a.id)} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Triggered history */}
        {tab === 'history' && (
          <div className="card overflow-x-auto">
            {history.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No triggered alerts yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-surface-border">
                    <th className="text-left py-3 pr-4 font-medium">Coin</th>
                    <th className="text-left py-3 px-3 font-medium">Alert</th>
                    <th className="text-right py-3 px-3 font-medium">Trigger Price</th>
                    <th className="text-right py-3 pl-3 font-medium">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/50">
                  {history.map((item) => <HistoryRow key={item.id + item.triggeredAt} item={item} />)}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-600 text-center">
        Alerts checked in real-time via Binance WebSocket · Stored locally · Tab must remain open
      </p>
    </div>
  )
}
