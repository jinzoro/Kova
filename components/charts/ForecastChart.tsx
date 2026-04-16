'use client'

import { useEffect, useRef } from 'react'
import type { ForecastResult } from '@/lib/forecast'
import type { Kline } from '@/lib/binance'
import { calcBollingerBands } from '@/lib/indicators'

interface Props {
  klines: Kline[]
  forecast: ForecastResult
}

let createChart: typeof import('lightweight-charts').createChart | null = null
if (typeof window !== 'undefined') {
  import('lightweight-charts').then((mod) => { createChart = mod.createChart })
}

export default function ForecastChart({ klines, forecast }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || klines.length === 0 || !createChart) return
    const container = containerRef.current

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 200,
      layout: {
        background: { color: '#1a1d27' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#2a2d3a' },
        horzLines: { color: '#2a2d3a' },
      },
      rightPriceScale: { borderColor: '#2a2d3a' },
      timeScale: { borderColor: '#2a2d3a', timeVisible: true },
      crosshair: { mode: 1 },
    })

    const closes = klines.map((k) => k.close)
    const times = klines.map((k) => Math.floor(k.openTime / 1000) as unknown as import('lightweight-charts').Time)

    // Historical close line
    const histSeries = chart.addLineSeries({
      color: '#9ca3af',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    histSeries.setData(times.map((t, i) => ({ time: t, value: closes[i] })))

    // Bollinger Bands
    const bb = calcBollingerBands(closes, 20, 2)
    const bbUpper = chart.addLineSeries({ color: '#6b728040', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
    const bbLower = chart.addLineSeries({ color: '#6b728040', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
    bbUpper.setData(times.map((t, i) => ({ time: t, value: bb[i].upper })).filter((d) => !isNaN(d.value)))
    bbLower.setData(times.map((t, i) => ({ time: t, value: bb[i].lower })).filter((d) => !isNaN(d.value)))

    // Projected line (dashed)
    if (forecast.projections.length > 0 && klines.length > 0) {
      const lastKline = klines[klines.length - 1]
      const interval = klines.length > 1 ? klines[1].openTime - klines[0].openTime : 3600000

      const projSeries = chart.addLineSeries({
        color: '#60a5fa',
        lineWidth: 2,
        lineStyle: 2, // dashed
        priceLineVisible: false,
        lastValueVisible: true,
      })

      const projData = [
        { time: Math.floor(lastKline.openTime / 1000) as unknown as import('lightweight-charts').Time, value: lastKline.close },
        ...forecast.projections.map((p, i) => ({
          time: Math.floor((lastKline.openTime + interval * (i + 1)) / 1000) as unknown as import('lightweight-charts').Time,
          value: p.price,
        })),
      ]
      projSeries.setData(projData)

      // CI bands for forecast
      if (forecast.upper.length > 0) {
        const upperSeries = chart.addLineSeries({ color: '#60a5fa30', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false })
        const lowerSeries = chart.addLineSeries({ color: '#60a5fa30', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false })
        const bandData = forecast.upper.map((u, i) => ({
          upper: { time: Math.floor((lastKline.openTime + interval * (i + 1)) / 1000) as unknown as import('lightweight-charts').Time, value: u },
          lower: { time: Math.floor((lastKline.openTime + interval * (i + 1)) / 1000) as unknown as import('lightweight-charts').Time, value: forecast.lower[i] },
        }))
        upperSeries.setData(bandData.map((d) => d.upper))
        lowerSeries.setData(bandData.map((d) => d.lower))
      }
    }

    chart.timeScale().fitContent()

    const handleResize = () => chart.applyOptions({ width: container.clientWidth })
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [klines, forecast])

  return (
    <div className="w-full rounded overflow-hidden">
      <div ref={containerRef} />
    </div>
  )
}
