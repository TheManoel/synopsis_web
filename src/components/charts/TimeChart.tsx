import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type SeriesType,
  type Time,
} from 'lightweight-charts'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useCssVars } from '../../lib/theme'

export type Pt = { time: string; value: number | null }

export type SeriesSpec =
  | { type: 'candles'; id: string; label: string; data: { time: string; open: number; high: number; low: number; close: number }[]; format?: (v: number) => string }
  | { type: 'line'; id: string; label: string; data: Pt[]; color: string; width?: 1 | 2 | 3; dashed?: boolean; format?: (v: number) => string }
  | { type: 'histogram'; id: string; label: string; data: Pt[]; color: string; negativeColor?: string; format?: (v: number) => string }

export interface PaneSpec {
  title?: string
  stretch?: number
  series: SeriesSpec[]
  /** Horizontal reference levels drawn on the pane's first series. */
  levels?: { value: number; label?: string; color?: string }[] // value shown on the price axis
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
export function TimeChart({ panes, height = 360, className }: { panes: PaneSpec[]; height?: number; className?: string }) {
  const host = useRef<HTMLDivElement>(null)
  const vars = useCssVars(THEME_VARS)
  const [hover, setHover] = useState<{ time: string | null; values: Record<string, number | null> }>({ time: null, values: {} })

  const lastValues = useMemo(() => {
    const out: Record<string, number | null> = {}
    for (const p of panes)
      for (const s of p.series) {
        const last = s.data[s.data.length - 1] as { value?: number | null; close?: number } | undefined
        out[s.id] = last ? (s.type === 'candles' ? (last.close ?? null) : (last.value ?? null)) : null
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
      timeScale: { borderVisible: false, rightOffset: 4, minBarSpacing: 0.5 },
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
        } else if (s.type === 'line') {
          api = chart.addSeries(
            LineSeries,
            {
              color: resolve(s.color), lineWidth: s.width ?? 2, lineStyle: s.dashed ? LineStyle.Dashed : LineStyle.Solid,
              priceLineVisible: false, lastValueVisible: i === 0, crosshairMarkerRadius: 3,
              ...(priceFormat ? { priceFormat } : {}),
            },
            paneIndex,
          )
          api.setData(s.data.map((d) => (d.value == null ? { time: d.time as Time } : { time: d.time as Time, value: d.value })))
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
              d.value == null ? { time: d.time as Time } : { time: d.time as Time, value: d.value, color: d.value >= 0 ? pos : neg },
            ),
          )
        }
        byId.set(s.id, api)
        if (i === 0)
          for (const lv of pane.levels ?? [])
            api.createPriceLine({
              price: lv.value, color: resolve(lv.color ?? 'var(--axis)'), lineWidth: 1,
              lineStyle: LineStyle.Solid, axisLabelVisible: true, title: '',
            })
      })
    })

    const total = panes.reduce((a, p) => a + (p.stretch ?? 1), 0)
    chart.panes().forEach((p, i) => p.setStretchFactor((panes[i]?.stretch ?? 1) / total))
    chart.timeScale().fitContent()

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
      chart.unsubscribeCrosshairMove(onMove)
      chart.remove()
    }
  }, [panes, vars])

  const shown = hover.time ? hover.values : lastValues
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
      <div ref={host} style={{ height }} className="w-full" />
    </div>
  )
}
