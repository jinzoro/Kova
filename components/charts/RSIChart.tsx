'use client'

import { useEffect, useRef } from 'react'
import type { Kline } from '@/lib/binance'
import { calcRSI } from '@/lib/indicators'
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts'

interface Props { klines: Kline[] }

let lcModule: typeof import('lightweight-charts') | null = null
if (typeof window !== 'undefined') {
  import('lightweight-charts').then(m => { lcModule = m })
}

function toTime(ms: number): Time {
  return Math.floor(ms / 1000) as unknown as Time
}

export default function RSIChart({ klines }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const resizeHandlerRef = useRef<() => void>(() => {})
  const prevKlinesRef = useRef<Kline[]>([])

  useEffect(() => {
    if (!containerRef.current || klines.length === 0 || !lcModule) return

    const container = containerRef.current
    const prev = prevKlinesRef.current

    const isLiveUpdate =
      chartRef.current !== null &&
      rsiSeriesRef.current !== null &&
      prev.length > 0 &&
      (klines[0].openTime === prev[0]?.openTime ||
       klines[0].openTime === prev[1]?.openTime)

    prevKlinesRef.current = klines

    if (isLiveUpdate) {
      const closes = klines.map(k => k.close)
      const rsi = calcRSI(closes, 14)
      const last = rsi[rsi.length - 1]
      const t = toTime(klines[klines.length - 1].openTime)
      if (!isNaN(last)) rsiSeriesRef.current!.update({ time: t, value: last })
      return  // Chart stays alive — no cleanup returned
    }

    // Full reinit
    window.removeEventListener('resize', resizeHandlerRef.current)
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
      rsiSeriesRef.current = null
    }

    const chart = lcModule.createChart(container, {
      width: container.clientWidth,
      height: 120,
      layout: { background: { color: '#1a1d27' }, textColor: '#9ca3af' },
      grid: { vertLines: { color: '#2a2d3a' }, horzLines: { color: '#2a2d3a' } },
      rightPriceScale: { borderColor: '#2a2d3a', scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: '#2a2d3a', timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 },
    })
    chartRef.current = chart

    const closes = klines.map(k => k.close)
    const rsi = calcRSI(closes, 14)
    const times = klines.map(k => toTime(k.openTime))

    const rsiSeries = chart.addLineSeries({
      color: '#a78bfa', lineWidth: 2, priceLineVisible: false, lastValueVisible: true,
    })
    rsiSeries.setData(
      times.map((t, i) => ({ time: t, value: rsi[i] })).filter(d => !isNaN(d.value)),
    )
    rsiSeriesRef.current = rsiSeries

    // Reference lines
    const ob = chart.addLineSeries({ color: '#ef444460', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false })
    const os = chart.addLineSeries({ color: '#22c55e60', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false })
    const mid = chart.addLineSeries({ color: '#4b556340', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false })
    const firstValid = times.findIndex((_, i) => !isNaN(rsi[i]))
    if (firstValid >= 0) {
      const tFirst = times[firstValid]
      const tLast = times[times.length - 1]
      ob.setData([{ time: tFirst, value: 70 }, { time: tLast, value: 70 }])
      os.setData([{ time: tFirst, value: 30 }, { time: tLast, value: 30 }])
      mid.setData([{ time: tFirst, value: 50 }, { time: tLast, value: 50 }])
    }

    chart.timeScale().fitContent()

    resizeHandlerRef.current = () => chart.applyOptions({ width: container.clientWidth })
    window.addEventListener('resize', resizeHandlerRef.current)
    // ← No cleanup returned
  }, [klines])

  useEffect(() => {
    return () => {
      window.removeEventListener('resize', resizeHandlerRef.current)
      chartRef.current?.remove()
      chartRef.current = null
      rsiSeriesRef.current = null
    }
  }, [])

  const lastRSI = (() => {
    if (klines.length === 0) return null
    const rsi = calcRSI(klines.map(k => k.close), 14)
    const v = rsi[rsi.length - 1]
    return isNaN(v) ? null : v.toFixed(1)
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
