'use client'

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

interface DominancePoint {
  timestamp: number
  btcDominance: number
  ethDominance: number
  totalMcap: number
}

interface AltseasonData {
  index: number
  label: 'Altcoin Season' | 'Bitcoin Season' | 'Neutral'
  outperforming: number
}

interface DominanceData {
  points: DominancePoint[]
  altseason: AltseasonData
}

function fmt(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`
  return `$${n.toLocaleString()}`
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// SVG area chart — renders BTC and ETH dominance lines over 90 days
function AreaChart({ points }: { points: DominancePoint[] }) {
  const W = 800
  const H = 140
  const PAD = { top: 10, right: 12, bottom: 28, left: 36 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const minY = 40  // dominance rarely goes below 40% for BTC
  const maxY = 70

  const scaleX = (i: number) => PAD.left + (i / (points.length - 1)) * chartW
  const scaleY = (v: number) => PAD.top + chartH - ((Math.min(Math.max(v, minY), maxY) - minY) / (maxY - minY)) * chartH

  const btcPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i).toFixed(1)} ${scaleY(p.btcDominance).toFixed(1)}`).join(' ')
  const ethPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i).toFixed(1)} ${scaleY(p.ethDominance).toFixed(1)}`).join(' ')

  // Fill area under BTC line
  const btcFill = [
    `M ${scaleX(0).toFixed(1)} ${(PAD.top + chartH).toFixed(1)}`,
    ...points.map((p, i) => `L ${scaleX(i).toFixed(1)} ${scaleY(p.btcDominance).toFixed(1)}`),
    `L ${scaleX(points.length - 1).toFixed(1)} ${(PAD.top + chartH).toFixed(1)} Z`,
  ].join(' ')

  // Y-axis ticks
  const yTicks = [45, 50, 55, 60, 65]
  // X-axis labels — show ~6 evenly spaced
  const xStep = Math.floor(points.length / 5)
  const xLabels = points
    .map((p, i) => ({ i, ts: p.timestamp }))
    .filter((_, i) => i % xStep === 0 || i === points.length - 1)

  const latest = points[points.length - 1]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 140 }}>
      <defs>
        <linearGradient id="btcGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yTicks.map((v) => (
        <g key={v}>
          <line
            x1={PAD.left} y1={scaleY(v)} x2={PAD.left + chartW} y2={scaleY(v)}
            stroke="rgba(255,255,255,0.05)" strokeWidth="1"
          />
          <text x={PAD.left - 4} y={scaleY(v) + 4} textAnchor="end" fontSize="9" fill="#4b5563">{v}%</text>
        </g>
      ))}

      {/* BTC fill */}
      <path d={btcFill} fill="url(#btcGrad)" />

      {/* ETH line */}
      <path d={ethPath} fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeOpacity="0.7" />

      {/* BTC line */}
      <path d={btcPath} fill="none" stroke="#f97316" strokeWidth="2" />

      {/* Latest value dots */}
      {latest && (
        <>
          <circle cx={scaleX(points.length - 1)} cy={scaleY(latest.btcDominance)} r="3" fill="#f97316" />
          <circle cx={scaleX(points.length - 1)} cy={scaleY(latest.ethDominance)} r="3" fill="#60a5fa" />
        </>
      )}

      {/* X labels */}
      {xLabels.map(({ i, ts }) => (
        <text key={i} x={scaleX(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#4b5563">
          {fmtDate(ts)}
        </text>
      ))}
    </svg>
  )
}

// Altcoin Season gauge — horizontal bar 0→100
function AltseasonGauge({ data }: { data: AltseasonData }) {
  const color =
    data.label === 'Altcoin Season' ? '#22c55e'
    : data.label === 'Bitcoin Season' ? '#f97316'
    : '#f59e0b'

  const bgColor =
    data.label === 'Altcoin Season' ? 'rgba(34,197,94,0.1)'
    : data.label === 'Bitcoin Season' ? 'rgba(249,115,22,0.1)'
    : 'rgba(245,158,11,0.1)'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono font-bold" style={{ color }}>{data.label}</span>
        <span className="text-xs font-mono text-gray-400">{data.index}/100</span>
      </div>
      <div className="h-2 bg-surface-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${data.index}%`, background: color, opacity: 0.85 }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-600">
        <span>BTC Season</span>
        <span className="text-xs" style={{ color, background: bgColor }} >
          {data.outperforming} / {49} altcoins beating BTC (90d)
        </span>
        <span>Alt Season</span>
      </div>
    </div>
  )
}

export default function DominanceChart() {
  const { data, isLoading, isError } = useQuery<DominanceData>({
    queryKey: ['dominance'],
    queryFn: () => fetch('/api/dominance').then((r) => r.json()),
    staleTime: 60 * 60_000,
    refetchInterval: 60 * 60_000,
  })

  const latest = useMemo(() => {
    if (!data?.points.length) return null
    return data.points[data.points.length - 1]
  }, [data])

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
          <h3 className="text-sm font-semibold text-gray-300">BTC Dominance</h3>
          <span className="text-xs text-gray-600">90-day history</span>
        </div>
        {latest && (
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 bg-orange-400 rounded" />
              <span className="text-gray-400">BTC <span className="font-mono font-bold text-orange-400">{latest.btcDominance.toFixed(1)}%</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 bg-blue-400 rounded" />
              <span className="text-gray-400">ETH <span className="font-mono font-bold text-blue-400">{latest.ethDominance.toFixed(1)}%</span></span>
            </div>
            <div className="text-gray-600">
              Total cap: <span className="font-mono text-gray-400">{fmt(latest.totalMcap)}</span>
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="skeleton h-36 rounded-lg" />
          <div className="skeleton h-12 rounded-lg" />
        </div>
      ) : isError || !data ? (
        <p className="text-center py-8 text-xs text-gray-500">Dominance data unavailable</p>
      ) : (
        <>
          <AreaChart points={data.points} />
          <div className="mt-4 pt-3 border-t border-surface-border">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-gray-400">Altcoin Season Index</span>
              <span className="text-xs text-gray-600">— if 75%+ of top 50 beat BTC over 90d</span>
            </div>
            <AltseasonGauge data={data.altseason} />
          </div>
        </>
      )}
    </div>
  )
}
