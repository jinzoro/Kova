'use client'

import { useEffect, useRef } from 'react'
import type { Kline } from '@/lib/binance'
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts'

interface Props {
  klines: Kline[]
  height?: number
}

let lcModule: typeof import('lightweight-charts') | null = null
if (typeof window !== 'undefined') {
  import('lightweight-charts').then(m => { lcModule = m })
}

function toTime(ms: number): Time {
  return Math.floor(ms / 1000) as unknown as Time
}

export default function BtcMiniChart({ klines, height = 220 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const areaSeriesRef = useRef<ISeriesApi<'Area'> | null>(null)
  const volSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const resizeHandlerRef = useRef<() => void>(() => {})
  const prevKlinesRef = useRef<Kline[]>([])

  useEffect(() => {
    if (!containerRef.current || klines.length === 0 || !lcModule) return

    const container = containerRef.current
    const prev = prevKlinesRef.current

    const isLiveUpdate =
      chartRef.current !== null &&
      areaSeriesRef.current !== null &&
      prev.length > 0 &&
      (klines[0].openTime === prev[0]?.openTime ||
       klines[0].openTime === prev[1]?.openTime)

    prevKlinesRef.current = klines

    if (isLiveUpdate) {
      const last = klines[klines.length - 1]
      const t = toTime(last.openTime)
      areaSeriesRef.current!.update({ time: t, value: last.close })
      volSeriesRef.current!.update({
        time: t,
        value: last.volume,
        color: last.close >= last.open ? '#22c55e25' : '#ef444425',
      })
      return  // No cleanup returned
    }

    // Full reinit
    window.removeEventListener('resize', resizeHandlerRef.current)
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
      areaSeriesRef.current = null
      volSeriesRef.current = null
    }

    const chart = lcModule.createChart(container, {
      width: container.clientWidth,
      height,
      layout: { background: { color: 'transparent' }, textColor: '#6b7280' },
      grid: { vertLines: { color: '#2a2d3a50' }, horzLines: { color: '#2a2d3a50' } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#2a2d3a', scaleMargins: { top: 0.05, bottom: 0.15 } },
      timeScale: { borderColor: '#2a2d3a', timeVisible: true, secondsVisible: false },
      handleScroll: false,
      handleScale: false,
    })
    chartRef.current = chart

    const area = chart.addAreaSeries({
      lineColor: '#3b82f6', topColor: '#3b82f620', bottomColor: '#3b82f600',
      lineWidth: 2, priceLineVisible: false, lastValueVisible: true,
    })
    area.setData(klines.map(k => ({ time: toTime(k.openTime), value: k.close })))
    areaSeriesRef.current = area

    const vol = chart.addHistogramSeries({
      color: '#3b82f630', priceFormat: { type: 'volume' }, priceScaleId: 'vol',
    })
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })
    vol.setData(klines.map(k => ({
      time: toTime(k.openTime),
      value: k.volume,
      color: k.close >= k.open ? '#22c55e25' : '#ef444425',
    })))
    volSeriesRef.current = vol

    chart.timeScale().fitContent()

    resizeHandlerRef.current = () => chart.applyOptions({ width: container.clientWidth })
    window.addEventListener('resize', resizeHandlerRef.current)
    // ← No cleanup returned
  }, [klines, height])

  useEffect(() => {
    return () => {
      window.removeEventListener('resize', resizeHandlerRef.current)
      chartRef.current?.remove()
      chartRef.current = null
      areaSeriesRef.current = null
      volSeriesRef.current = null
    }
  }, [])

  return <div ref={containerRef} className="w-full rounded-lg overflow-hidden" />
}
