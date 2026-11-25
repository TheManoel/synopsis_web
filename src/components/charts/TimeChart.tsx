import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  PriceScaleMode,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type SeriesType,
  type Time,
} from 'lightweight-charts'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useCssVars } from '../../lib/theme'
import { ZonesPrimitive, type ZoneBox } from './zonePrimitive'

/** `color`: a histogram bar's own colour (volume by the session's sign). */
export type Pt = { time: string; value: number | null; color?: string }

/** An event drawn on a line series (an entry, an exit). Sorted by time. */
export interface Marker {
  time: string
  position: 'aboveBar' | 'belowBar'
  shape: 'arrowUp' | 'arrowDown' | 'circle'
  color: string
  text?: string
}

export type SeriesSpec =
  | { type: 'candles'; id: string; label: string; data: { time: string; open: number; high: number; low: number; close: number }[]; format?: (v: number) => string; markers?: Marker[] }
  /** `hidden`: no line, only its value in the legend (a level drawn as zones). */
  | { type: 'line'; id: string; label: string; data: Pt[]; color: string; width?: 1 | 2 | 3; dashed?: boolean; hidden?: boolean; format?: (v: number) => string; markers?: Marker[] }
  | { type: 'histogram'; id: string; label: string; data: Pt[]; color: string; negativeColor?: string; format?: (v: number) => string }

export interface PaneSpec {
  title?: string
  stretch?: number
  series: SeriesSpec[]
  /** Horizontal reference levels drawn on the pane's first series. */
  levels?: { value: number; label?: string; color?: string }[] // value shown on the price axis
  /** Logarithmic price scale: equal moves in % look equal (long histories). */
  logScale?: boolean
  /** Zones drawn over the pane's first series (ceilings/floors); hovering a
   * session shows the text of the zones it falls in. */
  zones?: ZoneLayer[]
}

export interface ZoneLayer {
  id: string
  label: string
  color: string
  boxes: (ZoneBox & { text: string })[]
}

const THEME_VARS = ['surface', 'ink-2', 'ink-3', 'grid', 'axis', 'up', 'down', 'line-strong'] as const

/** Resolve `var(--x)` strings for the canvas renderer. */
function resolve(color: string): string {
  const m = /^var\((--[\w-]+)\)$/.exec(color)
  if (!m) return color
  return getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || color
}

/**
 * Daily time-series chart with stacked, crosshair-synchronised panes.
 * The chart is rebuilt when the spec or theme changes: specs are small and
 * this keeps the component declarative.
 */
export function TimeChart({
  panes,
  height = 360,
  className,
  rangeKey,
  notes,
}: {
  panes: PaneSpec[]
  height?: number
  className?: string
  /** While it stays the same, a rebuilt chart keeps the visible range (adding an
   * indicator does not reset the zoom); a new key fits the content again. */
  rangeKey?: string
  /** Text shown under the legend when the cursor is on that session (events). */
  notes?: Record<string, string>
}) {
  const host = useRef<HTMLDivElement>(null)
  const saved = useRef<{ key: string; range: { from: number; to: number } } | null>(null)
  const vars = useCssVars(THEME_VARS)
  const [hover, setHover] = useState<{ time: string | null; values: Record<string, number | null> }>({ time: null, values: {} })

  const lastValues = useMemo(() => {
    const out: Record<string, number | null> = {}
    for (const p of panes)
      for (const s of p.series) {
        // The last known value: a series can end before the bars (a stored history that lags).
        let v: number | null = null
        for (let i = s.data.length - 1; i >= 0 && v == null; i--) {
          const d = s.data[i] as { value?: number | null; close?: number }
          v = s.type === 'candles' ? (d.close ?? null) : (d.value ?? null)
        }
        out[s.id] = v
      }
    return out
  }, [panes])

  useEffect(() => {
    const el = host.current
    if (!el) return
    const chart: IChartApi = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: vars.surface },
        textColor: vars['ink-3'],
        fontFamily: "'Inter Variable', system-ui, sans-serif",
        fontSize: 11,
        attributionLogo: false,
        panes: { separatorColor: vars.grid, separatorHoverColor: vars['line-strong'], enableResize: true },
      },
      grid: { vertLines: { visible: false }, horzLines: { color: vars.grid } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.08 } },
      // A low floor lets fitContent show decades of sessions; it only bites past ~2 bars per pixel.
      timeScale: { borderVisible: false, rightOffset: 4, minBarSpacing: 0.02 },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: vars.axis, width: 1, style: LineStyle.Solid, labelBackgroundColor: vars.axis },
        horzLine: { color: vars.axis, width: 1, style: LineStyle.Solid, labelBackgroundColor: vars.axis },
      },
      localization: { locale: 'es-ES' },
    })

    const byId = new Map<string, ISeriesApi<SeriesType>>()
    panes.forEach((pane, paneIndex) => {
      pane.series.forEach((s, i) => {
        let api: ISeriesApi<SeriesType>
        const priceFormat = s.format
          ? { type: 'custom' as const, formatter: s.format, minMove: 0.0001 }
          : undefined
        if (s.type === 'candles') {
          api = chart.addSeries(
            CandlestickSeries,
            {
              upColor: vars.up, downColor: vars.down, wickUpColor: vars.up, wickDownColor: vars.down,
              borderVisible: false, priceLineVisible: false, ...(priceFormat ? { priceFormat } : {}),
            },
            paneIndex,
          )
          api.setData(s.data.map((d) => ({ ...d, time: d.time as Time })))
          if (s.markers?.length)
            createSeriesMarkers(
              api,
              s.markers.map((mk) => ({ ...mk, time: mk.time as Time, color: resolve(mk.color), size: 1 })),
            )
        } else if (s.type === 'line') {
          api = chart.addSeries(
            LineSeries,
            {
              color: resolve(s.color), lineWidth: s.width ?? 2, lineStyle: s.dashed ? LineStyle.Dashed : LineStyle.Solid,
              priceLineVisible: false, lastValueVisible: i === 0 && !s.hidden, crosshairMarkerRadius: 3,
              lineVisible: !s.hidden, crosshairMarkerVisible: !s.hidden,
              ...(priceFormat ? { priceFormat } : {}),
            },
            paneIndex,
          )
          api.setData(s.data.map((d) => (d.value == null ? { time: d.time as Time } : { time: d.time as Time, value: d.value })))
          if (s.markers?.length)
            createSeriesMarkers(
              api,
              s.markers.map((mk) => ({ ...mk, time: mk.time as Time, color: resolve(mk.color), size: 1 })),
            )
        } else {
          const pos = resolve(s.color)
          const neg = resolve(s.negativeColor ?? s.color)
          api = chart.addSeries(
            HistogramSeries,
            { priceLineVisible: false, lastValueVisible: false, base: 0, ...(priceFormat ? { priceFormat } : {}) },
            paneIndex,
          )
          api.setData(
            s.data.map((d) =>
              d.value == null
                ? { time: d.time as Time }
                : { time: d.time as Time, value: d.value, color: d.color ? resolve(d.color) : d.value >= 0 ? pos : neg },
            ),
          )
        }
        byId.set(s.id, api)
        if (i === 0)
          for (const layer of pane.zones ?? []) api.attachPrimitive(new ZonesPrimitive(layer.boxes, resolve(layer.color), vars.surface))
        if (i === 0)
          for (const lv of pane.levels ?? [])
            api.createPriceLine({
              price: lv.value, color: resolve(lv.color ?? 'var(--axis)'), lineWidth: 1,
              lineStyle: LineStyle.Solid, axisLabelVisible: true, title: '',
            })
      })
    })

    // Per pane, by index: a series' own priceScale() reaches the shared 'right'
    // scale, and a log mode there would also take the panes below (drawdowns ≤ 0).
    panes.forEach((pane, paneIndex) => {
      if (pane.logScale) chart.priceScale('right', paneIndex).applyOptions({ mode: PriceScaleMode.Logarithmic })
    })

    const total = panes.reduce((a, p) => a + (p.stretch ?? 1), 0)
    chart.panes().forEach((p, i) => p.setStretchFactor((panes[i]?.stretch ?? 1) / total))
    const keep = rangeKey && saved.current?.key === rangeKey ? saved.current.range : null
    if (!keep) saved.current = null
    if (keep) chart.timeScale().setVisibleLogicalRange(keep)
    else chart.timeScale().fitContent()
    // Remembered as the chart reports it (fit and restore apply lazily: reading
    // the range at teardown could catch the default view before the fit).
    const onRange = (r: { from: number; to: number } | null) => {
      if (rangeKey && r) saved.current = { key: rangeKey, range: { from: r.from, to: r.to } }
    }
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange)

    const onMove = (param: MouseEventParams<Time>) => {
      if (!param.time) {
        setHover({ time: null, values: {} })
        return
      }
      const values: Record<string, number | null> = {}
      byId.forEach((api, id) => {
        const d = param.seriesData.get(api) as { value?: number; close?: number } | undefined
        values[id] = d ? (d.close ?? d.value ?? null) : null
      })
      setHover({ time: String(param.time), values })
    }
    chart.subscribeCrosshairMove(onMove)
    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange)
      chart.unsubscribeCrosshairMove(onMove)
      chart.remove()
    }
  }, [panes, vars, rangeKey])

  const shown = hover.time ? hover.values : lastValues
  // The zones under the hovered session, said in the core's words.
  const hoveredZones = useMemo(() => {
    const t = hover.time
    if (!t) return []
    return panes.flatMap((p) =>
      (p.zones ?? []).flatMap((layer) =>
        layer.boxes.filter((b) => b.from <= t && t <= b.to).map((b) => ({ key: `${layer.id}-${b.from}-${b.start}`, color: layer.color, label: layer.label, text: b.text })),
      ),
    )
  }, [hover.time, panes])
  return (
    <div className={className}>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        <span className="num text-ink-3">{hover.time ?? 'Último'}</span>
        {panes.flatMap((p) =>
          p.series.map((s) => {
            const v = shown[s.id]
            const color = s.type === 'candles' ? 'var(--ink-2)' : s.color
            return (
              <span key={s.id} className="inline-flex items-center gap-1.5 text-ink-2">
                <span className="h-[3px] w-3 rounded-full" style={{ background: color }} aria-hidden />
                {s.label}
                <span className="num font-medium text-ink">
                  {v == null ? '—' : s.format ? s.format(v) : v.toLocaleString('es-ES', { maximumFractionDigits: 2 })}
                </span>
              </span>
            )
          }),
        )}
      </div>
      {notes && (
        <div className="mb-2 min-h-[1.5em] text-[11px] leading-snug text-ink-2">
          {hover.time && notes[hover.time] ? notes[hover.time] : null}
        </div>
      )}
      {panes.some((p) => p.zones?.length) && (
        <div className="mb-2 min-h-[2.5em] space-y-0.5 text-[11px] leading-snug text-ink-2">
          {hoveredZones.length
            ? hoveredZones.map((z) => (
                <div key={z.key} className="flex items-start gap-1.5">
                  <span className="mt-[5px] h-[3px] w-3 shrink-0 rounded-full" style={{ background: z.color }} aria-hidden />
                  <span>{z.text}</span>
                </div>
              ))
            : <span className="text-ink-3">Pasa el cursor por una zona para ver cómo se forma: sus puntos, desde cuándo es el nivel y por qué deja de serlo.</span>}
        </div>
      )}
      <div ref={host} style={{ height }} className="w-full" />
    </div>
  )
}
