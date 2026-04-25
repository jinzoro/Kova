'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePortfolio, HoldingWithLive } from '@/hooks/usePortfolio'

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtUSD(n: number): string {
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (Math.abs(n) >= 1e3) return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return `$${n.toFixed(2)}`
}

function fmtPrice(n: number): string {
  if (n >= 10000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (n >= 1000)  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  if (n >= 1)     return `$${n.toFixed(4)}`
  return `$${n.toFixed(6)}`
}

// ─── Add Holding Form ─────────────────────────────────────────────────────────

const QUICK_SYMBOLS = ['BTC','ETH','SOL','BNB','XRP','ADA','DOGE','AVAX','LINK','DOT','MATIC','LTC']

function AddHoldingForm({ onAdd }: { onAdd: (symbol: string, amount: number, avgCost: number) => void }) {
  const [symbol, setSymbol] = useState('')
  const [amount, setAmount] = useState('')
  const [avgCost, setAvgCost] = useState('')
  const [error, setError] = useState('')
  const symbolRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const sym = symbol.trim().toUpperCase()
    const amt = parseFloat(amount)
    const cost = parseFloat(avgCost)
    if (!sym) return setError('Enter a symbol')
    if (isNaN(amt) || amt <= 0) return setError('Invalid amount')
    if (isNaN(cost) || cost <= 0) return setError('Invalid avg cost')
    onAdd(sym, amt, cost)
    setSymbol('')
    setAmount('')
    setAvgCost('')
    symbolRef.current?.focus()
  }

  return (
    <div className="card animate-slide-in-up delay-100">
      <h2 className="text-sm font-semibold text-gray-300 mb-4">Add Holding</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Symbol</label>
            <input
              ref={symbolRef}
              className="input uppercase"
              placeholder="BTC"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Amount (qty)</label>
            <input
              className="input"
              placeholder="0.5"
              type="number"
              step="any"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Avg Buy Price (USD)</label>
            <input
              className="input"
              placeholder="45000"
              type="number"
              step="any"
              min="0"
              value={avgCost}
              onChange={(e) => setAvgCost(e.target.value)}
            />
          </div>
        </div>

        {/* Quick symbol picker */}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_SYMBOLS.map((s) => (
            <button
              key={s} type="button"
              onClick={() => setSymbol(s)}
              className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                symbol === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-surface-muted text-gray-400 hover:text-gray-200 hover:bg-blue-600/20'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary">Add to Portfolio</button>
          {error && <span className="text-xs text-bear">{error}</span>}
        </div>
      </form>
    </div>
  )
}

// ─── Allocation bar ───────────────────────────────────────────────────────────

const COIN_COLORS: Record<string, string> = {
  BTC: '#f97316', ETH: '#60a5fa', SOL: '#a78bfa', BNB: '#fbbf24',
  XRP: '#34d399', ADA: '#22d3ee', DOGE: '#facc15', AVAX: '#f87171',
  LINK: '#818cf8', DOT: '#e879f9', MATIC: '#c084fc', LTC: '#9ca3af',
}

function coinColor(symbol: string): string {
  return COIN_COLORS[symbol] ?? '#6b7280'
}

function AllocationBar({ holdings, totalValue }: { holdings: HoldingWithLive[]; totalValue: number }) {
  if (totalValue === 0) return null

  return (
    <div className="space-y-2">
      <div className="h-4 rounded-full overflow-hidden flex gap-px">
        {holdings
          .filter((h) => h.value)
          .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
          .map((h) => (
            <div
              key={h.id}
              className="h-full transition-all duration-700"
              style={{
                width: `${((h.value ?? 0) / totalValue) * 100}%`,
                background: coinColor(h.symbol),
                opacity: 0.85,
              }}
              title={`${h.symbol}: ${(((h.value ?? 0) / totalValue) * 100).toFixed(1)}%`}
            />
          ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {holdings
          .filter((h) => h.value)
          .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
          .map((h) => (
            <div key={h.id} className="flex items-center gap-1.5 text-xs">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: coinColor(h.symbol) }} />
              <span className="font-mono text-gray-400">{h.symbol}</span>
              <span className="text-gray-600">{(((h.value ?? 0) / totalValue) * 100).toFixed(1)}%</span>
            </div>
          ))}
      </div>
    </div>
  )
}

// ─── Holdings table ───────────────────────────────────────────────────────────

function HoldingsTable({
  holdings, onRemove, totalValue
}: {
  holdings: HoldingWithLive[]
  onRemove: (id: string) => void
  totalValue: number
}) {
  if (holdings.length === 0) {
    return (
      <div className="card text-center py-16 animate-fade-in">
        <p className="text-gray-500 text-sm mb-2">No holdings yet.</p>
        <p className="text-gray-600 text-xs">Add your first coin above to start tracking.</p>
      </div>
    )
  }

  const sorted = [...holdings].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

  return (
    <div className="card overflow-x-auto animate-slide-in-up delay-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500 border-b border-surface-border">
            <th className="text-left py-3 pr-4 font-medium">Asset</th>
            <th className="text-right py-3 px-3 font-medium">Amount</th>
            <th className="text-right py-3 px-3 font-medium">Avg Cost</th>
            <th className="text-right py-3 px-3 font-medium">Current Price</th>
            <th className="text-right py-3 px-3 font-medium">Value</th>
            <th className="text-right py-3 px-3 font-medium">P&amp;L</th>
            <th className="text-right py-3 px-3 font-medium">Allocation</th>
            <th className="py-3 pl-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border/50">
          {sorted.map((h, i) => (
            <tr key={h.id}
              className="hover:bg-surface-muted/40 transition-colors animate-slide-in-left"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <td className="py-3 pr-4">
                <Link href={`/coin/${h.symbol.toLowerCase()}`} className="flex items-center gap-2 group">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: coinColor(h.symbol) }} />
                  <span className="font-mono font-bold text-gray-100 group-hover:text-blue-300 transition-colors">{h.symbol}</span>
                </Link>
              </td>
              <td className="py-3 px-3 text-right font-mono text-gray-400 text-xs">{h.amount}</td>
              <td className="py-3 px-3 text-right font-mono text-gray-400 text-xs">{fmtPrice(h.avgCost)}</td>
              <td className="py-3 px-3 text-right font-mono text-gray-300 text-xs">
                {h.currentPrice !== null ? fmtPrice(h.currentPrice) : <span className="text-gray-600">—</span>}
              </td>
              <td className="py-3 px-3 text-right font-mono font-semibold text-gray-200">
                {h.value !== null ? fmtUSD(h.value) : '—'}
              </td>
              <td className="py-3 px-3 text-right">
                {h.pnl !== null ? (
                  <div className={`text-right ${h.pnl >= 0 ? 'text-bull' : 'text-bear'}`}>
                    <div className="font-mono font-bold text-xs">
                      {h.pnl >= 0 ? '+' : ''}{fmtUSD(h.pnl)}
                    </div>
                    <div className="font-mono text-xs opacity-75">
                      {h.pnlPct !== null ? `${h.pnlPct >= 0 ? '+' : ''}${h.pnlPct.toFixed(2)}%` : ''}
                    </div>
                  </div>
                ) : <span className="text-gray-600">—</span>}
              </td>
              <td className="py-3 px-3 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <div className="w-16 h-1.5 bg-surface-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${totalValue > 0 ? ((h.value ?? 0) / totalValue) * 100 : 0}%`,
                        background: coinColor(h.symbol),
                        opacity: 0.8,
                      }}
                    />
                  </div>
                  <span className="font-mono text-xs text-gray-500 w-10 text-right">
                    {totalValue > 0 ? `${(((h.value ?? 0) / totalValue) * 100).toFixed(1)}%` : '—'}
                  </span>
                </div>
              </td>
              <td className="py-3 pl-3">
                <button
                  onClick={() => onRemove(h.id)}
                  className="text-gray-700 hover:text-bear transition-colors text-xs"
                  title="Remove holding"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PortfolioClient() {
  const {
    holdings,
    addHolding,
    removeHolding,
    totalValue,
    totalCost,
    totalPnl,
    totalPnlPct,
    isLoading,
  } = usePortfolio()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 animate-slide-in-left">
        <div>
          <h1 className="text-2xl font-bold text-shimmer">Portfolio Tracker</h1>
          <p className="text-sm text-gray-500 mt-1 animate-fade-in delay-100">
            Track your holdings with live prices — stored locally in your browser
          </p>
        </div>
        <div className="text-xs text-gray-600 flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Prices refresh every 30s
        </div>
      </div>

      {/* Summary cards */}
      {holdings.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-slide-in-up">
          {[
            { label: 'Total Value',   value: fmtUSD(totalValue),  color: 'text-gray-100' },
            { label: 'Total Cost',    value: fmtUSD(totalCost),   color: 'text-gray-400' },
            { label: 'Unrealized P&L', value: `${totalPnl >= 0 ? '+' : ''}${fmtUSD(totalPnl)}`, color: totalPnl >= 0 ? 'text-bull' : 'text-bear' },
            { label: 'Return',        value: `${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(2)}%`, color: totalPnlPct >= 0 ? 'text-bull' : 'text-bear' },
          ].map(({ label, value, color }, i) => (
            <div key={label} className="card-live text-center animate-scale-in" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="text-xs text-gray-500 mb-1">{label}</div>
              <div className={`font-mono font-bold text-lg ${color}`}>{isLoading ? '—' : value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Allocation bar */}
      {holdings.length > 1 && totalValue > 0 && (
        <div className="card animate-slide-in-up delay-100">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Allocation</h2>
          <AllocationBar holdings={holdings} totalValue={totalValue} />
        </div>
      )}

      {/* Add form */}
      <AddHoldingForm onAdd={addHolding} />

      {/* Holdings table */}
      <HoldingsTable holdings={holdings} onRemove={removeHolding} totalValue={totalValue} />

      <p className="text-xs text-gray-600 text-center">
        Data stored locally in your browser — never sent to any server · Prices from Binance public API
      </p>
    </div>
  )
}
