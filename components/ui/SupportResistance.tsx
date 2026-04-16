'use client'

import type { Kline } from '@/lib/binance'
import { getNearestSRLevels } from '@/lib/indicators'

interface Props {
  klines: Kline[]
  currentPrice: number
}

function fmt(p: number): string {
  if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (p >= 1) return p.toFixed(4)
  return p.toFixed(6)
}

export default function SupportResistance({ klines, currentPrice }: Props) {
  if (klines.length < 15) return null

  const { resistance, support } = getNearestSRLevels(klines, currentPrice, 3)

  const pctFrom = (price: number) => (((price - currentPrice) / currentPrice) * 100).toFixed(2)

  return (
    <div className="card space-y-4">
      <h3 className="text-sm font-semibold text-gray-300">Support & Resistance</h3>

      {/* Resistance */}
      <div className="space-y-2">
        <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">Resistance</div>
        {resistance.length === 0 ? (
          <p className="text-xs text-gray-500">No nearby resistance levels detected</p>
        ) : (
          resistance.map((lvl, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-bear" />
                <span className="font-mono text-sm text-bear">${fmt(lvl.price)}</span>
              </div>
              <span className="text-xs text-gray-500 font-mono">+{pctFrom(lvl.price)}%</span>
            </div>
          ))
        )}
      </div>

      {/* Current price line */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-surface-border" />
        <span className="text-xs font-mono text-blue-400 font-bold">${fmt(currentPrice)}</span>
        <div className="flex-1 h-px bg-surface-border" />
      </div>

      {/* Support */}
      <div className="space-y-2">
        <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">Support</div>
        {support.length === 0 ? (
          <p className="text-xs text-gray-500">No nearby support levels detected</p>
        ) : (
          support.map((lvl, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-bull" />
                <span className="font-mono text-sm text-bull">${fmt(lvl.price)}</span>
              </div>
              <span className="text-xs text-gray-500 font-mono">{pctFrom(lvl.price)}%</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
