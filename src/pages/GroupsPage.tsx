import clsx from 'clsx'
import { ArrowRight, Clock, Pause, Play, RotateCcw, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { RotationMap, type MapGroup } from '../components/charts/RotationMap'
import { TimeChart, type PaneSpec } from '../components/charts/TimeChart'
import { Card, Delta, ErrorState, InfoTip, PageHeader, Pill, Segmented, Skeleton, Warnings } from '../components/ui'
import { useInstrumentSeries, useParticipation, useRelativeLine, useRotationBoard, useRotationUniverses } from '../lib/api'
import { DASH, fmtDate, fmtLevel, fmtNum, fmtPct, fmtShortDate, fmtSigned } from '../lib/format'
import {
  QUADRANT_COLOR,
  QUADRANT_HINT,
  QUADRANT_LABEL,
  QUADRANT_TONE,
  QUADRANTS,
  barUnit,
  barUnitShort,
  headingLabel,
} from '../lib/rotation'
import type { ParticipationLens, Quadrant, RotationBoard, RotationGroup, Timeframe } from '../lib/types'

const SHORT_TITLE: Record<string, string> = {
  us_sectors: 'Sectores EE. UU.',
  us_industries: 'Industrias EE. UU.',
  eu_sectors: 'Sectores Europa',
  eu_industries: 'Industrias Europa',
  us_themes: 'Temáticas',
}

const TIMEFRAMES: { value: Timeframe; label: string; hint: string }[] = [
  { value: 'weekly', label: 'Semanal', hint: 'Timeframe canónico del RRG: menos giros en falso' },
  { value: 'daily', label: 'Diario', hint: 'Zoom táctico: reacciona antes y gira más a menudo' },
]
const TAILS: Record<Timeframe, { value: number; label: string }[]> = {
  weekly: [{ value: 4, label: '4' }, { value: 8, label: '8' }, { value: 13, label: '13' }],
  daily: [{ value: 5, label: '5' }, { value: 10, label: '10' }, { value: 20, label: '20' }],
}
const HORIZONS = ['1W', '1M', '3M', '6M', 'YTD', '1Y'] as const
const fmtPp = (v: number | null | undefined) => fmtSigned(v, 1, ' pp')
const QUADRANT_RANK: Record<Quadrant, number> = { Leading: 0, Weakening: 1, Lagging: 2, Improving: 3 }

/** Tint by magnitude (pp or %), sign also carried by the text. */
function heat(v: number | null | undefined, scale = 10): string | undefined {
  if (v == null) return undefined
  const a = Math.min(1, Math.abs(v) / scale) * 0.85
  if (a < 0.06) return undefined
  return `color-mix(in oklab, ${v > 0 ? 'var(--up)' : 'var(--down)'} ${Math.round(a * 30)}%, transparent)`
}

// ---------------------------------------------------------------- atoms

function QuadrantPill({ q }: { q: Quadrant | null }) {
  if (!q) return <span className="text-ink-3">{DASH}</span>
  return (
    <Pill tone={QUADRANT_TONE[q]} title={QUADRANT_HINT[q]}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: QUADRANT_COLOR[q] }} aria-hidden />
      {QUADRANT_LABEL[q]}
    </Pill>
  )
}

/** Direction of the last bars on the RRG plane; the compass point is also written. */
function Heading({ deg }: { deg: number | null }) {
  if (deg == null) return <span className="text-ink-3">{DASH}</span>
  return (
    <span className="inline-flex items-center gap-1 text-ink-2" title={`Rumbo ${fmtNum(deg, 0)}° (0° = RS-Ratio al alza, 90° = RS-Momentum al alza)`}>
      <ArrowRight size={13} strokeWidth={2.25} style={{ transform: `rotate(${-deg}deg)` }} aria-hidden />
      <span className="num text-[11px]">{headingLabel(deg)}</span>
    </span>
  )
}

// ---------------------------------------------------------------- quadrant strip

function QuadrantStrip({ board, selected, onSelect }: { board: RotationBoard; selected: string | null; onSelect: (s: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {QUADRANTS.map((q) => {
        const members = board.groups
          .filter((g) => g.quadrant === q)
          .sort((a, b) => (b.distance ?? 0) - (a.distance ?? 0))
        return (
          <div key={q} className="card px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2" title={QUADRANT_HINT[q]}>
                <span className="h-2 w-2 rounded-full" style={{ background: QUADRANT_COLOR[q] }} aria-hidden />
                {QUADRANT_LABEL[q]}
              </span>
              <span className="num text-[22px] font-semibold leading-none tracking-tight">{board.quadrant_counts[q] ?? 0}</span>
            </div>
            <div className="mt-2.5 flex min-h-[24px] flex-wrap gap-1">
              {members.length === 0 && <span className="text-[11px] text-ink-3">Ningún grupo</span>}
              {members.map((g) => (
                <button
                  key={g.symbol}
                  onClick={() => onSelect(g.symbol)}
                  className={clsx(
                    'rounded-md px-1.5 py-0.5 text-[11px] transition-colors',
                    selected === g.symbol ? 'bg-accent-soft text-ink' : 'bg-surface-2 text-ink-2 hover:text-ink',
                  )}
                  title={`${g.label} · ${g.dwell_bars ?? '?'} ${barUnit(board.timeframe, g.dwell_bars ?? 0)} en el cuadrante`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------- RRG card

function MapCard({ board, selected, onSelect }: { board: RotationBoard; selected: string | null; onSelect: (s: string) => void }) {
  const [tail, setTail] = useState(TAILS[board.timeframe][1].value)
  const [cursor, setCursor] = useState(board.dates.length - 1)
  const [playing, setPlaying] = useState(false)
  const [labels, setLabels] = useState<'name' | 'ticker'>(
    // Full names only fit when there are few groups and room for them.
    board.groups.length > 12 || window.innerWidth < 640 ? 'ticker' : 'name',
  )
  const last = board.dates.length - 1
  const at = board.dates[Math.min(cursor, last)]

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      setCursor((c) => {
        if (c >= last) {
          setPlaying(false)
          return last
        }
        return c + 1
      })
    }, 320)
    return () => window.clearInterval(id)
  }, [playing, last])

  const play = () => {
    if (cursor >= last) setCursor(Math.min(tail, last))
    setPlaying((p) => !p)
  }

  const groups = useMemo<MapGroup[]>(
    () =>
      board.groups.map((g) => ({
        symbol: g.symbol,
        label: labels === 'ticker' ? g.symbol : g.label,
        points: g.trail.filter((p) => p.date <= at).slice(-tail),
      })),
    [board, at, tail, labels],
  )
  const whole = useMemo(() => board.groups.flatMap((g) => g.trail), [board])
  const visible = useMemo(() => groups.flatMap((g) => g.points), [groups])
  const domainPoints = playing ? whole : visible
  const unit = barUnitShort(board.timeframe)

  return (
    <Card
      className="min-w-0"
      title={
        <span className="inline-flex items-center gap-1.5">
          Gráfico de rotación relativa
          <InfoTip text={board.peer_note} />
        </span>
      }
      subtitle={`Frente a la cesta del resto de grupos · cola de ${tail} ${barUnit(board.timeframe, tail)}`}
      actions={
        <>
          <Segmented size="sm" label="Etiquetas" value={labels} onChange={setLabels}
            options={[{ value: 'name', label: 'Nombre' }, { value: 'ticker', label: 'Ticker' }]} />
          <Segmented size="sm" label={`Cola (${unit})`} value={tail} onChange={setTail} options={TAILS[board.timeframe].map((t) => ({ ...t, label: `${t.label} ${unit}` }))} />
        </>
      }
    >
      <RotationMap groups={groups} domainPoints={domainPoints} selected={selected} onSelect={onSelect} height={500} />
      <div className="mt-3 flex items-center gap-3 border-t border-line pt-3">
        <button
          onClick={play}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-surface-2 text-ink-2 hover:text-ink"
          aria-label={playing ? 'Pausar' : 'Reproducir la rotación'}
          title={playing ? 'Pausar' : 'Reproducir la rotación'}
        >
          {playing ? <Pause size={13} /> : <Play size={13} />}
        </button>
        <input
          type="range"
          min={0}
          max={last}
          value={Math.min(cursor, last)}
          onChange={(e) => {
            setPlaying(false)
            setCursor(+e.target.value)
          }}
          className="h-1 flex-1 cursor-pointer accent-[var(--accent)]"
          aria-label="Fecha del gráfico"
        />
        <span className="num shrink-0 whitespace-nowrap text-right text-xs text-ink-2">{fmtDate(at)}</span>
        <button
          onClick={() => {
            setPlaying(false)
            setCursor(last)
          }}
          disabled={cursor >= last}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-ink-3 hover:text-ink-2 disabled:opacity-40"
          title="Volver a la última barra"
        >
          <RotateCcw size={12} /> Último
        </button>
      </div>
      {cursor < last && (
        <p className="mt-2 text-[11px] text-ink-3">
          Mostrando la rotación al {fmtDate(at)}. La tabla y la lectura siguen en la última barra.
        </p>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------- reading of one group

function GroupReading({ board, group }: { board: RotationBoard; group: RotationGroup }) {
  const tf = board.timeframe
  const events = board.events.filter((e) => e.symbol === group.symbol).slice(0, 4)
  return (
    <Card
      className="min-w-0"
      title={
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[15px]">{group.label}</span>
          <span className="text-xs font-normal text-ink-3">{group.symbol}</span>
        </span>
      }
      subtitle={`Lectura al ${fmtDate(group.as_of)}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <QuadrantPill q={group.quadrant} />
        {group.dwell_bars != null && (
          <span className="text-xs text-ink-2">
            desde hace {group.dwell_bars} {barUnit(tf, group.dwell_bars)}
          </span>
        )}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
        {[
          ['RS-Ratio', fmtNum(group.ratio, 2), 'Fuerza relativa frente a la cesta; 100 = en línea'],
          ['RS-Momentum', fmtNum(group.momentum, 2), 'Ritmo al que cambia el RS-Ratio; >100 = ganando'],
          ['Rumbo', null, 'Dirección de las últimas 4 barras en el plano RRG'],
          ['Velocidad', fmtNum(group.velocity, 2), 'Paso medio por barra en las últimas 4 barras (puntos RRG)'],
        ].map(([k, v, hint]) => (
          <div key={k as string}>
            <dt className="flex items-center gap-1 text-ink-3">{k} <InfoTip text={hint as string} /></dt>
            <dd className="num mt-0.5 font-medium text-ink">{k === 'Rumbo' ? <Heading deg={group.heading_deg} /> : v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 border-t border-line pt-3">
        <div className="mb-1.5 text-xs text-ink-3">Frente al {board.benchmark_label}</div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[11px] text-ink-3">
              <th className="py-1 text-left font-medium" />
              <th className="py-1 text-right font-medium">Grupo</th>
              <th className="py-1 text-right font-medium">Índice</th>
              <th className="py-1 text-right font-medium">Exceso</th>
            </tr>
          </thead>
          <tbody>
            {group.excess.map((e) => (
              <tr key={e.horizon} className="border-t border-line">
                <td className="py-1.5 text-ink-2">{e.horizon}</td>
                <td className="num py-1.5 text-right text-ink-2">{fmtPct(e.group_pct, 1)}</td>
                <td className="num py-1.5 text-right text-ink-3">{fmtPct(e.bench_pct, 1)}</td>
                <td className="py-1.5 text-right">
                  <Delta value={e.excess_pp} text={fmtPp(e.excess_pp)} className="text-xs" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {events.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-1.5 text-xs text-ink-3">Últimos cambios de cuadrante</div>
          <ul className="space-y-1.5">
            {events.map((e) => (
              <li key={`${e.date}${e.to_quadrant}`} className="flex items-center gap-2 text-xs">
                <span className="num w-14 text-ink-3">{fmtShortDate(e.date)}</span>
                <span className="text-ink-2">{QUADRANT_LABEL[e.from_quadrant]}</span>
                <ArrowRight size={11} className="text-ink-3" aria-hidden />
                <span className="font-medium text-ink">{QUADRANT_LABEL[e.to_quadrant]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Warnings items={group.warnings} className="mt-3" />
    </Card>
  )
}

// ---------------------------------------------------------------- table

type SortKey = 'quadrant' | 'ratio' | 'momentum' | 'velocity' | (typeof HORIZONS)[number]

function SortHead({ k, label, hint, align = 'right', sort, onSort }: {
  k: SortKey
  label: string
  hint?: string
  align?: 'left' | 'right'
  sort: SortKey
  onSort: (k: SortKey) => void
}) {
  return (
    <th className={clsx('px-1 py-2 font-medium', align === 'right' ? 'text-right' : 'text-left')}>
      <button
        onClick={() => onSort(k)}
        className={clsx('rounded px-1.5 py-0.5 hover:text-ink', sort === k && 'bg-accent-soft text-accent')}
        title={hint ?? `Ordenar por ${label}`}
      >
        {label}
      </button>
    </th>
  )
}

function RotationTable({ board, selected, onSelect }: { board: RotationBoard; selected: string | null; onSelect: (s: string) => void }) {
  const [sort, setSort] = useState<SortKey>('quadrant')
  const [mode, setMode] = useState<'excess' | 'abs'>('excess')
  const tf = board.timeframe

  const valueOf = (g: RotationGroup, h: string) => {
    const e = g.excess.find((x) => x.horizon === h)
    return mode === 'excess' ? e?.excess_pp ?? null : e?.group_pct ?? null
  }
  const rows = useMemo(() => {
    const out = [...board.groups]
    const num = (v: number | null | undefined) => v ?? -Infinity
    if (sort === 'quadrant')
      out.sort((a, b) => (a.quadrant ? QUADRANT_RANK[a.quadrant] : 9) - (b.quadrant ? QUADRANT_RANK[b.quadrant] : 9) || num(b.ratio) - num(a.ratio))
    else if (sort === 'ratio' || sort === 'momentum' || sort === 'velocity') out.sort((a, b) => num(b[sort]) - num(a[sort]))
    else out.sort((a, b) => num(valueOf(b, sort)) - num(valueOf(a, sort)))
    return out
    // valueOf depends on mode
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, sort, mode])

  return (
    <Card
      title="Tabla de rotación"
      subtitle={
        mode === 'excess'
          ? `Rentabilidad del grupo menos la del ${board.benchmark_label}, en puntos porcentuales`
          : 'Rentabilidad del ETF del grupo, en %'
      }
      actions={
        <Segmented size="sm" label="Medida" value={mode} onChange={setMode}
          options={[{ value: 'excess', label: `Exceso vs ${board.benchmark_label}` }, { value: 'abs', label: 'Rentabilidad' }]} />
      }
      bodyClassName="px-0 pb-1 pt-2"
    >
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[1040px] text-[13px]">
          <thead>
            <tr className="text-[11px] text-ink-3">
              <th className="px-4 py-2 text-left font-medium">Grupo</th>
              <SortHead sort={sort} onSort={setSort} k="quadrant" label="Cuadrante" align="left" hint="Ordenar por ciclo: liderando, debilitándose, rezagado, mejorando" />
              <th className="px-2 py-2 text-left font-medium" title="Barras consecutivas en el cuadrante actual">En él</th>
              <th className="px-2 py-2 text-left font-medium" title="Dirección de las últimas 4 barras en el plano RRG">Rumbo</th>
              <SortHead sort={sort} onSort={setSort} k="velocity" label="Velocidad" hint="Paso medio por barra en las últimas 4 barras (puntos RRG)" />
              <SortHead sort={sort} onSort={setSort} k="ratio" label="RS-Ratio" />
              <SortHead sort={sort} onSort={setSort} k="momentum" label="RS-Mom." hint="Ordenar por RS-Momentum" />
              {HORIZONS.map((h) => <SortHead key={h} sort={sort} onSort={setSort} k={h} label={h} />)}
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr
                key={g.symbol}
                onClick={() => onSelect(g.symbol)}
                className={clsx('cursor-pointer border-t border-line transition-colors', selected === g.symbol ? 'bg-accent-soft' : 'hover:bg-surface-2')}
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{g.label}</span>
                    <span className="text-[11px] text-ink-3">{g.symbol}</span>
                    {g.warnings.length > 0 && <Pill tone="warn" title={g.warnings.join(' · ')}>aviso</Pill>}
                  </div>
                </td>
                <td className="px-2 py-2.5"><QuadrantPill q={g.quadrant} /></td>
                <td className="num px-2 py-2.5 text-xs text-ink-2">{g.dwell_bars == null ? DASH : `${g.dwell_bars} ${barUnitShort(tf)}`}</td>
                <td className="px-2 py-2.5"><Heading deg={g.heading_deg} /></td>
                <td className="num px-3 py-2.5 text-right text-ink-2">{fmtNum(g.velocity, 2)}</td>
                <td className="num px-3 py-2.5 text-right text-ink">{fmtNum(g.ratio, 2)}</td>
                <td className="num px-3 py-2.5 text-right text-ink">{fmtNum(g.momentum, 2)}</td>
                {HORIZONS.map((h) => {
                  const v = valueOf(g, h)
                  return (
                    <td key={h} className="px-1 py-1.5 text-right">
                      <span className="num inline-block min-w-[66px] rounded-md px-1.5 py-1 text-[12px]" style={{ background: heat(v) }}>
                        <span className={clsx(v == null ? 'text-ink-3' : v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-ink-2')}>
                          {mode === 'excess' ? fmtPp(v) : fmtPct(v, 1)}
                        </span>
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------- group chart

const BARS = [
  { value: 126, label: '6M' },
  { value: 252, label: '1A' },
]

function GroupChart({ board, group }: { board: RotationBoard; group: RotationGroup }) {
  const [bars, setBars] = useState(252)
  const px = useInstrumentSeries(group.key, bars)
  const rel = useRelativeLine(board.code, group.symbol, bars)

  const panes = useMemo<PaneSpec[]>(() => {
    if (!px.data || !rel.data) return []
    const s = px.data
    const price = (v: number) => fmtLevel(v)
    const pts = (v: number) => fmtNum(v, 2)
    return [
      {
        stretch: 2,
        series: [
          s.has_ohlc
            ? {
                type: 'candles' as const, id: 'px', label: `${group.symbol}`, format: price,
                data: s.bars.filter((b) => b.open != null).map((b) => ({ time: b.time, open: b.open!, high: b.high!, low: b.low!, close: b.close })),
              }
            : { type: 'line' as const, id: 'px', label: group.symbol, color: 'var(--ink-2)', format: price, data: s.bars.map((b) => ({ time: b.time, value: b.close })) },
          { type: 'line', id: 'sma50', label: 'MA50', color: 'var(--ink-3)', width: 1, format: price, data: s.sma50 },
        ],
      },
      {
        stretch: 1.1,
        levels: [{ value: 100 }],
        series: [{ type: 'line', id: 'rel', label: `vs ${board.benchmark_label} (base 100)`, color: 'var(--s3)', format: (v) => fmtNum(v, 1), data: rel.data.points }],
      },
      {
        stretch: 1.1,
        levels: [{ value: 100 }],
        series: [
          { type: 'line', id: 'ratio', label: 'RS-Ratio', color: 'var(--s1)', format: pts, data: group.trail.map((p) => ({ time: p.date, value: p.ratio })) },
          { type: 'line', id: 'mom', label: 'RS-Momentum', color: 'var(--s2)', format: pts, data: group.trail.map((p) => ({ time: p.date, value: p.momentum })) },
        ],
      },
    ]
  }, [px.data, rel.data, group, board.benchmark_label])

  const error = px.error ?? rel.error
  return (
    <Card
      className="min-w-0"
      title={`${group.label} · precio, fuerza relativa y RRG`}
      subtitle={
        rel.data?.start
          ? `Relativa al ${board.benchmark_label}: ${fmtPct(rel.data.change_pct, 1)} desde el ${fmtDate(rel.data.start)} · RRG ${board.timeframe === 'weekly' ? 'semanal' : 'diario'} frente a la cesta`
          : undefined
      }
      actions={<Segmented size="sm" label="Ventana" value={bars} options={BARS} onChange={setBars} />}
    >
      {error ? (
        <ErrorState error={error} />
      ) : panes.length === 0 ? (
        <Skeleton className="h-[460px]" />
      ) : (
        <div className={clsx((px.isPlaceholderData || rel.isPlaceholderData) && 'is-stale')}>
          <TimeChart panes={panes} height={440} />
          <Warnings items={[...(px.data?.warnings ?? []), ...(rel.data?.warnings ?? [])]} className="mt-3" />
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------- events

function EventsCard({ board, selected }: { board: RotationBoard; selected: RotationGroup | null }) {
  const [scope, setScope] = useState<'all' | 'one'>('all')
  const [kind, setKind] = useState<'quadrant' | 'signal'>('quadrant')
  const only = scope === 'one' && selected ? selected.symbol : null
  const events = board.events.filter((e) => !only || e.symbol === only).slice(0, 60)
  const signals = board.signals.filter((s) => !only || s.symbol === only).slice(0, 60)

  return (
    <Card
      className="min-w-0"
      title="Eventos recientes"
      subtitle={`Desde el ${fmtDate(board.dates[0])}`}
      actions={
        <>
          <Segmented size="sm" label="Tipo" value={kind} onChange={setKind}
            options={[{ value: 'quadrant', label: `Cuadrantes (${board.events.length})` }, { value: 'signal', label: `Señales (${board.signals.length})` }]} />
          {selected && (
            <Segmented size="sm" label="Grupos" value={scope} onChange={setScope}
              options={[{ value: 'all', label: 'Todos' }, { value: 'one', label: selected.symbol }]} />
          )}
        </>
      }
      bodyClassName="px-0 pb-3 pt-2"
    >
      <div className="scroll-thin max-h-[420px] overflow-y-auto px-4">
        {kind === 'quadrant' ? (
          events.length === 0 ? (
            <p className="py-6 text-center text-xs text-ink-3">Sin cambios de cuadrante en la ventana</p>
          ) : (
            <ul>
              {events.map((e) => (
                <li key={`${e.symbol}${e.date}${e.to_quadrant}`} className="flex items-center gap-2 border-t border-line py-2 text-xs first:border-t-0">
                  <span className="num w-14 shrink-0 text-ink-3">{fmtShortDate(e.date)}</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">{e.label}</span>
                  <span className="text-ink-3">{QUADRANT_LABEL[e.from_quadrant]}</span>
                  <ArrowRight size={11} className="shrink-0 text-ink-3" aria-hidden />
                  <QuadrantPill q={e.to_quadrant} />
                </li>
              ))}
            </ul>
          )
        ) : signals.length === 0 ? (
          <p className="py-6 text-center text-xs text-ink-3">Sin señales en la ventana</p>
        ) : (
          <ul>
            {signals.map((s) => (
              <li key={`${s.symbol}${s.date}${s.kind}`} className="flex items-center gap-2 border-t border-line py-2 text-xs first:border-t-0">
                <span className="num w-14 shrink-0 text-ink-3">{fmtShortDate(s.date)}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-ink">{s.label}</span>
                <Pill tone={s.polarity === 'bullish' ? 'up' : 'down'} title={s.description}>
                  <Zap size={11} aria-hidden /> {s.name}
                </Pill>
              </li>
            ))}
          </ul>
        )}
      </div>
      {kind === 'signal' && board.signals_note && <p className="mx-4 mt-3 text-[11px] leading-relaxed text-ink-3">{board.signals_note}</p>}
    </Card>
  )
}

// ---------------------------------------------------------------- participation

const LENSES: { value: ParticipationLens; label: string }[] = [
  { value: 'rs_1m', label: '1M' },
  { value: 'rs_3m', label: '3M' },
  { value: 'rs_12m', label: '12M' },
]

function ParticipationCard({ code, selected, onSelect }: { code: string; selected: string | null; onSelect: (s: string) => void }) {
  const [lens, setLens] = useState<ParticipationLens>('rs_3m')
  const q = useParticipation(code, lens, true)
  const d = q.data

  return (
    <Card
      title={
        <span className="inline-flex items-center gap-1.5">
          Participación interna
          <InfoTip text="Cuántos componentes de cada grupo están entre los fuertes o los débiles del índice. Distingue un grupo que sube con todos sus valores de uno que sube por unos pocos." />
        </span>
      }
      subtitle={
        d
          ? `Componentes del ${d.universe} por ${d.scope === 'sector' ? 'sector' : 'industria'} · líderes: percentil de fuerza relativa ≥ ${d.leader_percentile}, rezagados: ≤ ${d.laggard_percentile} · ${d.lens_label} al ${fmtDate(d.bar_date)}`
          : 'Componentes del índice por grupo'
      }
      actions={<Segmented size="sm" label="Horizonte de la fuerza relativa" value={lens} options={LENSES} onChange={setLens} />}
      bodyClassName="px-0 pb-3 pt-2"
    >
      {q.error ? (
        <div className="px-4"><ErrorState error={q.error} /></div>
      ) : !d ? (
        <div className="space-y-3 px-4">
          <p className="flex items-center gap-2 text-xs text-ink-3">
            <Clock size={13} aria-hidden /> Calculando la fuerza relativa de cada componente. La primera vez puede tardar alrededor de un minuto.
          </p>
          <Skeleton className="h-[260px]" />
        </div>
      ) : (
        <div className={clsx(q.isPlaceholderData && 'is-stale')}>
          <div className="scroll-thin max-h-[520px] overflow-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead className="sticky top-0 bg-surface">
                <tr className="text-[11px] text-ink-3">
                  <th className="px-4 py-2 text-left font-medium">Grupo</th>
                  <th className="px-2 py-2 text-right font-medium">Valores</th>
                  <th className="px-2 py-2 text-right font-medium">Rezagados</th>
                  <th className="w-[34%] px-3 py-2 text-center font-medium">
                    <span className="inline-flex items-center gap-3">
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-down" />rezagados</span>
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-up" />líderes</span>
                    </span>
                  </th>
                  <th className="px-2 py-2 text-left font-medium">Líderes</th>
                  <th className="px-2 py-2 text-right font-medium" title="Líderes menos rezagados, en puntos porcentuales">Neto</th>
                  <th className="px-4 py-2 text-right font-medium" title={`Cambio del percentil medio en ${d.delta_bars} sesiones`}>Δ percentil</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr
                    key={r.code}
                    onClick={() => r.symbol && onSelect(r.symbol)}
                    className={clsx(
                      'border-t border-line',
                      r.symbol && 'cursor-pointer hover:bg-surface-2',
                      r.symbol && r.symbol === selected && 'bg-accent-soft',
                    )}
                  >
                    <td className="px-4 py-2">
                      <span className="font-medium text-ink">{r.name}</span>
                      {r.symbol && <span className="ml-2 text-[11px] text-ink-3">{r.symbol}</span>}
                    </td>
                    <td className={clsx('num px-2 py-2 text-right', r.n_members < 5 ? 'text-warn' : 'text-ink-2')} title={r.n_members < 5 ? 'Menos de 5 valores: el porcentaje se mueve a saltos' : undefined}>
                      {r.n_members}
                    </td>
                    <td className="num px-2 py-2 text-right text-ink-2">{fmtNum(r.pct_laggards, 0)}%</td>
                    <td className="px-3 py-2">
                      <div className="relative h-3">
                        <div className="absolute inset-y-0 left-1/2 w-px" style={{ background: 'var(--axis)' }} />
                        <div className="absolute inset-y-0 rounded-l-[3px] bg-down" style={{ right: '50%', width: `${r.pct_laggards / 2}%`, marginRight: 1 }} />
                        <div className="absolute inset-y-0 rounded-r-[3px] bg-up" style={{ left: '50%', width: `${r.pct_leaders / 2}%`, marginLeft: 1 }} />
                      </div>
                    </td>
                    <td className="num px-2 py-2 text-left text-ink-2">{fmtNum(r.pct_leaders, 0)}%</td>
                    <td className="num px-2 py-2 text-right font-medium text-ink">{fmtSigned(r.net_participation, 0, ' pp')}</td>
                    <td className="px-4 py-2 text-right">
                      <Delta value={r.mean_delta} text={fmtSigned(r.mean_delta, 1)} className="text-xs" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4">
            <Warnings items={d.warnings} className="mt-3" />
          </div>
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------- page

export function GroupsPage() {
  const [params, setParams] = useSearchParams()
  const universes = useRotationUniverses()
  const code = params.get('u') ?? 'us_sectors'
  const tf: Timeframe = params.get('tf') === 'daily' ? 'daily' : 'weekly'
  const q = useRotationBoard(code, tf)
  const board = q.data
  const [picked, setPicked] = useState<string | null>(null)

  const set = (k: string, v: string) =>
    setParams((p) => {
      const n = new URLSearchParams(p)
      n.set(k, v)
      return n
    }, { replace: true })

  const meta = universes.data?.find((u) => u.code === code)
  const group =
    board?.groups.find((g) => g.symbol === picked) ??
    // Default: the group leading the strongest, or the first one.
    [...(board?.groups ?? [])].filter((g) => g.quadrant === 'Leading').sort((a, b) => (b.distance ?? 0) - (a.distance ?? 0))[0] ??
    board?.groups[0] ??
    null

  return (
    <div>
      <PageHeader eyebrow="Estudio de mercados" title="Grupos y rotación" subtitle={meta?.subtitle ?? ' '}>
        {board?.as_of && (
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-3">
            {board.bar_in_progress && <Clock size={12} className="text-warn" aria-label="Barra en formación" />}
            Última barra {fmtDate(board.as_of)}
          </span>
        )}
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="scroll-thin max-w-full overflow-x-auto">
        <Segmented
          label="Universo"
          value={code}
          onChange={(v) => {
            setPicked(null)
            set('u', v)
          }}
          options={(universes.data ?? []).map((u) => ({ value: u.code, label: SHORT_TITLE[u.code] ?? u.title, hint: u.subtitle }))}
        />
        </div>
        <Segmented label="Temporalidad" value={tf} options={TIMEFRAMES} onChange={(v) => set('tf', v)} />
      </div>

      {q.error ? (
        <ErrorState error={q.error} />
      ) : !board || board.code !== code ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {QUADRANTS.map((k) => <Skeleton key={k} className="h-[92px]" />)}
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Skeleton className="h-[600px]" />
            <Skeleton className="h-[600px]" />
          </div>
          {code === 'us_themes' && <p className="text-xs text-ink-3">Las temáticas tardan unos segundos la primera vez: se calculan 18 ETF.</p>}
        </div>
      ) : (
        <div className={clsx('space-y-4', q.isPlaceholderData && 'is-stale')}>
          <Warnings items={board.warnings} />
          <QuadrantStrip board={board} selected={group?.symbol ?? null} onSelect={setPicked} />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <MapCard key={`${board.code}-${board.timeframe}`} board={board} selected={group?.symbol ?? null} onSelect={setPicked} />
            {group && <GroupReading board={board} group={group} />}
          </div>
          <RotationTable board={board} selected={group?.symbol ?? null} onSelect={setPicked} />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            {group && <GroupChart key={group.key} board={board} group={group} />}
            <EventsCard board={board} selected={group} />
          </div>
          {meta?.has_participation && <ParticipationCard code={code} selected={group?.symbol ?? null} onSelect={setPicked} />}
          <p className="text-[11px] leading-relaxed text-ink-3">
            {board.peer_note} El exceso de la tabla se mide frente al {board.benchmark_label}: los dos marcos pueden discrepar
            (en un mercado alcista todos los grupos pueden batir al índice mientras la mitad pierde frente al resto).
            Horizontes en sesiones: 1W=5, 1M=21, 3M=63, 6M=126, 1Y=252.
          </p>
        </div>
      )}
    </div>
  )
}
