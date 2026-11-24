import clsx from 'clsx'
import { CircleMinus, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useBreadth } from '../lib/api'
import { DASH, fmtDate, fmtNum, fmtSigned } from '../lib/format'
import type { BreadthBoard, Gauge, Signal } from '../lib/types'
import { TimeChart, type PaneSpec, type Pt } from '../components/charts/TimeChart'
import { Card, ErrorState, InfoTip, PageHeader, Pill, Segmented, Skeleton, Warnings } from '../components/ui'

const WINDOWS = [
  { value: 126, label: '6M' },
  { value: 252, label: '1A' },
  { value: 504, label: '2A' },
  { value: 1260, label: '5A' },
]

const BOUNDS: Record<string, { min: number; max: number; marks: number[] }> = {
  pct_ma50: { min: 0, max: 100, marks: [20, 80] },
  pct_ma200: { min: 0, max: 100, marks: [25, 75] },
  mcclellan: { min: -200, max: 200, marks: [-100, 100] },
}

function fmtGauge(g: Gauge) {
  if (g.value == null) return DASH
  if (g.unit === '%') return `${fmtNum(g.value, 1)}%`
  if (g.unit === 'count') return fmtNum(g.value, 0)
  return fmtNum(g.value, 0)
}

function zoneTone(z: Gauge['zone']): 'up' | 'down' | 'warn' | 'neutral' {
  if (z === 'positive') return 'up'
  if (z === 'negative') return 'down'
  if (z === 'overbought' || z === 'oversold') return 'warn'
  return 'neutral'
}

function GaugeTile({ g }: { g: Gauge }) {
  const b = BOUNDS[g.code]
  const pos = b && g.value != null ? Math.min(1, Math.max(0, (g.value - b.min) / (b.max - b.min))) : null
  return (
    <div className="card flex flex-col px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-ink-3">{g.label}</span>
        <InfoTip text={g.explain} />
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-[24px] font-semibold tracking-tight">{fmtGauge(g)}</span>
        {g.change_5d != null && (
          <span className="num text-[11px] text-ink-3" title="Cambio en 5 sesiones">
            {fmtSigned(g.change_5d, g.unit === '%' ? 1 : 0)} 5d
          </span>
        )}
      </div>
      {b && (
        <div className="relative mt-2 h-1.5 rounded-full bg-surface-3" aria-hidden>
          {b.marks.map((m) => (
            <span key={m} className="absolute top-[-3px] h-3 w-px bg-axis" style={{ left: `${((m - b.min) / (b.max - b.min)) * 100}%`, background: 'var(--axis)' }} />
          ))}
          {pos != null && <span className="absolute top-1/2 h-3 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" style={{ left: `${pos * 100}%` }} />}
        </div>
      )}
      <div className="mt-auto pt-2.5">
        <Pill tone={zoneTone(g.zone)}>{g.zone_label}</Pill>
      </div>
    </div>
  )
}

function SignalCard({ s }: { s: Signal }) {
  const Icon = s.state === 'bullish' ? TrendingUp : s.state === 'bearish' ? TrendingDown : CircleMinus
  return (
    <div className="card flex gap-3 px-4 py-3.5">
      <div
        className={clsx(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          s.state === 'bullish' && 'bg-up-soft text-up',
          s.state === 'bearish' && 'bg-down-soft text-down',
          s.state === 'neutral' && 'bg-surface-3 text-ink-3',
        )}
      >
        <Icon size={16} aria-label={s.state === 'bullish' ? 'Alcista' : s.state === 'bearish' ? 'Bajista' : 'Neutral'} />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-ink-3">{s.label}</div>
        <div className="mt-0.5 text-[13px] font-medium text-ink">{s.headline}</div>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-3">{s.detail}</p>
        {s.last_event && <div className="mt-1.5 text-[11px] text-ink-2">Último episodio: {fmtDate(s.last_event)}</div>}
      </div>
    </div>
  )
}

function pts(b: BreadthBoard, key: string): Pt[] {
  const v = b.series[key] ?? []
  return b.dates.map((t, i) => ({ time: t, value: v[i] ?? null }))
}

function useBreadthPanes(b: BreadthBoard | undefined): PaneSpec[] {
  return useMemo(() => {
    if (!b) return []
    const n0 = (v: number) => fmtNum(v, 0)
    const n1 = (v: number) => fmtNum(v, 1)
    return [
      { stretch: 2, series: [{ type: 'line', id: 'nya', label: 'NYSE Composite', color: 'var(--ink-2)', data: pts(b, 'nya'), format: (v) => fmtNum(v, 0) }] },
      {
        stretch: 1.2,
        series: [
          { type: 'line', id: 'ad', label: 'Línea A/D', color: 'var(--s1)', data: pts(b, 'ad_line'), format: n0 },
          { type: 'line', id: 'adw', label: 'WMA150', color: 'var(--s2)', width: 1, data: pts(b, 'ad_line_wma150'), format: n0 },
        ],
      },
      {
        levels: [
          { value: 100, label: '+100' },
          { value: -100, label: '−100' },
        ],
        series: [{ type: 'histogram', id: 'mcc', label: 'McClellan', color: 'var(--up)', negativeColor: 'var(--down)', data: pts(b, 'mcclellan'), format: n0 }],
      },
      {
        levels: [{ value: 0, label: '' }],
        series: [{ type: 'line', id: 'sum', label: 'Índice de suma', color: 'var(--s7)', data: pts(b, 'summation'), format: n0 }],
      },
      {
        levels: [
          { value: 80, label: '80' },
          { value: 20, label: '20' },
        ],
        series: [
          { type: 'line', id: 'p50', label: '% > MA50', color: 'var(--s1)', data: pts(b, 'pct_ma50'), format: n1 },
          { type: 'line', id: 'p200', label: '% > MA200', color: 'var(--s2)', data: pts(b, 'pct_ma200'), format: n1 },
        ],
      },
      {
        series: [
          { type: 'histogram', id: 'nh', label: 'Máx − mín', color: 'var(--up)', negativeColor: 'var(--down)', data: pts(b, 'net_highs'), format: n0 },
          { type: 'line', id: 'nh10', label: 'Media 10d', color: 'var(--ink-2)', width: 1, data: pts(b, 'net_highs_10'), format: n1 },
        ],
      },
      {
        stretch: 0.8,
        levels: [
          { value: 0.615, label: '0,615' },
          { value: 0.4, label: '0,40' },
        ],
        series: [{ type: 'line', id: 'zw', label: 'Zweig EMA10', color: 'var(--s3)', data: pts(b, 'zweig_ema10'), format: (v) => fmtNum(v, 3) }],
      },
    ]
  }, [b])
}

export function BreadthPage() {
  const [bars, setBars] = useState(252)
  const q = useBreadth(bars)
  const panes = useBreadthPanes(q.data)
  return (
    <div>
      <PageHeader
        eyebrow="Amplitud de mercado"
        title="NYSE"
        subtitle="Participación interna del New York Stock Exchange: cuántos valores acompañan al índice."
      >
        {q.data?.as_of && <span className="text-xs text-ink-3">Sesión {fmtDate(q.data.as_of)}</span>}
        <Segmented label="Ventana" value={bars} options={WINDOWS} onChange={setBars} />
      </PageHeader>

      {q.error ? (
        <ErrorState error={q.error} />
      ) : !q.data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[128px]" />
            ))}
          </div>
          <Skeleton className="h-[900px]" />
        </div>
      ) : (
        <div className={clsx('space-y-4', q.isPlaceholderData && 'is-stale')}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {q.data.gauges.map((g) => (
              <GaugeTile key={g.code} g={g} />
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {q.data.signals.map((s) => (
              <SignalCard key={s.code} s={s} />
            ))}
          </div>
          <Warnings items={q.data.warnings} />
          <Card
            title="Panel de amplitud"
            subtitle={`${q.data.benchmark_label} y sus indicadores internos · cursor sincronizado entre paneles`}
          >
            <TimeChart panes={panes} height={980} />
          </Card>
        </div>
      )}
    </div>
  )
}
