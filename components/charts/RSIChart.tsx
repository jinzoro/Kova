'use client'

import { useEffect, useRef } from 'react'
import type { Kline } from '@/lib/binance'
import { calcRSI } from '@/lib/indicators'

interface Props {
  klines: Kline[]
}

let createChart: typeof import('lightweight-charts').createChart | null = null
if (typeof window !== 'undefined') {
  import('lightweight-charts').then((mod) => { createChart = mod.createChart })
}

export default function RSIChart({ klines }: Props) {
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
      rightPriceScale: { borderColor: '#2a2d3a', scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: '#2a2d3a', timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 },
    })

    const closes = klines.map((k) => k.close)
    const rsi = calcRSI(closes, 14)
    const times = klines.map((k) => Math.floor(k.openTime / 1000) as unknown as import('lightweight-charts').Time)

    const rsiSeries = chart.addLineSeries({
      color: '#a78bfa',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    })
    rsiSeries.setData(
      times.map((t, i) => ({ time: t, value: rsi[i] })).filter((d) => !isNaN(d.value)),
    )

    // Overbought/oversold lines
    const ob = chart.addLineSeries({ color: '#ef444460', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false })
    const os = chart.addLineSeries({ color: '#22c55e60', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false })
    const mid = chart.addLineSeries({ color: '#4b556340', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false })

    const firstValid = times.findIndex((_, i) => !isNaN(rsi[i]))
    if (firstValid >= 0) {
      ob.setData([{ time: times[firstValid], value: 70 }, { time: times[times.length - 1], value: 70 }])
      os.setData([{ time: times[firstValid], value: 30 }, { time: times[times.length - 1], value: 30 }])
      mid.setData([{ time: times[firstValid], value: 50 }, { time: times[times.length - 1], value: 50 }])
    }

    chart.timeScale().fitContent()

    const handleResize = () => chart.applyOptions({ width: container.clientWidth })
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [klines])

  const lastRSI = (() => {
    const closes = klines.map((k) => k.close)
    const rsi = calcRSI(closes, 14)
    const last = rsi[rsi.length - 1]
    return isNaN(last) ? null : last.toFixed(1)
  })()

  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 font-medium">RSI (14)</span>
        {lastRSI && (
          <span className={`text-xs font-mono font-bold ${
            parseFloat(lastRSI) > 70 ? 'text-bear' :
            parseFloat(lastRSI) < 30 ? 'text-bull' :
            'text-gray-300'
          }`}>
            {lastRSI}
          </span>
        )}
      </div>
      <div ref={containerRef} className="w-full rounded overflow-hidden" />
    </div>
  )
}
