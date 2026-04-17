'use client'

import { useMemo } from 'react'
import { useKlines } from '@/hooks/useKlines'
import { calcCorrelationMatrix } from '@/lib/correlation'

const SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA']

function corrColor(r: number): string {
  if (r >= 0.8)  return 'bg-green-500/30 text-green-300'
  if (r >= 0.5)  return 'bg-green-500/15 text-green-400'
  if (r >= 0.2)  return 'bg-blue-500/10 text-blue-300'
  if (r >= -0.2) return 'bg-gray-500/10 text-gray-400'
  if (r >= -0.5) return 'bg-orange-500/10 text-orange-400'
  return 'bg-red-500/15 text-red-400'
}

function SymbolRow({ symbol, allKlines }: { symbol: string; allKlines: Record<string, number[] | undefined> }) {
  const { data: klines } = useKlines(symbol, '1d', 30)
  const closes = klines?.map((k) => k.close) ?? []

  return { symbol, closes }
}

// Split into a wrapper so we can call hooks per-symbol
function useAllKlines(symbols: string[]) {
  const btc = useKlines('BTC', '1d', 30)
  const eth = useKlines('ETH', '1d', 30)
  const sol = useKlines('SOL', '1d', 30)
  const bnb = useKlines('BNB', '1d', 30)
  const xrp = useKlines('XRP', '1d', 30)
  const ada = useKlines('ADA', '1d', 30)

  const map: Record<string, number[]> = {}
  const all = [btc, eth, sol, bnb, xrp, ada]
  for (let i = 0; i < symbols.length; i++) {
    const d = all[i].data
    if (d && d.length > 0) map[symbols[i]] = d.map((k) => k.close)
  }
  const loading = all.some((q) => q.isLoading)
  return { map, loading }
}

export default function CorrelationMatrix() {
  const { map, loading } = useAllKlines(SYMBOLS)

  const matrix = useMemo(() => {
    if (Object.keys(map).length < 2) return null
    return calcCorrelationMatrix(map)
  }, [map])

  const availableSymbols = SYMBOLS.filter((s) => map[s])

  if (loading && availableSymbols.length === 0) {
    return (
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-gray-300">30-Day Correlation Matrix</h3>
        <div className="skeleton h-40 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">30-Day Correlation Matrix</h3>
        <span className="text-xs text-gray-600">Daily returns (Pearson)</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left pb-2 text-gray-600 font-mono w-12" />
              {availableSymbols.map((s) => (
                <th key={s} className="text-center pb-2 text-gray-500 font-mono font-medium px-1">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {availableSymbols.map((rowSym) => (
              <tr key={rowSym}>
                <td className="py-1 pr-2 font-mono font-semibold text-gray-400">{rowSym}</td>
                {availableSymbols.map((colSym) => {
                  const r = matrix?.[rowSym]?.[colSym] ?? NaN
                  const isDiag = rowSym === colSym
                  return (
                    <td key={colSym} className="py-1 px-1 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded font-mono font-bold text-xs ${
                        isDiag ? 'bg-blue-500/20 text-blue-300' : corrColor(r)
                      }`}>
                        {isDiag ? '1.00' : isNaN(r) ? '—' : r.toFixed(2)}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-gray-600">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-500/30 inline-block" /> High (≥0.8)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-500/15 inline-block" /> Moderate (0.5–0.8)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-gray-500/10 inline-block" /> Low (−0.2–0.2)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-500/15 inline-block" /> Negative</span>
      </div>
      <p className="text-xs text-gray-600">
        High correlation = assets move together (diversification limited). Low/negative correlation = better portfolio hedge.
      </p>
    </div>
  )
}
