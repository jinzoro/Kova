'use client'

import { useFundingRate } from '@/hooks/useFundingRate'
import { useOpenInterest } from '@/hooks/useOpenInterest'

interface Props {
  symbol: string
}

function fmt(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  return `$${n.toLocaleString()}`
}

export default function FuturesPanel({ symbol }: Props) {
  const { data: fr, isLoading: frLoading } = useFundingRate(symbol)
  const { data: oi, isLoading: oiLoading } = useOpenInterest(symbol)

  const isLoading = frLoading || oiLoading

  if (isLoading) return <div className="card skeleton h-32" />

  if (!fr && !oi) {
    return (
      <div className="card text-center py-6 text-gray-500 text-sm">
        No futures data — {symbol.toUpperCase()} may be spot-only
      </div>
    )
  }

  const rate = fr ? parseFloat(fr.fundingRate) * 100 : null
  const oiValue = oi ? parseFloat(oi.openInterest) : null

  const rateIsPos = (rate ?? 0) >= 0
  const rateExtreme = Math.abs(rate ?? 0) > 0.05

  let interpretation = ''
  if (rate !== null) {
    if (rate > 0.1) interpretation = 'Extremely high positive funding — market is overleveraged long. High squeeze risk.'
    else if (rate > 0.05) interpretation = 'Elevated positive funding — longs are paying shorts. Mild bearish pressure on price.'
    else if (rate < -0.05) interpretation = 'Negative funding — shorts are paying longs. Bearish positioning could create a short squeeze.'
    else interpretation = 'Neutral funding — no extreme leverage bias. Balanced futures positioning.'
  }

  return (
    <div className="card space-y-4">
      <h3 className="text-sm font-semibold text-gray-300">Futures Market</h3>

      <div className="grid grid-cols-2 gap-3">
        {/* Funding Rate */}
        {rate !== null && (
          <div className={`p-3 rounded-xl border ${rateExtreme ? (rateIsPos ? 'border-red-500/30 bg-red-500/5' : 'border-green-500/30 bg-green-500/5') : 'border-surface-border bg-surface-muted'}`}>
            <div className="text-xs text-gray-500 mb-1">Funding Rate</div>
            <div className={`text-xl font-mono font-bold ${rateIsPos ? 'text-bear' : 'text-bull'}`}>
              {rateIsPos ? '+' : ''}{rate.toFixed(4)}%
            </div>
            <div className="text-xs text-gray-500 mt-0.5">per 8h</div>
            <div className={`mt-1.5 text-xs font-medium px-2 py-0.5 rounded inline-block ${
              rateExtreme
                ? rateIsPos ? 'bg-red-500/10 text-bear' : 'bg-green-500/10 text-bull'
                : 'bg-gray-500/10 text-gray-400'
            }`}>
              {rateExtreme ? (rateIsPos ? 'Overheated' : 'Short-heavy') : 'Neutral'}
            </div>
          </div>
        )}

        {/* Open Interest */}
        {oiValue !== null && (
          <div className="p-3 rounded-xl border border-surface-border bg-surface-muted">
            <div className="text-xs text-gray-500 mb-1">Open Interest</div>
            <div className="text-xl font-mono font-bold text-blue-300">
              {oiValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">contracts</div>
            <div className="mt-1.5 text-xs text-gray-500">
              Futures positioning depth
            </div>
          </div>
        )}
      </div>

      {interpretation && (
        <p className="text-xs text-gray-400 leading-relaxed bg-surface-muted rounded-lg px-3 py-2">
          {interpretation}
        </p>
      )}

      {fr && (
        <div className="text-xs text-gray-600">
          Next funding: {new Date(fr.fundingTime).toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}
