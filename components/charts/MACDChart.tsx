'use client'

import { useEffect, useRef } from 'react'
import type { Kline } from '@/lib/binance'
import { calcMACD } from '@/lib/indicators'

interface Props {
  klines: Kline[]
}

let createChart: typeof import('lightweight-charts').createChart | null = null
if (typeof window !== 'undefined') {
  import('lightweight-charts').then((mod) => { createChart = mod.createChart })
}

export default function MACDChart({ klines }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || klines.length === 0 || !createChart) return
    const container = containerRef.current

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 120,
      layout: {
        background: { color: '#1a1d27' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#2a2d3a' },
        horzLines: { color: '#2a2d3a' },
      },
      rightPriceScale: { borderColor: '#2a2d3a' },
      timeScale: { borderColor: '#2a2d3a', timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 },
    })

    const closes = klines.map((k) => k.close)
    const macd = calcMACD(closes)
    const times = klines.map((k) => Math.floor(k.openTime / 1000) as unknown as import('lightweight-charts').Time)

    // Histogram
    const histSeries = chart.addHistogramSeries({
      color: '#22c55e',
      priceLineVisible: false,
      lastValueVisible: false,
    })
    histSeries.setData(
      times
        .map((t, i) => ({
          time: t,
          value: macd[i].histogram,
          color: macd[i].histogram >= 0 ? '#22c55e80' : '#ef444480',
        }))
        .filter((d) => !isNaN(d.value)),
    )

    // MACD line
    const macdLine = chart.addLineSeries({ color: '#3b82f6', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
    macdLine.setData(
      times.map((t, i) => ({ time: t, value: macd[i].macd })).filter((d) => !isNaN(d.value)),
    )

    // Signal line
    const signalLine = chart.addLineSeries({ color: '#f97316', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
    signalLine.setData(
      times.map((t, i) => ({ time: t, value: macd[i].signal })).filter((d) => !isNaN(d.value)),
    )

    chart.timeScale().fitContent()

    const handleResize = () => chart.applyOptions({ width: container.clientWidth })
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [klines])

  return (
    <div className="card space-y-2">
      <div className="flex items-center gap-4">
        <span className="text-xs text-gray-500 font-medium">MACD (12, 26, 9)</span>
        <span className="flex items-center gap-1 text-xs text-blue-400"><span className="inline-block w-3 h-0.5 bg-blue-400" /> MACD</span>
        <span className="flex items-center gap-1 text-xs text-orange-400"><span className="inline-block w-3 h-0.5 bg-orange-400" /> Signal</span>
      </div>
      <div ref={containerRef} className="w-full rounded overflow-hidden" />
    </div>
  )
}
