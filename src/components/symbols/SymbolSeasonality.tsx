import { useMemo, useState } from 'react'
import { useSeasonality } from '../../lib/api'
import { fmtDate, fmtPct } from '../../lib/format'
import type { CycleStudy } from '../../lib/types'
import { TimeChart, type PaneSpec } from '../charts/TimeChart'
import { Card, ErrorState, Segmented, Skeleton, Stat, Warnings } from '../ui'

type Reading = CycleStudy['reading']

const READINGS: { value: Reading; label: string; hint: string }[] = [
  { value: 'raw', label: 'Con tendencia', hint: 'La media de los tramos tal cual, con su deriva' },
  { value: 'detrended', label: 'Solo la forma', hint: 'A cada tramo se le quita la recta de su inicio a su fin antes de promediar' },
]

function StudyCard({ s }: { s: CycleStudy }) {
  const [reading, setReading] = useState<Reading>(s.reading)
  const mean = reading === 'raw' ? s.mean_pct : s.mean_detrended_pct
  const tramo = s.current // («current» reads as a ref to the React compiler)
  const panes = useMemo<PaneSpec[]>(() => {
    const lines = [
      ...s.marks.map((m) => ({ time: m.time, color: 'var(--ink-3)', up: true, strong: false, text: m.label, arrow: false })),
      ...(s.projected_from ? [{ time: s.projected_from, color: 'var(--ink-3)', up: true, strong: false, text: 'hoy', arrow: false }] : []),
    ]
    const meanSeries = {
      type: 'line' as const, id: 'mean', label: `Media (${s.segments.length} tramos)`, color: 'var(--s1)', width: 2 as const,
      format: (v: number) => fmtPct(v, 1), data: s.axis.map((t, i) => ({ time: t, value: mean[i] })),
    }
    const currentSeries = {
      type: 'line' as const, id: 'current', label: `Tramo actual (desde ${fmtDate(tramo.start)})`, color: 'var(--s2)', width: 2 as const,
      format: (v: number) => fmtPct(v, 1), data: s.axis.map((t, i) => ({ time: t, value: s.current_pct[i] })),
    }
    const zero = [{ value: 0, color: 'var(--axis)' }]
    // With its drift the mean is comparable to the current stretch on one scale; the
    // shape alone spans a few % and would read flat there, so it gets its own pane.
    if (reading === 'raw') return [{ series: [meanSeries, currentSeries], levels: zero, futureEvents: lines }]
    return [
      { series: [currentSeries], levels: zero, futureEvents: lines, stretch: 1 },
      { title: 'Forma media', series: [meanSeries], levels: zero, futureEvents: lines, stretch: 1 },
    ]
  }, [s, tramo, mean, reading])
  const notes = useMemo(() => Object.fromEntries(s.marks.map((m) => [m.time, m.label])), [s.marks])
  return (
    <Card
      title={`${s.label} · ${s.period_label}`}
      subtitle={s.description}
      actions={<Segmented size="sm" label="Lectura" value={reading} options={READINGS} onChange={setReading} />}
    >
      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <Stat label="Fase actual" value={s.phase ?? `${Math.round(s.position * 100)} % del ciclo`} />
        <Stat label="Lo siguiente" value={s.next_mark ?? fmtDate(s.current.end)} />
        <Stat
          label="De aquí al final, en los tramos completos"
          value={s.ahead_mean_pct == null ? '—' : `${fmtPct(s.ahead_mean_pct, 1)} · ${s.ahead_positive}/${s.ahead_total} al alza`}
        />
      </div>
      <TimeChart panes={panes} height={reading === 'raw' ? 300 : 380} notes={s.marks.length ? notes : undefined} rangeKey={`${s.id}|${s.current.start}`} />
      <p className="mt-2 text-xs text-ink-2">{s.summary}</p>
      <p className="mt-1 text-[11px] text-ink-3">
        En % desde el primer cierre del tramo. La media se dibuja en el eje del tramo actual (sus sesiones y, tras «hoy», los días laborables que
        le quedan). Fuente del ciclo: {s.source}.
      </p>
      <Warnings items={s.warnings} className="mt-2" />
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-ink-2">Tramos completos ({s.segments.length})</summary>
        <table className="num mt-2 w-full max-w-md text-[11px]">
          <thead className="text-ink-3">
            <tr>
              <th className="text-left font-medium">Inicio</th>
              <th className="text-left font-medium">Fin</th>
              <th className="text-right font-medium">Rentabilidad</th>
            </tr>
          </thead>
          <tbody>
            {[...s.segments].reverse().map((g) => (
              <tr key={g.start} className="border-t border-line">
                <td className="py-0.5">{fmtDate(g.start)}</td>
                <td>{fmtDate(g.end)}</td>
                <td className={`text-right ${g.total_pct >= 0 ? 'text-up' : 'text-down'}`}>{fmtPct(g.total_pct, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Card>
  )
}

/** The seasonality study of an asset: its history folded by each calendar cycle. */
export function SymbolSeasonality({ symbolKey }: { symbolKey: string }) {
  const q = useSeasonality(symbolKey)
  if (q.error) return <ErrorState error={q.error} />
  if (!q.data) return <Skeleton className="h-[480px]" />
  return (
    <div className="space-y-5">
      <Warnings items={q.data.warnings} />
      {q.data.studies.map((s) => (
        <StudyCard key={s.id} s={s} />
      ))}
    </div>
  )
}
