'use client'

interface Props {
  value: number
  classification: string
}

function getColor(value: number): string {
  if (value <= 25) return '#ef4444'
  if (value <= 45) return '#f97316'
  if (value <= 55) return '#f59e0b'
  if (value <= 75) return '#84cc16'
  return '#22c55e'
}

export default function FearGreedGauge({ value, classification }: Props) {
  const angle = -90 + (value / 100) * 180  // -90° to +90°
  const color = getColor(value)
  const r = 40
  const cx = 60
  const cy = 60
  const startAngle = Math.PI
  const endAngle = 2 * Math.PI
  const arcX1 = cx + r * Math.cos(startAngle)
  const arcY1 = cy + r * Math.sin(startAngle)
  const arcX2 = cx + r * Math.cos(endAngle)
  const arcY2 = cy + r * Math.sin(endAngle)

  // Filled arc
  const fillAngle = Math.PI + (value / 100) * Math.PI
  const fillX = cx + r * Math.cos(fillAngle)
  const fillY = cy + r * Math.sin(fillAngle)

  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 120 70" className="w-28 h-16">
        {/* Background arc */}
        <path
          d={`M ${arcX1} ${arcY1} A ${r} ${r} 0 0 1 ${arcX2} ${arcY2}`}
          fill="none"
          stroke="#2a2d3a"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={`M ${arcX1} ${arcY1} A ${r} ${r} 0 0 1 ${fillX} ${fillY}`}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={cx + (r - 10) * Math.cos((angle * Math.PI) / 180)}
          y2={cy + (r - 10) * Math.sin((angle * Math.PI) / 180)}
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="3" fill="white" />
        {/* Value text */}
        <text x={cx} y={cy + 20} textAnchor="middle" fill={color} fontSize="14" fontWeight="700" fontFamily="monospace">
          {value}
        </text>
      </svg>
      <span className="text-xs text-gray-400 font-medium">{classification}</span>
      <span className="text-xs text-gray-600">Fear & Greed</span>
    </div>
  )
}
