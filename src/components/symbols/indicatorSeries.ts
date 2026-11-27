import { fmtUnit } from '../../lib/format'
import { seriesColor } from '../../lib/theme'
import type { IndicatorSeries } from '../../lib/types'
import type { SeriesSpec } from '../charts/TimeChart'

/** Lines of an indicator, coloured by the rules of the design system: an
 * overlay is one entity (its slot's colour, bands dashed); a pane's outputs take
 * the series order, histograms carry the sign. */
export function indicatorSeries(ind: IndicatorSeries, slot: number, candleUp: Map<string, boolean>): SeriesSpec[] {
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
