import { ExternalLink } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { useIndicatorSeries, useSymbolChart } from '../../lib/api'
import { fmtDate, fmtLevel } from '../../lib/format'
import { symbolPath } from '../../lib/symbolNav'
import { TimeChart, type PaneSpec } from '../charts/TimeChart'
import { indicatorSeries } from '../symbols/indicatorSeries'
import { ErrorState, Skeleton, Warnings } from '../ui'

/** Fixed reading of the preview: daily candles, the two trend averages, volume. */
const TIMEFRAME = 'd'
const RANGE = '1y'
const SPECS = ['sma:50', 'sma:200', 'volume:50']

/**
 * A quick look at a member's price without leaving the table: one year of daily
 * candles with the 50- and 200-session averages and volume (all from the core,
 * with their warm-up). The full chart — other windows, indicators — is one
 * click away in Símbolos. The chart ends today; when the board is a past bar,
 * that bar is marked so the reader sees what came after it.
 */
export function PricePreview({ symbolKey, label, barDate }: { symbolKey: string; label: string; barDate?: string | null }) {
  const chart = useSymbolChart(symbolKey, TIMEFRAME, RANGE)
  const results = useIndicatorSeries(symbolKey, TIMEFRAME, RANGE, SPECS)
  const data = chart.data?.key === symbolKey ? chart.data : undefined
  const ready = results.map((r) => (r.data && data && r.data.dates[0] === data.dates[0] ? r.data : null))
  const readyKey = ready.map((r) => (r ? `${r.spec}@${r.dates.length}` : '-')).join('|')

  const panes = useMemo<PaneSpec[]>(() => {
    if (!data) return []
    const candleUp = new Map(data.dates.map((t, i) => [t, data.close[i] >= data.open[i]]))
    const price: PaneSpec = {
      stretch: 3,
      futureEvents: barDate && data.dates.includes(barDate)
        ? [{ time: barDate, color: 'var(--accent)', up: true, strong: false, arrow: false, text: 'Barra RS' }]
        : undefined,
      series: [
        data.has_ohlc
          ? {
              type: 'candles', id: 'price', label: data.label, format: (v) => fmtLevel(v),
              data: data.dates.map((t, i) => ({ time: t, open: data.open[i], high: data.high[i], low: data.low[i], close: data.close[i] })),
            }
          : {
              type: 'line', id: 'price', label: data.label, color: 'var(--ink-2)', width: 2, format: (v) => fmtLevel(v),
              data: data.dates.map((t, i) => ({ time: t, value: data.close[i] })),
            },
      ],
    }
    const lower: PaneSpec[] = []
    ready.forEach((ind, i) => {
      if (!ind) return
      const series = indicatorSeries(ind, i, candleUp)
      if (ind.placement === 'overlay') price.series.push(...series)
      else lower.push({ series, stretch: 1 })
    })
    return [price, ...lower]
    // readyKey stands for `ready` (a new array each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, readyKey, barDate])

  const errors = results.flatMap((r, i) => (r.error ? [`${SPECS[i]}: ${r.error instanceof Error ? r.error.message : String(r.error)}`] : []))
  const warnings = [...(data?.warnings ?? []), ...ready.flatMap((r) => (r ? r.warnings.map((w) => `${r.label}: ${w}`) : [])), ...errors]

  return (
    <div className="border-t border-line bg-surface-2/40 px-4 py-3">
      <div className="mb-2 flex flex-wrap items-center gap-3 text-[11px] text-ink-3">
        <span className="font-semibold text-ink-2">{label}</span>
        <span>Diario · 1 año · medias de 50 y 200 sesiones · volumen</span>
        {barDate && data && !data.dates.includes(barDate) && <span>La barra del {fmtDate(barDate)} queda fuera de la ventana</span>}
        <Link to={symbolPath(symbolKey)} className="ml-auto inline-flex items-center gap-1 font-medium text-accent hover:underline">
          Abrir en Símbolos <ExternalLink size={12} />
        </Link>
      </div>
      {chart.error && <ErrorState error={chart.error} />}
      {!data && chart.isLoading && <Skeleton className="h-[340px]" />}
      {data && <TimeChart panes={panes} height={340} rangeKey={symbolKey} current live={data.live} />}
      <Warnings items={[...new Set(warnings)]} className="mt-2" />
    </div>
  )
}
