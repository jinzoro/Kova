'use client'

import { useEffect, useRef } from 'react'
import type { Kline } from '@/lib/binance'
import { calcMACD } from '@/lib/indicators'
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts'

interface Props { klines: Kline[] }

let lcModule: typeof import('lightweight-charts') | null = null
if (typeof window !== 'undefined') {
  import('lightweight-charts').then(m => { lcModule = m })
}

function toTime(ms: number): Time {
  return Math.floor(ms / 1000) as unknown as Time
}

interface SeriesRefs {
  hist: ISeriesApi<'Histogram'>
  macdLine: ISeriesApi<'Line'>
  signalLine: ISeriesApi<'Line'>
}

export default function MACDChart({ klines }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<SeriesRefs | null>(null)
  const resizeHandlerRef = useRef<() => void>(() => {})
  const prevKlinesRef = useRef<Kline[]>([])

  useEffect(() => {
    if (!containerRef.current || klines.length === 0 || !lcModule) return

    const container = containerRef.current
    const prev = prevKlinesRef.current

    const isLiveUpdate =
      chartRef.current !== null &&
      seriesRef.current !== null &&
      prev.length > 0 &&
      (klines[0].openTime === prev[0]?.openTime ||
       klines[0].openTime === prev[1]?.openTime)

    prevKlinesRef.current = klines

    if (isLiveUpdate) {
      const closes = klines.map(k => k.close)
      const macd = calcMACD(closes)
      const last = macd[macd.length - 1]
      const t = toTime(klines[klines.length - 1].openTime)
      const s = seriesRef.current!

      if (!isNaN(last.histogram)) {
        s.hist.update({ time: t, value: last.histogram, color: last.histogram >= 0 ? '#22c55e80' : '#ef444480' })
        s.macdLine.update({ time: t, value: last.macd })
        s.signalLine.update({ time: t, value: last.signal })
      }
      return  // No cleanup returned
    }

    // Full reinit
    window.removeEventListener('resize', resizeHandlerRef.current)
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
      seriesRef.current = null
    }

    const chart = lcModule.createChart(container, {
      width: container.clientWidth,
      height: 120,
      layout: { background: { color: '#1a1d27' }, textColor: '#9ca3af' },
      grid: { vertLines: { color: '#2a2d3a' }, horzLines: { color: '#2a2d3a' } },
      rightPriceScale: { borderColor: '#2a2d3a' },
      timeScale: { borderColor: '#2a2d3a', timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 },
    })
    chartRef.current = chart

    const closes = klines.map(k => k.close)
    const macd = calcMACD(closes)
    const times = klines.map(k => toTime(k.openTime))

    const hist = chart.addHistogramSeries({ color: '#22c55e', priceLineVisible: false, lastValueVisible: false })
    hist.setData(
      times.map((t, i) => ({
        time: t, value: macd[i].histogram,
        color: macd[i].histogram >= 0 ? '#22c55e80' : '#ef444480',
      })).filter(d => !isNaN(d.value)),
    )

    const macdLine = chart.addLineSeries({ color: '#3b82f6', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
    macdLine.setData(times.map((t, i) => ({ time: t, value: macd[i].macd })).filter(d => !isNaN(d.value)))

    const signalLine = chart.addLineSeries({ color: '#f97316', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
    signalLine.setData(times.map((t, i) => ({ time: t, value: macd[i].signal })).filter(d => !isNaN(d.value)))

    seriesRef.current = { hist, macdLine, signalLine }
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
      seriesRef.current = null
    }
  }, [])

  return (
    <div className="card space-y-2">
      <div className="flex items-center gap-4">
        <span className="text-xs text-gray-500 font-medium">MACD (12, 26, 9)</span>
        <span className="flex items-center gap-1 text-xs text-blue-400">
          <span className="inline-block w-3 h-0.5 bg-blue-400" /> MACD
        </span>
        <span className="flex items-center gap-1 text-xs text-orange-400">
          <span className="inline-block w-3 h-0.5 bg-orange-400" /> Signal
        </span>
      </div>
      <div ref={containerRef} className="w-full rounded overflow-hidden" />
    </div>
  )
}
