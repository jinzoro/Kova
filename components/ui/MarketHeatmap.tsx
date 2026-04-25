'use client'

import Link from 'next/link'
import { useState, useCallback, useEffect } from 'react'
import { useTopMovers } from '@/hooks/useTopMovers'
import type { HeatmapCoin } from '@/hooks/useTopMovers'

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtVol(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`
  return `$${n.toLocaleString()}`
}

function fmtPrice(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  if (n >= 1) return `$${n.toFixed(4)}`
  return `$${n.toFixed(6)}`
}

// ─── Color mapping ────────────────────────────────────────────────────────────

function pctToStyle(pct: number): { bg: string; text: string; border: string } {
  const abs = Math.abs(pct)
  if (pct >= 0) {
    if (abs >= 10) return { bg: 'rgba(21,128,61,0.90)',  text: '#fff',    border: 'rgba(22,163,74,0.7)'  }
    if (abs >= 6)  return { bg: 'rgba(22,163,74,0.70)',  text: '#dcfce7', border: 'rgba(22,163,74,0.5)'  }
    if (abs >= 3)  return { bg: 'rgba(34,197,94,0.45)',  text: '#86efac', border: 'rgba(34,197,94,0.35)' }
    if (abs >= 1)  return { bg: 'rgba(34,197,94,0.22)',  text: '#4ade80', border: 'rgba(34,197,94,0.25)' }
    return             { bg: 'rgba(34,197,94,0.09)',  text: '#86efac', border: 'rgba(34,197,94,0.15)' }
  } else {
    if (abs >= 10) return { bg: 'rgba(153,27,27,0.90)',  text: '#fff',    border: 'rgba(185,28,28,0.7)'  }
    if (abs >= 6)  return { bg: 'rgba(220,38,38,0.70)',  text: '#fecaca', border: 'rgba(220,38,38,0.5)'  }
    if (abs >= 3)  return { bg: 'rgba(239,68,68,0.45)',  text: '#fca5a5', border: 'rgba(239,68,68,0.35)' }
    if (abs >= 1)  return { bg: 'rgba(239,68,68,0.22)',  text: '#f87171', border: 'rgba(239,68,68,0.25)' }
    return             { bg: 'rgba(239,68,68,0.09)',  text: '#fca5a5', border: 'rgba(239,68,68,0.15)' }
  }
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipState { coin: HeatmapCoin; clientX: number; clientY: number }

function Tooltip({ state }: { state: TooltipState }) {
  const { coin, clientX, clientY } = state
  const style = pctToStyle(coin.change24h)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div className="fixed z-[9999] pointer-events-none"
      style={{ left: clientX + 14, top: clientY - 10, transform: 'translateY(-100%)' }}>
      <div
        className="bg-gray-950/95 backdrop-blur-sm border border-gray-700/60 rounded-xl shadow-2xl px-4 py-3 min-w-[190px] space-y-2"
        style={{
          transition: 'opacity 0.14s ease, transform 0.14s cubic-bezier(0.34,1.56,0.64,1)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1)' : 'scale(0.88)',
          transformOrigin: 'bottom left',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="font-bold text-sm text-gray-100 font-mono">{coin.symbol}</span>
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded"
            style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}>
            {coin.change24h >= 0 ? '+' : ''}{coin.change24h.toFixed(2)}%
          </span>
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-500">Price</span>
            <span className="font-mono text-gray-200">{fmtPrice(coin.price)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">24h Volume</span>
            <span className="font-mono text-gray-400">{fmtVol(coin.volume)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Cap Tier</span>
            <span className="font-mono text-gray-500">
              {coin.tier === 1 ? 'Large' : coin.tier === 2 ? 'Mid' : 'Small'}
            </span>
          </div>
        </div>
        <div className="text-xs text-gray-600 pt-0.5 border-t border-gray-800">
          Click to view full analysis →
        </div>
      </div>
    </div>
  )
}

// ─── Individual tile ──────────────────────────────────────────────────────────
// NOTE: tiles have NO CSS `animation` property — that would create a stacking
// context per tile and make z-index between siblings non-deterministic.
// Entrance animation lives on the grid wrapper only.

interface TileProps {
  coin: HeatmapCoin
  height: number
  flexGrow: number
  onHover: (coin: HeatmapCoin, e: React.MouseEvent) => void
  onLeave: () => void
}

function HeatTile({ coin, height, flexGrow, onHover, onLeave }: TileProps) {
  const cs = pctToStyle(coin.change24h)
  const [hovered, setHovered] = useState(false)
  const showChange = height >= 44
  const showVolume = height >= 72
  const tinyLabel  = flexGrow < 0.06
  const isBull = coin.change24h >= 0

  const glowShadow = isBull
    ? '0 0 0 1px rgba(34,197,94,0.5), 0 0 24px 6px rgba(34,197,94,0.40), 0 8px 20px rgba(0,0,0,0.6)'
    : '0 0 0 1px rgba(239,68,68,0.5),  0 0 24px 6px rgba(239,68,68,0.40),  0 8px 20px rgba(0,0,0,0.6)'

  return (
    <Link
      href={`/coin/${coin.symbol.toLowerCase()}`}
      // position:relative + explicit z-index is what makes sibling stacking work.
      // No animation class here — only a CSS transition.
      style={{
        position: 'relative',
        flexGrow,
        flexShrink: 0,
        flexBasis: 0,
        minWidth: 36,
        height,
        backgroundColor: cs.bg,
        border: `1px solid ${cs.border}`,
        color: cs.text,
        borderRadius: 6,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        // z-index bump when hovered so the scaled tile clips ABOVE its neighbors
        zIndex: hovered ? 50 : 'auto',
        transform: hovered ? 'scale(1.13)' : 'scale(1)',
        boxShadow: hovered ? glowShadow : 'none',
        transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease',
      }}
      onMouseEnter={(e) => { setHovered(true); onHover(coin, e) }}
      onMouseLeave={() => { setHovered(false); onLeave() }}
    >
      <span className="font-mono font-bold leading-none text-center px-1 truncate w-full pointer-events-none"
        style={{ fontSize: tinyLabel ? 9 : 11 }}>
        {coin.symbol}
      </span>
      {showChange && (
        <span className="font-mono leading-none mt-0.5 opacity-90 pointer-events-none" style={{ fontSize: 10 }}>
          {coin.change24h >= 0 ? '+' : ''}{coin.change24h.toFixed(1)}%
        </span>
      )}
      {showVolume && (
        <span className="font-mono leading-none mt-0.5 opacity-55 pointer-events-none" style={{ fontSize: 9 }}>
          {fmtVol(coin.volume)}
        </span>
      )}
    </Link>
  )
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function HeatRow({ coins, height, onHover, onLeave }: {
  coins: HeatmapCoin[]; height: number
  onHover: (c: HeatmapCoin, e: React.MouseEvent) => void; onLeave: () => void
}) {
  if (coins.length === 0) return null
  const totalVol = coins.reduce((s, c) => s + c.volume, 0)
  return (
    // overflow:visible is critical so scaled tiles are not clipped by the row's height box
    <div style={{ display: 'flex', gap: 2, height, overflow: 'visible', position: 'relative' }}>
      {coins.map(coin => (
        <HeatTile key={coin.symbol} coin={coin} height={height}
          flexGrow={coin.volume / totalVol} onHover={onHover} onLeave={onLeave} />
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MarketHeatmap() {
  const { data, isLoading } = useTopMovers()
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const handleHover = useCallback((coin: HeatmapCoin, e: React.MouseEvent) => {
    setTooltip({ coin, clientX: e.clientX, clientY: e.clientY })
  }, [])
  const handleLeave = useCallback(() => setTooltip(null), [])

  const coins = [...(data?.heatmap ?? [])].sort((a, b) => b.volume - a.volume)
  const row1 = coins.slice(0, 7)
  const row2 = coins.slice(7, 20)
  const row3 = coins.slice(20)

  return (
    // overflow:visible overrides any residual clipping from .card's rounded-xl
    <div className="card" style={{ overflow: 'visible' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          <h3 className="text-sm font-semibold text-gray-300">Market Heatmap</h3>
          <span className="text-xs text-gray-600">tile size = 24h volume</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: 'rgba(22,163,74,0.70)' }} />
            Strong gain
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: 'rgba(220,38,38,0.70)' }} />
            Strong loss
          </span>
          <span>hover for details</span>
        </div>
      </div>

      {/* Grid — single fade-in on the container; individual tiles have NO animation */}
      {isLoading ? (
        <div className="space-y-0.5">
          <div className="skeleton h-20 rounded-md" />
          <div className="skeleton h-14 rounded-md" />
          <div className="skeleton h-10 rounded-md" />
        </div>
      ) : coins.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">No data</div>
      ) : (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'visible' }}>
          <HeatRow coins={row1} height={80} onHover={handleHover} onLeave={handleLeave} />
          <HeatRow coins={row2} height={54} onHover={handleHover} onLeave={handleLeave} />
          {row3.length > 0 && <HeatRow coins={row3} height={36} onHover={handleHover} onLeave={handleLeave} />}
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-gray-600 w-10 text-right shrink-0">−10%+</span>
        <div className="flex-1 h-1.5 rounded-full overflow-hidden flex">
          {['rgba(153,27,27,0.90)','rgba(220,38,38,0.70)','rgba(239,68,68,0.45)','rgba(239,68,68,0.22)',
            '#374151','rgba(34,197,94,0.22)','rgba(34,197,94,0.45)','rgba(22,163,74,0.70)','rgba(21,128,61,0.90)',
          ].map((color, i) => <div key={i} className="flex-1" style={{ background: color }} />)}
        </div>
        <span className="text-xs text-gray-600 w-10 shrink-0">+10%+</span>
      </div>

      {tooltip && <Tooltip state={tooltip} />}
    </div>
  )
}
