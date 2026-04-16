'use client'

import Link from 'next/link'
import CoinLogo from '@/components/ui/CoinLogo'
import type { CoinMarket } from '@/lib/coingecko'

function Sparkline({ prices }: { prices: number[] }) {
  if (!prices || prices.length < 2) return null
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const w = 80
  const h = 32
  const points = prices
    .map((p, i) => {
      const x = (i / (prices.length - 1)) * w
      const y = h - ((p - min) / range) * h
      return `${x},${y}`
    })
    .join(' ')
  const isUp = prices[prices.length - 1] >= prices[0]

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-20 h-8">
      <polyline
        points={points}
        fill="none"
        stroke={isUp ? '#22c55e' : '#ef4444'}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

function fmt(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  return `$${n.toLocaleString()}`
}

function fmtPrice(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  if (n >= 1) return `$${n.toFixed(4)}`
  return `$${n.toFixed(6)}`
}

interface Props {
  coin: CoinMarket
}

export default function CoinCard({ coin }: Props) {
  const pct = coin.price_change_percentage_24h ?? 0
  const isUp = pct >= 0

  return (
    <Link href={`/coin/${coin.symbol.toLowerCase()}`}>
      <div className="card hover:border-blue-500/50 transition-all duration-200 hover:scale-[1.01] cursor-pointer group">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <CoinLogo src={coin.image} alt={coin.symbol} size={28} />
            <div>
              <div className="font-semibold text-sm text-gray-100 group-hover:text-blue-300 transition-colors">
                {coin.name}
              </div>
              <div className="text-xs text-gray-500 font-mono uppercase">{coin.symbol}</div>
            </div>
          </div>
          {coin.market_cap_rank && (
            <span className="text-xs text-gray-600 font-mono">#{coin.market_cap_rank}</span>
          )}
        </div>

        <div className="flex items-end justify-between">
          <div>
            <div className="font-mono font-semibold text-base text-gray-100">
              {fmtPrice(coin.current_price)}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              MCap: {fmt(coin.market_cap)}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={isUp ? 'badge-bull' : 'badge-bear'}>
              {isUp ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
            </span>
            {coin.sparkline_in_7d?.price && (
              <Sparkline prices={coin.sparkline_in_7d.price} />
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
