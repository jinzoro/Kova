'use client'

import type { Kline } from '@/lib/binance'
import { calcCVD } from '@/lib/indicators'

interface Props {
  klines: Kline[]
}

export default function CVDChart({ klines }: Props) {
  if (klines.length < 2) return null

  const cvdData = calcCVD(klines)
  const deltas = cvdData.map((d) => d.delta)
  const cvdLine = cvdData.map((d) => d.cvd)

  // Show last 60 candles for clarity
  const display = 60
  const start = Math.max(0, cvdData.length - display)
  const sliceDeltas = deltas.slice(start)
  const sliceCVD = cvdLine.slice(start)

  const maxDelta = Math.max(...sliceDeltas.map(Math.abs)) || 1
  const minCVD = Math.min(...sliceCVD)
  const maxCVD = Math.max(...sliceCVD)
  const cvdRange = maxCVD - minCVD || 1

  const W = 600
  const H = 120
  const BAR_H = 60
  const LINE_Y_OFFSET = 65
  const LINE_H = 50

  const barWidth = W / sliceDeltas.length

  // CVD line path
  const linePts = sliceCVD.map((v, i) => {
    const x = (i / (sliceCVD.length - 1)) * W
    const y = LINE_Y_OFFSET + LINE_H - ((v - minCVD) / cvdRange) * LINE_H
    return `${x},${y}`
  })

  const isRising = sliceCVD[sliceCVD.length - 1] > sliceCVD[0]
  const lastCVD = cvdLine[cvdLine.length - 1]

  function fmtCompact(n: number): string {
    if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)}B`
    if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`
    if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`
    return n.toFixed(0)
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">CVD — Cumulative Volume Delta</h3>
        <div className="text-right">
          <div className={`text-xs font-mono font-bold ${isRising ? 'text-bull' : 'text-bear'}`}>
            {isRising ? '▲ Buying pressure' : '▼ Selling pressure'}
          </div>
          <div className="text-xs text-gray-500 font-mono">CVD: {fmtCompact(lastCVD)}</div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 120 }}
        preserveAspectRatio="none"
      >
        {/* Zero line for deltas */}
        <line x1="0" y1={BAR_H / 2} x2={W} y2={BAR_H / 2} stroke="#374151" strokeWidth="0.5" />

        {/* Delta bars */}
        {sliceDeltas.map((d, i) => {
          const pct = Math.abs(d) / maxDelta
          const barH = pct * (BAR_H / 2 - 1)
          const isPos = d >= 0
          const x = i * barWidth
          const y = isPos ? BAR_H / 2 - barH : BAR_H / 2
          return (
            <rect
              key={i}
              x={x + 0.5}
              y={y}
              width={Math.max(barWidth - 1, 0.5)}
              height={barH}
              fill={isPos ? '#22c55e' : '#ef4444'}
              opacity={0.7}
            />
          )
        })}

        {/* CVD line */}
        <polyline
          points={linePts.join(' ')}
          fill="none"
          stroke={isRising ? '#22c55e' : '#ef4444'}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>

      <p className="text-xs text-gray-500 leading-relaxed">
        Volume Delta = buying volume − selling volume per candle. CVD (line) accumulates these over time.
        Rising CVD = buyers absorbing supply; falling CVD = sellers dominating.
        {isRising
          ? ' Currently showing net buying pressure — OBV confirmation adds confidence.'
          : ' Currently showing net selling pressure — cautious on long entries.'}
      </p>
    </div>
  )
}
