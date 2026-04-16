'use client'

import type { SignalScore } from '@/lib/scoring'

interface Props {
  score: SignalScore
  title?: string
  compact?: boolean
}

function labelColor(label: SignalScore['label']): string {
  switch (label) {
    case 'Strong Buy': return 'text-bull'
    case 'Buy': return 'text-green-400'
    case 'Neutral': return 'text-warn'
    case 'Sell': return 'text-orange-400'
    case 'Strong Sell': return 'text-bear'
  }
}

function barFill(label: SignalScore['label']): string {
  switch (label) {
    case 'Strong Buy': return 'bg-bull'
    case 'Buy': return 'bg-green-400'
    case 'Neutral': return 'bg-warn'
    case 'Sell': return 'bg-orange-400'
    case 'Strong Sell': return 'bg-bear'
  }
}

function indicatorColor(v: number): string {
  if (v >= 2) return 'text-bull'
  if (v === 1) return 'text-green-400'
  if (v === 0) return 'text-gray-400'
  if (v === -1) return 'text-orange-400'
  return 'text-bear'
}

function indicatorBg(v: number): string {
  if (v >= 2) return 'bg-green-500/10'
  if (v === 1) return 'bg-green-500/5'
  if (v === 0) return 'bg-gray-500/5'
  if (v === -1) return 'bg-red-500/5'
  return 'bg-red-500/10'
}

function scoreToLabel(v: number): SignalScore['label'] {
  if (v >= 6) return 'Strong Buy'
  if (v >= 2) return 'Buy'
  if (v > -2) return 'Neutral'
  if (v > -6) return 'Sell'
  return 'Strong Sell'
}

function ScoreBar({ value }: { value: number }) {
  // Bar diverges from the center (score=0 = 50%).
  // Positive → extends right from center. Negative → extends left from center.
  const halfWidthPct = (Math.abs(value) / 10) * 50   // 0% … 50%
  const leftPct      = value >= 0 ? 50 : 50 - halfWidthPct
  const filled       = barFill(scoreToLabel(value))

  return (
    <div className="relative h-4 bg-surface-muted rounded-full overflow-hidden">
      {/* Zero marker */}
      <div className="absolute left-1/2 top-0 w-0.5 h-full bg-gray-500 z-10" />
      {/* Filled segment */}
      <div
        className={`absolute top-0 h-full transition-all duration-700 ${filled} opacity-90`}
        style={{
          left:  `${leftPct}%`,
          width: `${halfWidthPct}%`,
          borderRadius: value >= 0 ? '0 999px 999px 0' : '999px 0 0 999px',
        }}
      />
    </div>
  )
}

function buildNarrative(score: SignalScore): string {
  const { total, label, breakdown } = score
  if (breakdown.length === 0) return 'Insufficient data to generate analysis.'

  const bullish = breakdown.filter((b) => b.value > 0)
  const bearish = breakdown.filter((b) => b.value < 0)
  const neutral = breakdown.filter((b) => b.value === 0)

  const parts: string[] = []

  // Opening
  if (label === 'Strong Buy') {
    parts.push(`Technical conditions are strongly bullish with a composite score of +${total}/10.`)
  } else if (label === 'Buy') {
    parts.push(`Technical conditions lean bullish with a score of +${total}/10.`)
  } else if (label === 'Neutral') {
    parts.push(`Technical conditions are mixed, producing a near-neutral score of ${total}/10.`)
  } else if (label === 'Sell') {
    parts.push(`Technical conditions lean bearish with a score of ${total}/10.`)
  } else {
    parts.push(`Technical conditions are strongly bearish with a composite score of ${total}/10.`)
  }

  // Bullish factors
  if (bullish.length > 0) {
    const strongest = [...bullish].sort((a, b) => b.value - a.value)[0]
    parts.push(`The strongest bullish signal is ${strongest.indicator} (${strongest.reason}).`)
    if (bullish.length > 1) {
      const others = bullish.slice(1).map((b) => b.indicator).join(', ')
      parts.push(`Also supporting the bullish case: ${others}.`)
    }
  }

  // Bearish factors
  if (bearish.length > 0) {
    const strongest = [...bearish].sort((a, b) => a.value - b.value)[0]
    parts.push(`Key bearish concern: ${strongest.indicator} — ${strongest.reason}.`)
    if (bearish.length > 1) {
      const others = bearish.slice(1).map((b) => b.indicator).join(', ')
      parts.push(`Additional bearish factors: ${others}.`)
    }
  }

  if (neutral.length > 0) {
    parts.push(`${neutral.map((n) => n.indicator).join(' and ')} ${neutral.length === 1 ? 'is' : 'are'} neutral.`)
  }

  // Closing advice
  if (label === 'Strong Buy') {
    parts.push('High-confidence long setup — all major indicators aligned. Consider entries on any minor pullback.')
  } else if (label === 'Buy') {
    parts.push('Conditions favor longs with manageable risk. Watch for a clean entry on a retest of support.')
  } else if (label === 'Neutral') {
    parts.push('Wait for a clearer directional setup before committing. Both breakout and breakdown scenarios are plausible.')
  } else if (label === 'Sell') {
    parts.push('Conditions favor shorts or reducing long exposure. Rallies to key EMAs are potential short entries.')
  } else {
    parts.push('High-confidence bearish signal. Avoid longs until structure recovers above key moving averages.')
  }

  return parts.join(' ')
}

export default function SignalScoreCard({ score, title = 'Signal Score', compact = false }: Props) {
  const barWidth = ((score.total + 10) / 20) * 100
  const narrative = buildNarrative(score)

  if (compact) {
    return (
      <div className="card space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{title}</span>
          <span className={`text-sm font-bold font-mono ${labelColor(score.label)}`}>
            {score.total > 0 ? '+' : ''}{score.total} — {score.label}
          </span>
        </div>
        <div className="h-2 bg-surface-muted rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${barFill(score.label)}`} style={{ width: `${barWidth}%` }} />
        </div>
      </div>
    )
  }

  return (
    <div className="card space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">{title}</h3>
        <div className={`flex items-center gap-2 ${labelColor(score.label)}`}>
          <span className="text-xl font-bold font-mono">
            {score.total > 0 ? '+' : ''}{score.total}
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded border border-current/30 bg-current/10">
            {score.label}
          </span>
        </div>
      </div>

      {/* Score bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-600 font-mono mb-1.5">
          <span>Strong Sell −10</span>
          <span>Neutral</span>
          <span>+10 Strong Buy</span>
        </div>
        <ScoreBar value={score.total} />
      </div>

      {/* Narrative */}
      <div className="bg-surface-muted rounded-lg p-3">
        <p className="text-xs text-gray-300 leading-relaxed">{narrative}</p>
      </div>

      {/* Per-indicator breakdown */}
      {score.breakdown.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Indicator Breakdown</div>
          <div className="space-y-1.5">
            {score.breakdown.map((item) => (
              <div
                key={item.indicator}
                className={`flex items-start gap-3 rounded-lg px-3 py-2 ${indicatorBg(item.value)}`}
              >
                {/* Score pill */}
                <span className={`shrink-0 text-xs font-mono font-bold w-7 text-center rounded py-0.5 ${indicatorColor(item.value)} bg-current/10`}>
                  {item.value > 0 ? '+' : ''}{item.value}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-gray-200">{item.indicator}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{item.reason}</div>
                </div>
                {/* Visual bar */}
                <div className="ml-auto shrink-0 flex items-center gap-0.5">
                  {[-2, -1, 0, 1, 2].map((v) => (
                    <div
                      key={v}
                      className={`w-1.5 h-3 rounded-sm transition-all ${
                        (item.value >= 0 && v >= 0 && v <= item.value) ||
                        (item.value < 0 && v < 0 && v >= item.value)
                          ? item.value >= 2 ? 'bg-bull' :
                            item.value === 1 ? 'bg-green-400' :
                            item.value === -1 ? 'bg-orange-400' : 'bg-bear'
                          : 'bg-surface-border'
                      }`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
