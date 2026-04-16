'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Kline, KlineInterval } from '@/lib/binance'
import { calcEMA, calcBollingerBands, calcVWAP, calcRSI, calcMACD } from '@/lib/indicators'
import type {
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  LineData,
  SeriesMarker,
  Time,
} from 'lightweight-charts'

interface Props {
  klines: Kline[]
  interval: KlineInterval
  onIntervalChange: (i: KlineInterval) => void
}

const INTERVALS: KlineInterval[] = ['1m', '5m', '15m', '1h', '4h', '1d', '1w']
const CHART_HEIGHT = 400

let lcModule: typeof import('lightweight-charts') | null = null
if (typeof window !== 'undefined') {
  import('lightweight-charts').then(m => { lcModule = m })
}

// ─── Overlay keys ─────────────────────────────────────────────────────────────

type OverlayKey = 'ema12' | 'ema26' | 'ema200' | 'bb' | 'vwap' | 'signals'

interface SeriesRefs {
  candle:  ISeriesApi<'Candlestick'>
  volume:  ISeriesApi<'Histogram'>
  ema12:   ISeriesApi<'Line'> | null
  ema26:   ISeriesApi<'Line'> | null
  ema200:  ISeriesApi<'Line'> | null
  bbUpper: ISeriesApi<'Line'> | null
  bbMid:   ISeriesApi<'Line'> | null
  bbLower: ISeriesApi<'Line'> | null
  vwap:    ISeriesApi<'Line'> | null
}

function toTime(ms: number): Time { return Math.floor(ms / 1000) as unknown as Time }
function buildCandleData(k: Kline): CandlestickData {
  return { time: toTime(k.openTime), open: k.open, high: k.high, low: k.low, close: k.close }
}
function buildVolumeData(k: Kline): HistogramData {
  return { time: toTime(k.openTime), value: k.volume, color: k.close >= k.open ? '#22c55e40' : '#ef444440' }
}
function fmtP(n: number): string {
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (n >= 1) return n.toFixed(4)
  return n.toFixed(6)
}

// ─── Signal computation ───────────────────────────────────────────────────────

function computeSignals(klines: Kline[]): SeriesMarker<Time>[] {
  if (klines.length < 30) return []
  const closes = klines.map(k => k.close)
  const ema12  = calcEMA(closes, 12)
  const ema26  = calcEMA(closes, 26)
  const rsi    = calcRSI(closes, 14)
  const macd   = calcMACD(closes)
  const bb     = calcBollingerBands(closes, 20, 2)

  const markers: SeriesMarker<Time>[] = []

  for (let i = 2; i < klines.length; i++) {
    const t = toTime(klines[i].openTime)
    let bullScore = 0; const bullReasons: string[] = []
    let bearScore = 0; const bearReasons: string[] = []

    // EMA 12/26 crossover
    if (!isNaN(ema12[i]) && !isNaN(ema26[i]) && !isNaN(ema12[i-1]) && !isNaN(ema26[i-1])) {
      if (ema12[i] > ema26[i] && ema12[i-1] <= ema26[i-1]) { bullScore++; bullReasons.push('EMA') }
      if (ema12[i] < ema26[i] && ema12[i-1] >= ema26[i-1]) { bearScore++; bearReasons.push('EMA') }
    }

    // MACD histogram flip
    const h  = macd[i]?.histogram;   const hp = macd[i-1]?.histogram
    if (!isNaN(h) && !isNaN(hp)) {
      if (h > 0 && hp <= 0) { bullScore++; bullReasons.push('MACD') }
      if (h < 0 && hp >= 0) { bearScore++; bearReasons.push('MACD') }
    }

    // RSI extreme exits
    const r = rsi[i]; const rp = rsi[i-1]
    if (!isNaN(r) && !isNaN(rp)) {
      if (r > 30 && rp <= 30) { bullScore++; bullReasons.push('RSI') }   // exit oversold
      if (r < 70 && rp >= 70) { bearScore++; bearReasons.push('RSI') }   // exit overbought
      if (rp < 25 && klines[i].close > klines[i-1].close) { bullScore++; bullReasons.push('OS') }
      if (rp > 75 && klines[i].close < klines[i-1].close) { bearScore++; bearReasons.push('OB') }
    }

    // Bollinger band rejection / bounce
    const b = bb[i]
    if (b && !isNaN(b.upper)) {
      if (klines[i].low <= b.lower && klines[i].close > klines[i-1].close) { bullScore++; bullReasons.push('BB↑') }
      if (klines[i].high >= b.upper && klines[i].close < klines[i-1].close) { bearScore++; bearReasons.push('BB↓') }
    }

    if (bullScore > 0) {
      const strong = bullScore >= 2
      markers.push({
        time: t,
        position: 'belowBar',
        color:    strong ? '#16a34a' : '#4ade80',
        shape:    strong ? 'arrowUp' : 'circle',
        text:     bullReasons.join(' + '),
        size:     strong ? 2 : 1,
      })
    }
    if (bearScore > 0) {
      const strong = bearScore >= 2
      markers.push({
        time: t,
        position: 'aboveBar',
        color:    strong ? '#dc2626' : '#f87171',
        shape:    strong ? 'arrowDown' : 'circle',
        text:     bearReasons.join(' + '),
        size:     strong ? 2 : 1,
      })
    }
  }

  return markers.sort((a, b) => (a.time as number) - (b.time as number))
}

// ─── Drawing types ────────────────────────────────────────────────────────────

type DrawTool = 'cursor' | 'hline' | 'trend' | 'ray' | 'fib' | 'eraser'

interface HLineDrawing { id: string; type: 'hline'; price: number; color: string }
interface TrendDrawing { id: string; type: 'trend'; t1: number; p1: number; t2: number; p2: number; color: string }
interface RayDrawing   { id: string; type: 'ray';   t1: number; p1: number; t2: number; p2: number; color: string }
interface FibDrawing   { id: string; type: 'fib';   t1: number; p1: number; t2: number; p2: number; color: string }
type Drawing = HLineDrawing | TrendDrawing | RayDrawing | FibDrawing

const FIB_LEVELS = [
  { r: 0,     label: '0%',    color: '#6b7280' },
  { r: 0.236, label: '23.6%', color: '#60a5fa' },
  { r: 0.382, label: '38.2%', color: '#34d399' },
  { r: 0.5,   label: '50%',   color: '#a78bfa' },
  { r: 0.618, label: '61.8%', color: '#fbbf24' },
  { r: 0.786, label: '78.6%', color: '#f97316' },
  { r: 1,     label: '100%',  color: '#6b7280' },
]

const DRAW_TOOLS: { key: DrawTool; icon: string; desc: string }[] = [
  { key: 'cursor',  icon: '↖', desc: 'Cursor — normal zoom & scroll' },
  { key: 'hline',   icon: '—', desc: 'Horizontal line (1 click)' },
  { key: 'trend',   icon: '╱', desc: 'Trend line (2 clicks)' },
  { key: 'ray',     icon: '→', desc: 'Extended ray (2 clicks)' },
  { key: 'fib',     icon: '◫', desc: 'Fibonacci retracement (2 clicks)' },
  { key: 'eraser',  icon: '✕', desc: 'Click drawing to erase' },
]

const DRAW_COLORS = ['#fbbf24', '#60a5fa', '#f87171', '#34d399', '#a78bfa', '#e2e8f0']

// ─── Component ────────────────────────────────────────────────────────────────

export default function CandlestickChart({ klines, interval, onIntervalChange }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const chartRef      = useRef<IChartApi | null>(null)
  const seriesRef     = useRef<SeriesRefs | null>(null)
  const resizeRef     = useRef<() => void>(() => {})
  const prevKlinesRef = useRef<Kline[]>([])
  const prevOvlRef    = useRef<Record<OverlayKey, boolean> | null>(null)
  const viewCbRef     = useRef<(() => void) | null>(null)

  const [overlays, setOverlays] = useState<Record<OverlayKey, boolean>>({
    ema12: true, ema26: true, ema200: true, bb: false, vwap: false, signals: false,
  })

  // Drawing state
  const [activeTool,   setActiveTool]   = useState<DrawTool>('cursor')
  const [drawColor,    setDrawColor]    = useState(DRAW_COLORS[0])
  const [drawings,     setDrawings]     = useState<Drawing[]>([])
  const [pendingPt,    setPendingPt]    = useState<{ t: number; p: number } | null>(null)
  const [previewPos,   setPreviewPos]   = useState<{ x: number; y: number } | null>(null)
  // viewVersion increments on scroll/zoom → forces SVG drawings to recompute screen positions
  const [viewVersion,  setViewVersion]  = useState(0)

  // ── Coordinate helpers ───────────────────────────────────────────────────────

  /** Convert chart-relative pixel coords → price+time. Time may be null (price-scale area). */
  const getPrice = useCallback((y: number): number | null => {
    return seriesRef.current?.candle.coordinateToPrice(y) ?? null
  }, [])

  const getTime = useCallback((x: number): number | null => {
    const t = chartRef.current?.timeScale().coordinateToTime(x)
    return t != null ? (t as unknown as number) : null
  }, [])

  /** Price+time → screen {x, y} relative to the chart container. */
  const toXY = useCallback((t: number, p: number) => {
    if (!chartRef.current || !seriesRef.current?.candle) return null
    const x = chartRef.current.timeScale().timeToCoordinate(t as unknown as Time)
    const y = seriesRef.current.candle.priceToCoordinate(p)
    if (x === null || y === null) return null
    return { x: x as number, y: y as number }
  }, [])

  /** Get mouse position relative to the chart container element. */
  const chartXY = useCallback((e: React.MouseEvent): { x: number; y: number } | null => {
    if (!containerRef.current) return null
    const rect = containerRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  // ── Mouse events on SVG overlay ──────────────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool === 'cursor') return
    const pos = chartXY(e)
    if (!pos) return
    const { x, y } = pos

    // HORIZONTAL LINE — only needs price (y), never needs time
    if (activeTool === 'hline') {
      const price = getPrice(y)
      if (price === null) return
      setDrawings(prev => [...prev, { id: `${Date.now()}`, type: 'hline', price, color: drawColor }])
      return
    }

    // ERASER
    if (activeTool === 'eraser') {
      let minDist = 20   // pixel threshold
      let removeId = ''
      for (const d of drawings) {
        let dist = Infinity
        if (d.type === 'hline') {
          const cy = seriesRef.current?.candle.priceToCoordinate(d.price)
          if (cy !== null && cy !== undefined) dist = Math.abs((cy as number) - y)
        } else {
          const a = toXY(d.t1, d.p1)
          const b = toXY(d.t2, d.p2)
          if (a && b) {
            const dx = b.x - a.x; const dy = b.y - a.y
            const len2 = dx * dx + dy * dy
            if (len2 === 0) { dist = Math.hypot(x - a.x, y - a.y) }
            else {
              const tVal = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2))
              dist = Math.hypot(x - (a.x + tVal * dx), y - (a.y + tVal * dy))
            }
          }
        }
        if (dist < minDist) { minDist = dist; removeId = d.id }
      }
      if (removeId) setDrawings(prev => prev.filter(d => d.id !== removeId))
      return
    }

    // TWO-CLICK TOOLS (trend, ray, fib)
    const price = getPrice(y)
    const time  = getTime(x)
    if (price === null || time === null) return

    if (!pendingPt) {
      setPendingPt({ t: time, p: price })
    } else {
      const id = `${Date.now()}`
      if (activeTool === 'trend') {
        setDrawings(prev => [...prev, { id, type: 'trend', t1: pendingPt.t, p1: pendingPt.p, t2: time, p2: price, color: drawColor }])
      } else if (activeTool === 'ray') {
        setDrawings(prev => [...prev, { id, type: 'ray', t1: pendingPt.t, p1: pendingPt.p, t2: time, p2: price, color: drawColor }])
      } else if (activeTool === 'fib') {
        setDrawings(prev => [...prev, { id, type: 'fib', t1: pendingPt.t, p1: pendingPt.p, t2: time, p2: price, color: drawColor }])
      }
      setPendingPt(null)
      setPreviewPos(null)
    }
  }, [activeTool, drawColor, drawings, pendingPt, chartXY, getPrice, getTime, toXY])

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool === 'cursor') return
    const pos = chartXY(e)
    if (pos) setPreviewPos(pos)
  }, [activeTool, chartXY])

  const handleMouseLeave = useCallback(() => setPreviewPos(null), [])

  // ── SVG drawing renderer ─────────────────────────────────────────────────────

  const renderDrawings = () => {
    if (!chartRef.current || !seriesRef.current?.candle) return null
    // svgW computed fresh every render — correct since containerRef is stable
    const W = containerRef.current?.clientWidth ?? 700
    const H = CHART_HEIGHT
    const elements: React.ReactNode[] = []

    for (const d of drawings) {
      if (d.type === 'hline') {
        const rawY = seriesRef.current.candle.priceToCoordinate(d.price)
        if (rawY === null) continue
        const y = rawY as number
        elements.push(
          <g key={d.id}>
            <line x1={0} y1={y} x2={W} y2={y}
              stroke={d.color} strokeWidth={1.5} strokeDasharray="6 3" opacity={0.9} />
            <rect x={W - 80} y={y - 11} width={78} height={16} rx={3}
              fill="#111827" stroke={d.color} strokeWidth={0.5} opacity={0.92} />
            <text x={W - 41} y={y + 4} textAnchor="middle"
              fill={d.color} fontSize={10} fontFamily="monospace" fontWeight="500">
              ${fmtP(d.price)}
            </text>
          </g>
        )
      } else if (d.type === 'trend') {
        const a = toXY(d.t1, d.p1)
        const b = toXY(d.t2, d.p2)
        if (!a || !b) continue
        elements.push(
          <g key={d.id}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={d.color} strokeWidth={1.5} opacity={0.9} />
            <circle cx={a.x} cy={a.y} r={3.5} fill={d.color} opacity={0.9} />
            <circle cx={b.x} cy={b.y} r={3.5} fill={d.color} opacity={0.9} />
          </g>
        )
      } else if (d.type === 'ray') {
        const a = toXY(d.t1, d.p1)
        const b = toXY(d.t2, d.p2)
        if (!a || !b) continue
        const dx = b.x - a.x; const dy = b.y - a.y
        // Extend ray far beyond the screen in the direction from a → b
        const ext = dx !== 0 ? (W * 3) / Math.abs(dx) : 10
        elements.push(
          <g key={d.id}>
            <line x1={a.x} y1={a.y}
              x2={a.x + dx * ext} y2={a.y + dy * ext}
              stroke={d.color} strokeWidth={1.5} opacity={0.9}
              clipPath={`url(#chartClip)`}
            />
            <circle cx={a.x} cy={a.y} r={3.5} fill={d.color} opacity={0.9} />
          </g>
        )
      } else if (d.type === 'fib') {
        const highP = Math.max(d.p1, d.p2)
        const lowP  = Math.min(d.p1, d.p2)
        const diff  = highP - lowP
        const fibElements: React.ReactNode[] = []
        for (const { r, label, color } of FIB_LEVELS) {
          const price = highP - diff * r
          const rawY = seriesRef.current.candle.priceToCoordinate(price)
          if (rawY === null) continue
          const y = rawY as number
          if (y < 0 || y > H) continue
          const isMajor = r === 0.618 || r === 0.5 || r === 0.382
          const labelW = label.length * 5.4 + fmtP(price).length * 6 + 16
          fibElements.push(
            <g key={`${d.id}-${r}`}>
              <line x1={0} y1={y} x2={W} y2={y}
                stroke={color}
                strokeWidth={isMajor ? 1.5 : 1}
                strokeDasharray={isMajor ? '6 3' : '4 4'}
                opacity={isMajor ? 0.9 : 0.55}
              />
              <rect x={8} y={y - 10} width={labelW} height={14} rx={2}
                fill="#111827" opacity={0.85} />
              <text x={12} y={y + 1.5} fill={color}
                fontSize={9.5} fontFamily="monospace" opacity={0.95}>
                {label} · ${fmtP(price)}
              </text>
            </g>
          )
        }
        elements.push(<g key={d.id}>{fibElements}</g>)
      }
    }

    // Preview for 2-click tools
    if (pendingPt && previewPos && activeTool !== 'cursor' && activeTool !== 'hline' && activeTool !== 'eraser') {
      const a = toXY(pendingPt.t, pendingPt.p)
      if (a) {
        elements.push(
          <g key="preview">
            <line x1={a.x} y1={a.y} x2={previewPos.x} y2={previewPos.y}
              stroke={drawColor} strokeWidth={1.5} strokeDasharray="5 3" opacity={0.7} />
            <circle cx={a.x} cy={a.y} r={4} fill={drawColor} opacity={0.9} />
            <circle cx={previewPos.x} cy={previewPos.y} r={3} fill={drawColor} opacity={0.6} />
          </g>
        )
      }
    }

    return (
      <>
        {/* Clip path so rays don't overflow the chart */}
        <defs>
          <clipPath id="chartClip">
            <rect x={0} y={0} width={W} height={H} />
          </clipPath>
        </defs>
        {elements}
      </>
    )
  }

  // ── Chart init / live update ─────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current || klines.length === 0 || !lcModule) return

    const container = containerRef.current
    const prev    = prevKlinesRef.current
    const prevOvl = prevOvlRef.current

    const overlaysChanged = prevOvl === null ||
      (Object.keys(overlays) as OverlayKey[]).some(k => overlays[k] !== prevOvl[k])

    const isLive =
      !overlaysChanged &&
      chartRef.current !== null &&
      seriesRef.current !== null &&
      prev.length > 0 &&
      (klines[0].openTime === prev[0]?.openTime || klines[0].openTime === prev[1]?.openTime)

    prevKlinesRef.current = klines
    prevOvlRef.current    = { ...overlays }

    if (isLive) {
      const s    = seriesRef.current!
      const last = klines[klines.length - 1]
      const t    = toTime(last.openTime)
      const cls  = klines.map(k => k.close)

      s.candle.update(buildCandleData(last))
      s.volume.update(buildVolumeData(last))

      if (overlays.ema12  && s.ema12)  { const v = calcEMA(cls, 12);  const lv = v[v.length-1]; if (!isNaN(lv)) s.ema12.update({ time: t, value: lv }) }
      if (overlays.ema26  && s.ema26)  { const v = calcEMA(cls, 26);  const lv = v[v.length-1]; if (!isNaN(lv)) s.ema26.update({ time: t, value: lv }) }
      if (overlays.ema200 && s.ema200) { const v = calcEMA(cls, 200); const lv = v[v.length-1]; if (!isNaN(lv)) s.ema200.update({ time: t, value: lv }) }
      if (overlays.bb && s.bbUpper && s.bbMid && s.bbLower) {
        const bb = calcBollingerBands(cls, 20, 2); const lb = bb[bb.length-1]
        if (lb && !isNaN(lb.upper)) {
          s.bbUpper.update({ time: t, value: lb.upper })
          s.bbMid.update({ time: t, value: lb.middle })
          s.bbLower.update({ time: t, value: lb.lower })
        }
      }
      if (overlays.vwap && s.vwap) { const v = calcVWAP(klines); const lv = v[v.length-1]; if (!isNaN(lv)) s.vwap.update({ time: t, value: lv }) }

      // Update signals markers live
      if (overlays.signals) s.candle.setMarkers(computeSignals(klines))
      return
    }

    // ── Full reinit ──────────────────────────────────────────────────────────
    window.removeEventListener('resize', resizeRef.current)
    if (chartRef.current) {
      if (viewCbRef.current) chartRef.current.timeScale().unsubscribeVisibleLogicalRangeChange(viewCbRef.current)
      chartRef.current.remove()
      chartRef.current = null
      seriesRef.current = null
    }

    const chart = lcModule.createChart(container, {
      width: container.clientWidth,
      height: CHART_HEIGHT,
      layout: { background: { color: '#1a1d27' }, textColor: '#9ca3af' },
      grid:   { vertLines: { color: '#2a2d3a' }, horzLines: { color: '#2a2d3a' } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#2a2d3a' },
      timeScale: { borderColor: '#2a2d3a', timeVisible: true, secondsVisible: false },
    })
    chartRef.current = chart

    const cls   = klines.map(k => k.close)
    const times = klines.map(k => toTime(k.openTime))
    const lineData = (vals: number[]): LineData[] =>
      times.map((t, i) => ({ time: t, value: vals[i] } as LineData)).filter(d => !isNaN(d.value as number))

    const candle = chart.addCandlestickSeries({
      upColor: '#22c55e', downColor: '#ef4444',
      borderUpColor: '#22c55e', borderDownColor: '#ef4444',
      wickUpColor: '#22c55e', wickDownColor: '#ef4444',
    })
    candle.setData(klines.map(buildCandleData))

    if (overlays.signals) candle.setMarkers(computeSignals(klines))

    const volume = chart.addHistogramSeries({ color: '#26a69a', priceFormat: { type: 'volume' }, priceScaleId: 'volume' })
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
    volume.setData(klines.map(buildVolumeData))

    let ema12S:  ISeriesApi<'Line'> | null = null
    let ema26S:  ISeriesApi<'Line'> | null = null
    let ema200S: ISeriesApi<'Line'> | null = null
    let bbU: ISeriesApi<'Line'> | null = null
    let bbM: ISeriesApi<'Line'> | null = null
    let bbL: ISeriesApi<'Line'> | null = null
    let vwapS: ISeriesApi<'Line'> | null = null

    if (overlays.ema12) {
      ema12S = chart.addLineSeries({ color: '#f97316', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
      ema12S.setData(lineData(calcEMA(cls, 12)))
    }
    if (overlays.ema26) {
      ema26S = chart.addLineSeries({ color: '#3b82f6', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
      ema26S.setData(lineData(calcEMA(cls, 26)))
    }
    if (overlays.ema200) {
      ema200S = chart.addLineSeries({ color: '#ec4899', lineWidth: 2, priceLineVisible: false, lastValueVisible: true })
      ema200S.setData(lineData(calcEMA(cls, 200)))
    }
    if (overlays.bb) {
      const bb = calcBollingerBands(cls, 20, 2)
      bbU = chart.addLineSeries({ color: '#6b7280', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
      bbM = chart.addLineSeries({ color: '#4b5563', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false })
      bbL = chart.addLineSeries({ color: '#6b7280', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
      bbU.setData(times.map((t, i) => ({ time: t, value: bb[i].upper  } as LineData)).filter(d => !isNaN(d.value as number)))
      bbM.setData(times.map((t, i) => ({ time: t, value: bb[i].middle } as LineData)).filter(d => !isNaN(d.value as number)))
      bbL.setData(times.map((t, i) => ({ time: t, value: bb[i].lower  } as LineData)).filter(d => !isNaN(d.value as number)))
    }
    if (overlays.vwap) {
      vwapS = chart.addLineSeries({ color: '#a78bfa', lineWidth: 1, lineStyle: 1, priceLineVisible: false, lastValueVisible: true })
      vwapS.setData(lineData(calcVWAP(klines)))
    }

    seriesRef.current = {
      candle, volume,
      ema12: ema12S, ema26: ema26S, ema200: ema200S,
      bbUpper: bbU, bbMid: bbM, bbLower: bbL, vwap: vwapS,
    }

    chart.timeScale().fitContent()

    // Subscribe to viewport changes → re-renders SVG drawings at correct positions
    const onViewChange = () => setViewVersion(v => v + 1)
    viewCbRef.current = onViewChange
    chart.timeScale().subscribeVisibleLogicalRangeChange(onViewChange)

    resizeRef.current = () => {
      if (!containerRef.current) return
      chart.applyOptions({ width: containerRef.current.clientWidth })
      setViewVersion(v => v + 1)
    }
    window.addEventListener('resize', resizeRef.current)
  }, [klines, overlays])

  useEffect(() => {
    return () => {
      window.removeEventListener('resize', resizeRef.current)
      if (chartRef.current) {
        if (viewCbRef.current) chartRef.current.timeScale().unsubscribeVisibleLogicalRangeChange(viewCbRef.current)
        chartRef.current.remove()
        chartRef.current = null
        seriesRef.current = null
      }
    }
  }, [])

  const toggleOverlay = (key: OverlayKey) => setOverlays(prev => ({ ...prev, [key]: !prev[key] }))

  const isDrawing = activeTool !== 'cursor'
  const needsSecond = pendingPt !== null && (activeTool === 'trend' || activeTool === 'ray' || activeTool === 'fib')

  return (
    <div className="card space-y-3">

      {/* ── Row 1: intervals + overlays ───────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          {INTERVALS.map(iv => (
            <button key={iv} onClick={() => onIntervalChange(iv)}
              className={`px-2 py-1 rounded text-xs font-mono font-medium transition-colors ${
                iv === interval ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-100 hover:bg-surface-muted'
              }`}
            >
              {iv}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(
            [
              { key: 'ema12',   label: 'EMA 12',   color: 'text-orange-400' },
              { key: 'ema26',   label: 'EMA 26',   color: 'text-blue-400'   },
              { key: 'ema200',  label: 'EMA 200',  color: 'text-pink-400'   },
              { key: 'bb',      label: 'BB',        color: 'text-gray-400'  },
              { key: 'vwap',    label: 'VWAP',     color: 'text-violet-400' },
              { key: 'signals', label: '⚡ Signals', color: 'text-amber-400' },
            ] as { key: OverlayKey; label: string; color: string }[]
          ).map(({ key, label, color }) => (
            <button key={key} onClick={() => toggleOverlay(key)}
              className={`px-2 py-0.5 rounded border text-xs font-mono transition-colors ${
                overlays[key] ? `border-current/50 bg-current/10 ${color}` : 'border-surface-border text-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Row 2: drawing toolbar ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-surface-border/50">
        <span className="text-xs text-gray-600 shrink-0">Draw:</span>
        {DRAW_TOOLS.map(({ key, icon, desc }) => (
          <button
            key={key}
            title={desc}
            onClick={() => { setActiveTool(key); setPendingPt(null); setPreviewPos(null) }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-mono transition-all ${
              activeTool === key
                ? 'bg-blue-600/25 border-blue-500/60 text-blue-200'
                : 'border-surface-border text-gray-500 hover:text-gray-200 hover:border-gray-500'
            }`}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>{icon}</span>
            <span className="capitalize">{key}</span>
          </button>
        ))}

        {/* Color swatches */}
        <div className="flex items-center gap-1.5 ml-1">
          {DRAW_COLORS.map(c => (
            <button key={c} title={c} onClick={() => setDrawColor(c)}
              className={`w-4 h-4 rounded-full transition-transform hover:scale-125 ${drawColor === c ? 'ring-2 ring-white scale-125' : 'ring-1 ring-white/20'}`}
              style={{ background: c }}
            />
          ))}
        </div>

        {drawings.length > 0 && (
          <button onClick={() => { setDrawings([]); setPendingPt(null) }}
            className="ml-auto text-xs text-red-400/80 hover:text-red-300 border border-red-500/25 hover:border-red-400/50 px-2 py-1 rounded transition-colors">
            Clear ({drawings.length})
          </button>
        )}

        {needsSecond && (
          <span className="ml-auto text-xs text-amber-400 animate-pulse shrink-0">
            ← Now click the second point on the chart
          </span>
        )}
      </div>

      {/* ── Signals legend (when active) ───────────────────────────────── */}
      {overlays.signals && (
        <div className="flex flex-wrap items-center gap-3 text-xs px-1 py-1 bg-amber-500/5 border border-amber-500/15 rounded-lg">
          <span className="text-amber-400 font-medium shrink-0">⚡ Signal key:</span>
          <span className="flex items-center gap-1"><span className="text-green-500 font-bold text-base leading-none">▲</span><span className="text-gray-400">Strong Buy (2+ indicators)</span></span>
          <span className="flex items-center gap-1"><span className="text-green-400 font-bold">●</span><span className="text-gray-400">Buy signal</span></span>
          <span className="flex items-center gap-1"><span className="text-red-500 font-bold text-base leading-none">▼</span><span className="text-gray-400">Strong Sell (2+ indicators)</span></span>
          <span className="flex items-center gap-1"><span className="text-red-400 font-bold">●</span><span className="text-gray-400">Sell signal</span></span>
          <span className="text-gray-600">EMA cross · MACD flip · RSI extreme · BB bounce</span>
        </div>
      )}

      {/* ── Chart + SVG overlay ────────────────────────────────────────── */}
      {/*
        IMPORTANT: SVG has NO explicit width/height attributes — only CSS sizing.
        Without a viewBox, SVG coordinate space is 1:1 with CSS pixels, which
        matches lightweight-charts' priceToCoordinate / timeToCoordinate output.
        Mouse coords are computed relative to containerRef (the chart element),
        which is also lightweight-charts' coordinate origin.
      */}
      <div className="relative rounded-lg overflow-hidden" style={{ height: CHART_HEIGHT }}>
        <div ref={containerRef} className="absolute inset-0" />
        <svg
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            pointerEvents: isDrawing ? 'all' : 'none',
            cursor: isDrawing ? (activeTool === 'eraser' ? 'crosshair' : 'crosshair') : 'default',
            // Hide chart's own cursor when drawing (prevents confusion)
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Force re-render when viewport changes (viewVersion ensures fresh coords) */}
          {viewVersion >= 0 && renderDrawings()}
        </svg>
      </div>

      {isDrawing && (
        <p className="text-xs text-gray-600">
          {activeTool === 'hline' && 'Click anywhere on the chart to place a horizontal price line.'}
          {activeTool === 'trend' && (needsSecond ? 'Click the second point to complete the trend line.' : 'Click the first point of the trend line.')}
          {activeTool === 'ray'   && (needsSecond ? 'Click the second point to set the direction.' : 'Click the first point of the ray.')}
          {activeTool === 'fib'   && (needsSecond ? 'Click the second point (other extreme) to draw Fibonacci levels.' : 'Click the high or low extreme point.')}
          {activeTool === 'eraser' && 'Click on any drawing to remove it.'}
          {' '}Switch to <strong>Cursor</strong> to re-enable scroll/zoom.
        </p>
      )}
    </div>
  )
}
