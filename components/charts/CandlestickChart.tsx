'use client'

import { useEffect, useRef, useState } from 'react'
import type { Kline, KlineInterval } from '@/lib/binance'
import {
  calcEMA,
  calcBollingerBands,
} from '@/lib/indicators'

interface Props {
  klines: Kline[]
  interval: KlineInterval
  onIntervalChange: (i: KlineInterval) => void
}

const INTERVALS: KlineInterval[] = ['1m', '5m', '15m', '1h', '4h', '1d', '1w']

// We dynamically import lightweight-charts to avoid SSR issues
let createChart: typeof import('lightweight-charts').createChart | null = null
if (typeof window !== 'undefined') {
  import('lightweight-charts').then((mod) => { createChart = mod.createChart })
}

type OverlayKey = 'ema12' | 'ema26' | 'ema200' | 'bb'

export default function CandlestickChart({ klines, interval, onIntervalChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ReturnType<typeof import('lightweight-charts').createChart> | null>(null)
  const [overlays, setOverlays] = useState<Record<OverlayKey, boolean>>({
    ema12: true,
    ema26: true,
    ema200: false,
    bb: false,
  })

  useEffect(() => {
    if (!containerRef.current || klines.length === 0) return
    if (!createChart) return

    const container = containerRef.current
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 380,
      layout: {
        background: { color: '#1a1d27' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#2a2d3a' },
        horzLines: { color: '#2a2d3a' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#2a2d3a' },
      timeScale: {
        borderColor: '#2a2d3a',
        timeVisible: true,
        secondsVisible: false,
      },
    })
    chartRef.current = chart

    // Candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    const candleData = klines.map((k) => ({
      time: Math.floor(k.openTime / 1000) as unknown as import('lightweight-charts').Time,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
    }))
    candleSeries.setData(candleData)

    // Volume series
    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    })
    volumeSeries.setData(
      klines.map((k) => ({
        time: Math.floor(k.openTime / 1000) as unknown as import('lightweight-charts').Time,
        value: k.volume,
        color: k.close >= k.open ? '#22c55e40' : '#ef444440',
      })),
    )

    const closes = klines.map((k) => k.close)
    const times = klines.map((k) => Math.floor(k.openTime / 1000) as unknown as import('lightweight-charts').Time)

    // EMA 12
    if (overlays.ema12) {
      const ema12 = calcEMA(closes, 12)
      const ema12Series = chart.addLineSeries({ color: '#f97316', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
      ema12Series.setData(
        times.map((t, i) => ({ time: t, value: ema12[i] })).filter((d) => !isNaN(d.value)),
      )
    }

    // EMA 26
    if (overlays.ema26) {
      const ema26 = calcEMA(closes, 26)
      const ema26Series = chart.addLineSeries({ color: '#3b82f6', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
      ema26Series.setData(
        times.map((t, i) => ({ time: t, value: ema26[i] })).filter((d) => !isNaN(d.value)),
      )
    }

    // EMA 200
    if (overlays.ema200) {
      const ema200 = calcEMA(closes, 200)
      const ema200Series = chart.addLineSeries({ color: '#ec4899', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
      ema200Series.setData(
        times.map((t, i) => ({ time: t, value: ema200[i] })).filter((d) => !isNaN(d.value)),
      )
    }

    // Bollinger Bands
    if (overlays.bb) {
      const bb = calcBollingerBands(closes, 20, 2)
      const bbUpper = chart.addLineSeries({ color: '#6b7280', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
      const bbLower = chart.addLineSeries({ color: '#6b7280', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
      const bbMid = chart.addLineSeries({ color: '#4b5563', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false })
      bbUpper.setData(times.map((t, i) => ({ time: t, value: bb[i].upper })).filter((d) => !isNaN(d.value)))
      bbLower.setData(times.map((t, i) => ({ time: t, value: bb[i].lower })).filter((d) => !isNaN(d.value)))
      bbMid.setData(times.map((t, i) => ({ time: t, value: bb[i].middle })).filter((d) => !isNaN(d.value)))
    }

    chart.timeScale().fitContent()

    const handleResize = () => {
      chart.applyOptions({ width: container.clientWidth })
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = null
    }
  }, [klines, overlays])

  const toggleOverlay = (key: OverlayKey) => {
    setOverlays((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="card space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Interval */}
        <div className="flex items-center gap-1">
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              onClick={() => onIntervalChange(iv)}
              className={`px-2 py-1 rounded text-xs font-mono font-medium transition-colors ${
                iv === interval
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-surface-muted'
              }`}
            >
              {iv}
            </button>
          ))}
        </div>

        {/* Overlays */}
        <div className="flex items-center gap-2 flex-wrap">
          {(
            [
              { key: 'ema12', label: 'EMA 12', color: 'text-orange-400' },
              { key: 'ema26', label: 'EMA 26', color: 'text-blue-400' },
              { key: 'ema200', label: 'EMA 200', color: 'text-pink-400' },
              { key: 'bb', label: 'BB', color: 'text-gray-400' },
            ] as { key: OverlayKey; label: string; color: string }[]
          ).map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => toggleOverlay(key)}
              className={`px-2 py-0.5 rounded border text-xs font-mono transition-colors ${
                overlays[key]
                  ? `border-current/50 bg-current/10 ${color}`
                  : 'border-surface-border text-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart container */}
      <div ref={containerRef} className="w-full rounded-lg overflow-hidden" />
    </div>
  )
}
