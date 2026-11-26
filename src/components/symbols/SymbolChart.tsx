import { CalendarClock, CandlestickChart, LineChart, Sigma } from 'lucide-react'
import { useMemo } from 'react'
import { ApiError, useIndicatorSeries, useSymbolChart, useSymbolOptionLevels, useSymbolTiming } from '../../lib/api'
import { type ChartPrefs, useChartPrefs } from '../../lib/chartPrefs'
import { fmtLevel, fmtUnit } from '../../lib/format'
import { seriesColor } from '../../lib/theme'
import type { IndicatorCatalog, IndicatorSeries } from '../../lib/types'
import { TimeChart, type Marker, type PaneSpec, type SeriesSpec } from '../charts/TimeChart'
import { Card, ErrorState, Segmented, Skeleton, Warnings } from '../ui'
import { IndicatorBar, type ChipState } from './IndicatorPicker'
import { OptionLevelsPanel } from './OptionLevelsPanel'
import { LEVEL_COLOR } from './optionLevelColors'
import { TimingPanel } from './TimingPanel'
import { timingOverlay, visibleSignals } from './timingOverlay'

const TOGGLE = 'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium'

/** Lines of an indicator, coloured by the rules of the design system: an
 * overlay is one entity (its slot's colour, bands dashed); a pane's outputs take
 * the series order, histograms carry the sign. */
function indicatorSeries(ind: IndicatorSeries, slot: number, candleUp: Map<string, boolean>): SeriesSpec[] {
  const fmt = (v: number) => fmtUnit(v, ind.unit)
  const multi = ind.lines.length > 1
  let lineIdx = 0
  return ind.lines.map((line) => {
    const id = `${ind.spec}|${line.key}`
    // «Volumen 50 · Volumen» says it twice: an output named like its indicator is just its name.
    const label = !multi ? ind.label : ind.label.toLowerCase().startsWith(line.label.toLowerCase()) ? line.label : `${ind.label} · ${line.label}`
    if (line.style === 'histogram') {
      const isVolume = ind.id === 'volume'
      return {
        type: 'histogram',
        id,
        label,
        format: fmt,
        color: isVolume ? 'var(--up-vol)' : 'var(--up)',
        negativeColor: isVolume ? 'var(--down-vol)' : 'var(--down)',
        data: ind.dates.map((t, i) => ({
          time: t,
          value: line.values[i],
          color: isVolume ? (candleUp.get(t) === false ? 'var(--down-vol)' : 'var(--up-vol)') : undefined,
        })),
      }
    }
    const color = ind.placement === 'overlay' ? seriesColor(slot) : seriesColor(lineIdx++)
    return {
      type: 'line',
      id,
      label,
      color,
      width: ind.placement === 'overlay' ? (line.style === 'dashed' ? 1 : 2) : line.style === 'dashed' ? 1 : 2,
      dashed: line.style === 'dashed',
      format: fmt,
      data: ind.dates.map((t, i) => ({ time: t, value: line.values[i] })),
    }
  })
}

export function SymbolChart({ symbolKey, catalog }: { symbolKey: string; catalog: IndicatorCatalog }) {
  const { prefs, update, add, replace, remove, reset } = useChartPrefs(catalog.default_specs)
  if (!prefs) return <Skeleton className="h-[640px]" />
  return (
    <ChartBody
      symbolKey={symbolKey}
      catalog={catalog}
      prefs={prefs}
      update={update}
      add={add}
      replace={replace}
      remove={remove}
      reset={() => reset(catalog.default_specs)}
    />
  )
}

function ChartBody({
  symbolKey,
  catalog,
  prefs,
  update,
  add,
  replace,
  remove,
  reset,
}: {
  symbolKey: string
  catalog: IndicatorCatalog
  prefs: ChartPrefs
  update: (p: Partial<ChartPrefs>) => void
  add: (spec: string) => void
  replace: (uid: string, spec: string) => void
  remove: (uid: string) => void
  reset: () => void
}) {
  const { timeframe, range, style, log, indicators } = prefs
  const timingMode = prefs.timing ?? 'off'
  const chart = useSymbolChart(symbolKey, timeframe, range)
  // Always asked (cheap when the asset is in no block): it says whether to offer the toggle.
  const timingQuery = useSymbolTiming(symbolKey, timeframe, range, true)
  const timing = timingQuery.data && !timingQuery.isPlaceholderData && timingQuery.data.key === symbolKey ? timingQuery.data : undefined
  const timingOn = timingMode !== 'off' && !!timing?.applies
  const timingSignals = useMemo(() => visibleSignals(timing, timingOn ? timingMode : 'off'), [timing, timingOn, timingMode])
  const lastBar = chart.data?.dates.length ? { time: chart.data.dates[chart.data.dates.length - 1], close: chart.data.close[chart.data.close.length - 1] } : undefined
  const lastKey = lastBar ? `${lastBar.time}:${lastBar.close}` : ''
  // lastKey stands for lastBar (a new object each render).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const overlay = useMemo(() => timingOverlay(timingSignals, lastBar), [timingSignals, lastKey])
  const optionsQuery = useSymbolOptionLevels(symbolKey)
  const optionLevels = optionsQuery.data?.key === symbolKey ? optionsQuery.data : undefined
  const optionsOn = !!prefs.options && !!optionLevels?.applies
  const specs = indicators.map((i) => i.spec)
  const results = useIndicatorSeries(symbolKey, timeframe, range, specs)
  const data = chart.data

  // Keyed by the data actually received, so a stale result never paints on new bars.
  const current = !!data && data.key === symbolKey && data.timeframe === timeframe && data.range === range
  const ready = results.map((r) => (r.data && current && r.data.dates[0] === data.dates[0] ? r.data : null))
  const readyKey = ready.map((r, i) => (r ? `${r.spec}@${indicators[i].slot}@${r.dates.length}` : '-')).join('|')

  const panes = useMemo<PaneSpec[]>(() => {
    if (!data) return []
    const candleUp = new Map(data.dates.map((t, i) => [t, data.close[i] >= data.open[i]]))
    const markers: Marker[] = [
      ...data.events.map((e): Marker => ({
        time: e.time, position: 'belowBar', shape: 'circle', color: 'var(--accent)', text: e.label,
      })),
      ...overlay.markers,
    ].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0))
    const whitespace = timingOn ? timing!.future_dates : undefined
    const price: SeriesSpec =
      style === 'candles' && data.has_ohlc
        ? {
            type: 'candles', id: 'price', label: data.label, format: (v) => fmtLevel(v), markers, whitespace,
            data: data.dates.map((t, i) => ({ time: t, open: data.open[i], high: data.high[i], low: data.low[i], close: data.close[i] })),
          }
        : {
            type: 'line', id: 'price', label: data.label, color: 'var(--ink-2)', width: 2, format: (v) => fmtLevel(v), markers, whitespace,
            data: data.dates.map((t, i) => ({ time: t, value: data.close[i] })),
          }
    const pricePane: PaneSpec = {
      series: [price], stretch: 3, logScale: log, futureEvents: timingOn ? overlay.future : undefined,
      levels: optionsOn
        ? optionLevels!.levels.map((l) => ({
            value: l.value, label: l.label, color: LEVEL_COLOR[l.kind], title: !l.kind.endsWith('_lo'), dashed: l.kind.startsWith('em_'),
          }))
        : undefined,
    }
    const lower: PaneSpec[] = []
    ready.forEach((ind, i) => {
      if (!ind) return
      const series = indicatorSeries(ind, indicators[i].slot, candleUp)
      if (ind.placement === 'overlay') pricePane.series.push(...series)
      else lower.push({ series, stretch: 1, levels: ind.levels.map((v) => ({ value: v, color: 'var(--axis)' })) })
    })
    return [pricePane, ...lower]
    // readyKey stands for `ready` (a new array each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, readyKey, style, log, overlay, timingOn, timing, optionsOn, optionLevels])

  const notes = useMemo(() => {
    const lines: Record<string, string[]> = {}
    for (const e of data?.events ?? []) (lines[e.time] ??= []).push(e.text)
    for (const [t, texts] of Object.entries(overlay.notes)) (lines[t] ??= []).push(...texts)
    return Object.fromEntries(Object.entries(lines).map(([t, l]) => [t, l.join('\n')]))
  }, [data, overlay])
  const hasNotes = Object.keys(notes).length > 0

  const states: Record<string, ChipState> = {}
  indicators.forEach((ind, i) => {
    const r = results[i]
    const def = catalog.groups.flatMap((g) => g.indicators).find((d) => d.id === ind.spec.split(':')[0])
    states[ind.uid] = {
      label: r.data?.label ?? ind.spec,
      loading: r.isFetching,
      error: r.error ? (r.error instanceof ApiError ? r.error.message : String(r.error)) : null,
      color: def?.placement === 'overlay' ? seriesColor(ind.slot) : null,
    }
  })
  const warnings = [
    ...(data?.warnings ?? []),
    ...ready.flatMap((r) => (r ? r.warnings.map((w) => `${r.label}: ${w}`) : [])),
    ...(timingOn ? timing!.warnings.map((w) => `McClellan: ${w}`) : []),
    ...(optionsOn ? optionLevels!.warnings.map((w) => `Opciones: ${w}`) : []),
    ...(optionsQuery.error && prefs.options ? [`Opciones: ${optionsQuery.error instanceof ApiError ? optionsQuery.error.message : String(optionsQuery.error)}`] : []),
    ...(timingQuery.error && timingMode !== 'off' ? [`McClellan: ${timingQuery.error instanceof ApiError ? timingQuery.error.message : String(timingQuery.error)}`] : []),
  ]
  const paneCount = panes.length

  return (
    <Card
      title="Gráfico"
      subtitle="Arrastra para desplazarte y usa la rueda para acercarte; los separadores de panel se pueden mover."
      actions={
        <>
          <Segmented size="sm" label="Marco temporal" value={timeframe} options={catalog.timeframes.map((t) => ({ value: t.value as ChartPrefs['timeframe'], label: t.label }))} onChange={(v) => update({ timeframe: v })} />
          <Segmented size="sm" label="Ventana" value={range} options={catalog.ranges} onChange={(v) => update({ range: v })} />
          <button
            onClick={() => update({ style: style === 'candles' ? 'line' : 'candles' })}
            className={`${TOGGLE} border-line bg-surface-2 text-ink-2 hover:text-ink`}
            title={style === 'candles' ? 'Ver como línea de cierre' : 'Ver como velas'}
          >
            {style === 'candles' ? <CandlestickChart size={13} /> : <LineChart size={13} />}
            {style === 'candles' ? 'Velas' : 'Línea'}
          </button>
          <button
            onClick={() => update({ log: !log })}
            aria-pressed={log}
            className={`${TOGGLE} ${log ? 'border-accent/50 bg-accent-soft text-ink' : 'border-line bg-surface-2 text-ink-2 hover:text-ink'}`}
            title="Escala logarítmica en el precio: movimientos iguales en % ocupan lo mismo"
          >
            Log
          </button>
          {optionLevels?.applies && (
            <button
              onClick={() => update({ options: !optionsOn })}
              aria-pressed={optionsOn}
              className={`${TOGGLE} ${optionsOn ? 'border-accent/50 bg-accent-soft text-ink' : 'border-line bg-surface-2 text-ink-2 hover:text-ink'}`}
              title="Niveles de la cadena de opciones: muros de calls y puts, gamma flip, max pain y movimiento implícito"
            >
              <Sigma size={13} />
              Opciones
            </button>
          )}
          {timing?.applies && (
            <button
              onClick={() => update({ timing: timingOn ? 'off' : 'all' })}
              aria-pressed={timingOn}
              className={`${TOGGLE} ${timingOn ? 'border-accent/50 bg-accent-soft text-ink' : 'border-line bg-surface-2 text-ink-2 hover:text-ink'}`}
              title="Fechas de giro previstas por los Timing Models del McClellan Market Report"
            >
              <CalendarClock size={13} />
              McClellan
            </button>
          )}
        </>
      }
    >
      <div className="mb-3">
        <IndicatorBar
          catalog={catalog}
          active={indicators}
          states={states}
          onAdd={add}
          onReplace={replace}
          onRemove={remove}
          onReset={reset}
        />
      </div>
      {chart.error && <ErrorState error={chart.error} />}
      {!data && chart.isLoading && <Skeleton className="h-[560px]" />}
      {data && (
        <div className={chart.isPlaceholderData ? 'is-stale' : undefined}>
          <TimeChart
            panes={panes}
            height={380 + Math.max(0, paneCount - 1) * 120}
            rangeKey={`${symbolKey}|${timeframe}|${range}|${timingOn ? 'timing' : ''}`}
            notes={hasNotes ? notes : undefined}
            current
            live={data.live}
          />
          <Warnings items={[...new Set(warnings)]} className="mt-3" />
          {data.events.length > 0 && (
            <p className="mt-2 text-[11px] text-ink-3">
              <span className="font-semibold text-accent">R</span> = publicación de resultados (en la primera sesión tras el anuncio); pasa el cursor por ella para ver el BPA y la sorpresa.
            </p>
          )}
          {optionsOn && optionLevels && <OptionLevelsPanel data={optionLevels} />}
          {timingOn && timing && (
            <TimingPanel timing={timing} mode={timingMode === 'strong' ? 'strong' : 'all'} onMode={(m) => update({ timing: m })} />
          )}
        </div>
      )}
    </Card>
  )
}
