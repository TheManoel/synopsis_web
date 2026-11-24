import clsx from 'clsx'
import { ArrowDown, ArrowUp, Clock } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useInstrumentSeries, usePerformance, useSection, useSeriesMany } from '../lib/api'
import { DASH, fmtChange, fmtDate, fmtInUnit, fmtLevel, fmtNum, fmtPct } from '../lib/format'
import type { Change, Group, InstrumentCard, Kind } from '../lib/types'
import { RangeBar, Sparkline } from '../components/charts/Sparkline'
import { TimeChart, type PaneSpec } from '../components/charts/TimeChart'
import { Card, Delta, ErrorState, PageHeader, Pill, Segmented, Skeleton, Warnings } from '../components/ui'

const HORIZONS = ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y'] as const
type Horizon = (typeof HORIZONS)[number]
const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)']

const RANGES = [
  { value: 126, label: '6M' },
  { value: 252, label: '1A' },
  { value: 504, label: '2A' },
  { value: 1260, label: '5A' },
]
const CMP_RANGES = [
  { value: 21, label: '1M' },
  { value: 63, label: '3M' },
  { value: 126, label: '6M' },
  { value: 252, label: '1A' },
]

const changeOf = (c: InstrumentCard, h: string): Change | undefined => c.changes.find((x) => x.horizon === h)

/** Heat tint of a move: intensity scales with magnitude, sign also shown as text. */
function heat(value: number | null, kind: Kind): string | undefined {
  if (value == null) return undefined
  const scale = kind === 'yield' ? 40 : kind === 'spread' ? 15 : kind === 'level' ? 8 : 6 // bp / pts / %
  const a = Math.min(1, Math.abs(value) / scale) * 0.85
  if (a < 0.06) return undefined
  return `color-mix(in oklab, ${value > 0 ? 'var(--up)' : 'var(--down)'} ${Math.round(a * 30)}%, transparent)`
}

function TrendChip({ c }: { c: InstrumentCard }) {
  if (c.trend === 'unknown') return <span className="text-ink-3">{DASH}</span>
  const label = c.trend === 'up' ? 'Alcista' : c.trend === 'down' ? 'Bajista' : 'Mixta'
  const hint = `vs MA50 ${fmtInUnit(c.dist_sma50, c.kind)} · vs MA200 ${fmtInUnit(c.dist_sma200, c.kind)}`
  return (
    <Pill tone={c.trend === 'up' ? 'up' : c.trend === 'down' ? 'down' : 'neutral'} title={hint}>
      {c.trend === 'up' ? <ArrowUp size={11} /> : c.trend === 'down' ? <ArrowDown size={11} /> : null}
      {label}
    </Pill>
  )
}

function GroupTable({
  group,
  selected,
  onSelect,
  sortBy,
  onSort,
}: {
  group: Group
  selected: string | null
  onSelect: (key: string) => void
  sortBy: Horizon | null
  onSort: (h: Horizon | null) => void
}) {
  const rows = useMemo(() => {
    if (!sortBy) return group.cards
    return [...group.cards].sort((a, b) => (changeOf(b, sortBy)?.value ?? -Infinity) - (changeOf(a, sortBy)?.value ?? -Infinity))
  }, [group.cards, sortBy])

  return (
    <Card title={group.title} bodyClassName="px-0 pb-1 pt-2">
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[980px] text-[13px]">
          <thead>
            <tr className="text-[11px] text-ink-3">
              <th className="px-4 py-2 text-left font-medium">Instrumento</th>
              <th className="px-3 py-2 text-right font-medium">Último</th>
              {HORIZONS.map((h) => (
                <th key={h} className="px-1 py-2 text-right font-medium">
                  <button
                    onClick={() => onSort(sortBy === h ? null : h)}
                    className={clsx('rounded px-1.5 py-0.5 hover:text-ink', sortBy === h && 'bg-accent-soft text-accent')}
                    title={`Ordenar por ${h}`}
                  >
                    {h}
                  </button>
                </th>
              ))}
              <th className="px-3 py-2 text-left font-medium">Tendencia</th>
              <th className="px-3 py-2 text-left font-medium">Rango 52 semanas</th>
              <th className="px-3 py-2 text-right font-medium" title="Volatilidad realizada a 21 sesiones, anualizada">Vol 21d</th>
              <th className="px-4 py-2 text-right font-medium">6 meses</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr
                key={c.key}
                onClick={() => onSelect(c.key)}
                className={clsx(
                  'cursor-pointer border-t border-line transition-colors',
                  selected === c.key ? 'bg-accent-soft' : 'hover:bg-surface-2',
                )}
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{c.label}</span>
                    {c.session_in_progress && (
                      <span title="La sesión de esta barra aún no ha cerrado" className="text-warn">
                        <Clock size={12} aria-label="Sesión en curso" />
                      </span>
                    )}
                    {c.warnings.length > 0 && <Pill tone="warn" title={c.warnings.join(' · ')}>aviso</Pill>}
                  </div>
                  {c.note && <div className="mt-0.5 max-w-[260px] truncate text-[11px] text-ink-3" title={c.note}>{c.note}</div>}
                </td>
                <td className="num px-3 py-2.5 text-right font-medium text-ink">{fmtLevel(c.last, c.kind)}</td>
                {HORIZONS.map((h) => {
                  const ch = changeOf(c, h)
                  return (
                    <td key={h} className="px-1 py-1.5 text-right">
                      <span
                        className="num inline-block min-w-[64px] rounded-md px-1.5 py-1 text-[12px]"
                        style={{ background: heat(ch?.value ?? null, c.kind) }}
                      >
                        <span className={clsx(ch?.value == null ? 'text-ink-3' : ch.value > 0 ? 'text-up' : ch.value < 0 ? 'text-down' : 'text-ink-2')}>
                          {fmtChange(ch, c.kind)}
                        </span>
                      </span>
                    </td>
                  )
                })}
                <td className="px-3 py-2.5">
                  <TrendChip c={c} />
                </td>
                <td className="px-3 py-2.5">
                  <RangeBar
                    position={c.range_position}
                    low={fmtLevel(c.low_52w, c.kind)}
                    high={fmtLevel(c.high_52w, c.kind)}
                    fmt={`Desde máximo de 52 semanas: ${fmtInUnit(c.from_high, c.kind)}`}
                  />
                </td>
                <td className="num px-3 py-2.5 text-right text-ink-2">
                  {c.realized_vol_21d == null ? DASH : `${fmtNum(c.realized_vol_21d, 1)}%`}
                </td>
                <td className="px-4 py-1.5 text-right">
                  <div className="inline-block">
                    <Sparkline values={c.spark} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function FocusChart({ card }: { card: InstrumentCard }) {
  const [bars, setBars] = useState(252)
  const q = useInstrumentSeries(card.key, bars)
  const fmt = (v: number) => fmtLevel(v, card.kind)
  const panes = useMemo<PaneSpec[]>(() => {
    const s = q.data
    if (!s) return []
    const price =
      s.has_ohlc
        ? {
            type: 'candles' as const, id: 'px', label: s.label, format: fmt,
            data: s.bars.filter((b) => b.open != null).map((b) => ({ time: b.time, open: b.open!, high: b.high!, low: b.low!, close: b.close })),
          }
        : { type: 'line' as const, id: 'px', label: s.label, color: 'var(--ink-2)', format: fmt, data: s.bars.map((b) => ({ time: b.time, value: b.close })) }
    return [
      {
        series: [
          price,
          { type: 'line', id: 'sma50', label: 'MA50', color: 'var(--s1)', width: 1, format: fmt, data: s.sma50 },
          { type: 'line', id: 'sma200', label: 'MA200', color: 'var(--s2)', width: 1, format: fmt, data: s.sma200 },
        ],
      },
    ]
  }, [q.data]) // eslint-disable-line react-hooks/exhaustive-deps

  const d1 = changeOf(card, '1D')
  return (
    <Card
      className="min-w-0"
      title={
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[15px]">{card.label}</span>
          <span className="num text-[15px] font-semibold">{fmtLevel(card.last, card.kind)}</span>
          <Delta value={d1?.value} text={fmtChange(d1, card.kind)} className="text-xs" />
        </div>
      }
      subtitle={
        <span className="inline-flex items-center gap-2">
          Cierre {fmtDate(card.as_of)}
          {card.session_in_progress && (
            <Pill tone="warn">
              <Clock size={11} /> Sesión en curso
            </Pill>
          )}
          {card.is_ratio && <Pill tone="accent">Ratio</Pill>}
        </span>
      }
      actions={<Segmented size="sm" label="Rango" value={bars} options={RANGES} onChange={setBars} />}
    >
      {q.error ? (
        <ErrorState error={q.error} />
      ) : !q.data ? (
        <Skeleton className="h-[380px]" />
      ) : (
        <div className={clsx(q.isPlaceholderData && 'is-stale')}>
          <TimeChart panes={panes} height={360} />
          <Warnings items={q.data.warnings} className="mt-3" />
        </div>
      )}
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 text-xs sm:grid-cols-5">
        {[
          ['Máx. 52s', fmtLevel(card.high_52w, card.kind)],
          ['Mín. 52s', fmtLevel(card.low_52w, card.kind)],
          ['Desde máximo 52s', fmtInUnit(card.from_high, card.kind)],
          ['vs MA50 / MA200', `${fmtInUnit(card.dist_sma50, card.kind)} / ${fmtInUnit(card.dist_sma200, card.kind)}`],
          ['Vol. realizada 21d', card.realized_vol_21d == null ? DASH : `${fmtNum(card.realized_vol_21d, 1)}%`],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-ink-3">{k}</dt>
            <dd className="num mt-0.5 font-medium text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

function ComparePanel({ section, group }: { section: string; group: Group }) {
  const [bars, setBars] = useState(126)
  const q = usePerformance(section, group.code, bars)
  const colorOf = (key: string) => SERIES[group.cards.findIndex((c) => c.key === key) % SERIES.length]
  const panes = useMemo<PaneSpec[]>(() => {
    if (!q.data) return []
    return [
      {
        levels: [{ value: 100, label: '' }],
        series: q.data.lines.map((l) => ({
          type: 'line' as const, id: l.key, label: l.label, color: colorOf(l.key), width: 2 as const,
          format: (v: number) => fmtNum(v, 1), data: l.points,
        })),
      },
    ]
  }, [q.data]) // eslint-disable-line react-hooks/exhaustive-deps
  const ranking = [...(q.data?.lines ?? [])].sort((a, b) => (b.total_return_pct ?? 0) - (a.total_return_pct ?? 0))

  return (
    <Card
      title={`Rendimiento relativo · ${group.title}`}
      subtitle={q.data?.start ? `Base 100 el ${fmtDate(q.data.start)}` : 'Base 100'}
      actions={<Segmented size="sm" label="Ventana" value={bars} options={CMP_RANGES} onChange={setBars} />}
    >
      {q.error ? (
        <ErrorState error={q.error} />
      ) : !q.data ? (
        <Skeleton className="h-[300px]" />
      ) : (
        <div className={clsx(q.isPlaceholderData && 'is-stale')}>
          <TimeChart panes={panes} height={240} />
          <ol className="mt-3 space-y-1.5 border-t border-line pt-3">
            {ranking.map((l, i) => (
              <li key={l.key} className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-2 text-ink-2">
                  <span className="num w-4 text-ink-3">{i + 1}</span>
                  <span className="h-[3px] w-3 rounded-full" style={{ background: colorOf(l.key) }} />
                  {l.label}
                </span>
                <Delta value={l.total_return_pct} text={fmtPct(l.total_return_pct)} />
              </li>
            ))}
          </ol>
          <Warnings items={q.data.warnings} className="mt-3" />
        </div>
      )}
    </Card>
  )
}

/** Levels on one axis — only for groups whose members share a unit
 *  (Treasury yields in %, curve slopes in bp). */
function LevelsPanel({ group }: { group: Group }) {
  const [bars, setBars] = useState(252)
  const kind = group.cards[0].kind
  const results = useSeriesMany(group.cards.map((c) => c.key), bars)
  const ready = results.every((r) => r.data)
  const stamp = results.map((r) => r.dataUpdatedAt).join()
  const panes = useMemo<PaneSpec[]>(() => {
    if (!ready) return []
    return [
      {
        levels: kind === 'spread' ? [{ value: 0, label: '' }] : undefined,
        series: results.map((r, i) => ({
          type: 'line' as const, id: r.data!.key, label: r.data!.label, color: SERIES[i], width: 2 as const,
          format: (v: number) => fmtLevel(v, kind), data: r.data!.bars.map((b) => ({ time: b.time, value: b.close })),
        })),
      },
    ]
  }, [ready, stamp]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Card
      title={`Niveles · ${group.title}`}
      subtitle={kind === 'spread' ? 'Diferencial en puntos básicos, mismo eje' : 'Rentabilidad en %, mismo eje'}
      actions={<Segmented size="sm" label="Ventana" value={bars} options={RANGES} onChange={setBars} />}
    >
      {!ready ? <Skeleton className="h-[300px]" /> : <TimeChart panes={panes} height={280} />}
    </Card>
  )
}

export function MarketSectionPage({ section }: { section: string }) {
  const q = useSection(section)
  const [selected, setSelected] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<Horizon | null>(null)

  const cards = q.data?.groups.flatMap((g) => g.cards) ?? []
  const focus = cards.find((c) => c.key === selected) ?? cards[0]
  const focusGroup = q.data?.groups.find((g) => g.cards.some((c) => c.key === focus?.key))
  const asOf = cards.map((c) => c.as_of).filter(Boolean).sort().at(-1) ?? null

  const side =
    focusGroup && focusGroup.comparable && focusGroup.cards.length > 1 ? (
      <ComparePanel section={section} group={focusGroup} />
    ) : focusGroup &&
      focusGroup.cards.length > 1 &&
      focusGroup.cards.every((c) => c.kind === focusGroup.cards[0].kind && (c.kind === 'yield' || c.kind === 'spread')) ? (
      <LevelsPanel group={focusGroup} />
    ) : null

  return (
    <div>
      <PageHeader eyebrow="Estudio de mercados" title={q.data?.title ?? ' '} subtitle={q.data?.subtitle}>
        {asOf && <span className="text-xs text-ink-3">Último cierre {fmtDate(asOf)}</span>}
      </PageHeader>

      {q.error ? (
        <ErrorState error={q.error} />
      ) : !q.data || !focus ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <Skeleton className="h-[460px] xl:col-span-2" />
          <Skeleton className="h-[460px]" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className={clsx('grid gap-4', side && 'xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]')}>
            <FocusChart key={focus.key} card={focus} />
            {side}
          </div>
          {q.data.groups.map((g) => (
            <GroupTable key={g.code} group={g} selected={focus.key} onSelect={setSelected} sortBy={sortBy} onSort={setSortBy} />
          ))}
          <p className="text-[11px] text-ink-3">
            Variaciones en % para precios, en puntos básicos (pb) para rentabilidades y diferenciales, y en puntos para niveles de volatilidad.
            Horizontes en sesiones: 1W=5, 1M=21, 3M=63, 6M=126, 1Y=252.
          </p>
        </div>
      )}
    </div>
  )
}
