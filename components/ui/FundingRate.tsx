'use client'

import { useFundingRate } from '@/hooks/useFundingRate'

interface Props {
  symbol: string
}

export default function FundingRateBadge({ symbol }: Props) {
  const { data, isLoading } = useFundingRate(symbol)

  if (isLoading) {
    return <div className="skeleton h-8 w-36 rounded" />
  }

  if (!data) {
    return (
      <div className="card inline-flex items-center gap-2">
        <span className="text-xs text-gray-500">Funding Rate</span>
        <span className="text-xs font-mono text-gray-400">N/A (spot only)</span>
      </div>
    )
  }

  const rate = parseFloat(data.fundingRate) * 100
  const isPos = rate >= 0
  const nextFunding = new Date(data.fundingTime).toLocaleTimeString()

  return (
    <div
      className="card inline-flex items-center gap-3"
      title={`Funding rate: ${rate.toFixed(4)}% every 8h. Next funding at ${nextFunding}. Positive = longs pay shorts (bearish pressure). Negative = shorts pay longs (bullish pressure).`}
    >
      <div>
        <div className="text-xs text-gray-500 mb-0.5">Funding Rate</div>
        <div className={`font-mono text-sm font-bold ${isPos ? 'text-bear' : 'text-bull'}`}>
          {isPos ? '+' : ''}{rate.toFixed(4)}%
        </div>
      </div>
      <div className="text-xs text-gray-500">
        <div>Per 8h</div>
        <div>Next: {nextFunding}</div>
      </div>
      <div
        className={`text-xs px-2 py-1 rounded font-medium ${
          Math.abs(rate) > 0.05
            ? isPos
              ? 'bg-red-500/10 text-bear'
              : 'bg-green-500/10 text-bull'
            : 'bg-gray-500/10 text-gray-400'
        }`}
      >
        {Math.abs(rate) > 0.05 ? (isPos ? 'Overheated' : 'Underheated') : 'Neutral'}
      </div>
    </div>
  )
}
