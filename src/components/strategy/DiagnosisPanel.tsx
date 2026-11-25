import clsx from 'clsx'
import { LoaderCircle, Microscope } from 'lucide-react'
import { useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import { useDiagnosis } from '../../lib/api'
import { DASH, fmtDate, fmtLevel, fmtNum, fmtSigned } from '../../lib/format'
import type { Backtest, BacktestRequest, Diagnosis, MarginUnit, SignalStatus, TraceNode } from '../../lib/types'
import { Card, ErrorState, Pill, Warnings } from '../ui'
import { inputCls, monthsAgo, type Window } from '../../lib/strategyForm'

/**
 * Why the strategy did (not) signal in a window of its backtest: the core
 * traces the entry and exit rules session by session (held or not, and how
 * far each comparison was from holding) next to the position the backtest
 * held. The verdict and every sentence are the core's.
 */

const LABEL_W = 'w-[300px]'
const VALUE_W = 'w-[96px]'

const STATUS: Record<SignalStatus, { color: string; label: string }> = {
  taken: { color: 'var(--up)', label: 'señal: entra' },
  in_position: { color: 'var(--ink-3)', label: 'señal ignorada (ya en posición)' },
  unfilled: { color: 'var(--warn)', label: 'señal pendiente (última sesión)' },
}
const HELD = 'var(--accent)'
const NOT_HELD = 'var(--surface-3)'
const UNDEFINED = 'transparent'
const POSITION = 'var(--ink-2)'

const UNIT: Record<MarginUnit, string> = { pct: '%', pp: ' pp', points: ' pts' }
const fmtMargin = (v: number | null | undefined, unit: MarginUnit | null) =>
  v == null || unit == null ? DASH : fmtSigned(v, Math.abs(v) >= 100 ? 0 : unit === 'points' ? 1 : 2, UNIT[unit])

// ------------------------------------------------------------------ the strips

/** Runs of equal colour, so a long window is a handful of rects. */
function runs(colors: string[]): { from: number; to: number; color: string }[] {
  const out: { from: number; to: number; color: string }[] = []
  colors.forEach((c, i) => {
    const last = out[out.length - 1]
    if (last && last.color === c && last.to === i) last.to = i + 1
    else out.push({ from: i, to: i + 1, color: c })
  })
  return out
}

function Strip({ colors, hover, height = 12, label }: { colors: string[]; hover: number | null; height?: number; label: string }) {
  const n = colors.length
  return (
    <svg viewBox={`0 0 ${n} 1`} preserveAspectRatio="none" className="block w-full" style={{ height }} role="img" aria-label={label}>
      {runs(colors).map((r) =>
        r.color === UNDEFINED ? null : <rect key={r.from} x={r.from} y={0} width={r.to - r.from} height={1} fill={r.color} />,
      )}
      {hover != null && <rect x={hover} y={0} width={1} height={1} fill="var(--ink)" opacity={0.55} />}
    </svg>
  )
}

/** A line over the window (the close, a margin), with an optional zero line. */
function Line({ values, hover, height, zero, label }: { values: (number | null)[]; hover: number | null; height: number; zero?: boolean; label: string }) {
  const n = values.length
  const finite = values.filter((v): v is number => v != null)
  if (!finite.length) return <div style={{ height }} />
  let lo = Math.min(...finite)
  let hi = Math.max(...finite)
  if (zero) {
    lo = Math.min(lo, 0)
    hi = Math.max(hi, 0)
  }
  const span = hi - lo || 1
  const y = (v: number) => 1 - (v - lo) / span
  const segments: string[] = []
  let cur = ''
  values.forEach((v, i) => {
    if (v == null) {
      if (cur) segments.push(cur)
      cur = ''
    } else cur += `${cur ? 'L' : 'M'}${i + 0.5},${y(v)}`
  })
  if (cur) segments.push(cur)
  return (
    <svg viewBox={`0 0 ${n} 1`} preserveAspectRatio="none" className="block w-full overflow-visible" style={{ height }} role="img" aria-label={label}>
      {zero && <line x1={0} x2={n} y1={y(0)} y2={y(0)} stroke="var(--axis)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
      {segments.map((d) => (
        <path key={d.slice(0, 24)} d={d} fill="none" stroke="var(--ink-2)" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
      ))}
      {hover != null && <rect x={hover} y={0} width={1} height={1} fill="var(--ink)" opacity={0.25} />}
    </svg>
  )
}

/** Hover tracking over a strip: the session under the pointer. */
function useHoverCell(n: number, set: (i: number | null) => void) {
  return {
    onMouseMove: (e: MouseEvent<HTMLDivElement>) => {
      const r = e.currentTarget.getBoundingClientRect()
      const i = Math.floor(((e.clientX - r.left) / r.width) * n)
      set(i >= 0 && i < n ? i : null)
    },
    onMouseLeave: () => set(null),
  }
}

function Row({
  label,
  sub,
  value,
  depth = 0,
  children,
  hoverProps,
  strong,
}: {
  label: ReactNode
  sub?: string
  value: ReactNode
  depth?: number
  children: ReactNode
  hoverProps: ReturnType<typeof useHoverCell>
  strong?: boolean
}) {
  return (
    <div className="flex items-start gap-3 border-t border-line py-1.5 first:border-t-0">
      <div className={clsx(LABEL_W, 'min-w-0 shrink-0')} style={{ paddingLeft: depth * 14 }}>
        <div className={clsx('truncate text-xs', strong ? 'font-medium text-ink' : 'text-ink-2')} title={typeof label === 'string' ? label : undefined}>
          {label}
        </div>
        {sub && (
          <div className="line-clamp-2 text-[11px] leading-snug text-ink-3" title={sub}>
            {sub}
          </div>
        )}
      </div>
      <div className={clsx(VALUE_W, 'num shrink-0 pt-px text-right text-xs text-ink-2')}>{value}</div>
      <div className="min-w-0 flex-1 cursor-crosshair pt-0.5" {...hoverProps}>
        {children}
      </div>
    </div>
  )
}

function heldColors(node: TraceNode): string[] {
  return node.held.map((h) => (h == null ? UNDEFINED : h ? HELD : NOT_HELD))
}

function NodeRows({
  node,
  depth,
  hover,
  hoverProps,
  root,
  rootColors,
}: {
  node: TraceNode
  depth: number
  hover: number | null
  hoverProps: ReturnType<typeof useHoverCell>
  root?: boolean
  rootColors?: string[]
}) {
  const n = node.held.length
  const h = hover == null ? null : node.held[hover]
  const value =
    hover == null ? (
      <span title="Sesiones en que se cumplió / sesiones del intervalo">
        {node.held_count}/{n}
      </span>
    ) : node.margin ? (
      <span className={clsx(h ? 'text-ink' : 'text-ink-3')}>{fmtMargin(node.margin[hover], node.margin_unit)}</span>
    ) : (
      <span>{h == null ? DASH : h ? 'sí' : 'no'}</span>
    )
  const label =
    node.kind === 'group' ? (
      <span className="inline-flex items-center gap-1.5">
        <Pill tone="neutral">{node.combinator === 'all' ? 'Todas' : 'Alguna'}</Pill>
        <span className="truncate" title={node.text}>{node.text}</span>
      </span>
    ) : (
      node.text
    )
  return (
    <>
      <Row label={label} sub={node.summary} value={value} depth={depth} hoverProps={hoverProps} strong={root}>
        <Strip colors={rootColors ?? heldColors(node)} hover={hover} label={node.text} />
        {node.margin && node.held_count < n && (
          <div className="mt-1">
            <Line values={node.margin} hover={hover} height={26} zero label={`Margen de «${node.text}»`} />
          </div>
        )}
      </Row>
      {node.children.map((c, i) => (
        <NodeRows key={i} node={c} depth={depth + 1} hover={hover} hoverProps={hoverProps} />
      ))}
    </>
  )
}

const monthFmt = new Intl.DateTimeFormat('es-ES', { month: 'short', year: '2-digit' })

function Axis({ dates }: { dates: string[] }) {
  const n = dates.length
  const ticks: { i: number; label: string }[] = []
  const years = n > 520
  dates.forEach((d, i) => {
    const prev = dates[i - 1]
    if (!prev) return
    if (years ? d.slice(0, 4) !== prev.slice(0, 4) : d.slice(0, 7) !== prev.slice(0, 7))
      ticks.push({ i, label: years ? d.slice(0, 4) : monthFmt.format(new Date(`${d}T12:00:00`)) })
  })
  const every = Math.max(1, Math.ceil(ticks.length / 12))
  return (
    <div className="flex gap-3">
      <div className={clsx(LABEL_W, 'shrink-0')} />
      <div className={clsx(VALUE_W, 'shrink-0')} />
      <div className="relative h-4 min-w-0 flex-1 text-[10px] text-ink-3">
        {ticks
          .filter((_, k) => k % every === 0)
          .map((t) => (
            <span key={t.i} className="num absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${(t.i / n) * 100}%` }}>
              {t.label}
            </span>
          ))}
      </div>
    </div>
  )
}

function Legend() {
  const item = (color: string, label: string, outline = false) => (
    <span key={label} className="inline-flex items-center gap-1.5">
      <span className={clsx('h-2.5 w-3.5 rounded-[2px]', outline && 'border border-line-strong')} style={{ background: color }} aria-hidden />
      {label}
    </span>
  )
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-3">
      {item(HELD, 'se cumple')}
      {item(NOT_HELD, 'no se cumple')}
      {item(UNDEFINED, 'sin valor (calentamiento, o techo/suelo sin formar)', true)}
      {(Object.keys(STATUS) as SignalStatus[]).map((s) => item(STATUS[s].color, STATUS[s].label))}
      {item(POSITION, 'en posición')}
      <span>Línea bajo cada comparación: su margen (sobre la línea discontinua, se cumple).</span>
    </div>
  )
}

function Trace({ d }: { d: Diagnosis }) {
  const [hover, setHover] = useState<number | null>(null)
  const n = d.dates.length
  const hoverProps = useHoverCell(n, setHover)
  const status = useMemo(() => new Map(d.signals.map((s) => [s.date, s.status])), [d.signals])
  const entryColors = useMemo(
    () => d.dates.map((t, i) => {
      const s = status.get(t)
      if (s) return STATUS[s].color
      const h = d.entry.held[i]
      return h == null ? UNDEFINED : NOT_HELD
    }),
    [d, status],
  )
  const exitSet = useMemo(() => new Set(d.exits), [d.exits])
  const entrySet = useMemo(() => new Set(d.entries), [d.entries])
  const posColors = d.in_position.map((p) => (p ? POSITION : NOT_HELD))
  const date = hover == null ? null : d.dates[hover]
  const event = date && (entrySet.has(date) ? 'entra a la apertura' : exitSet.has(date) ? 'sale' : null)

  return (
    <div className="min-w-[760px]">
      <div className="mb-1 flex h-5 items-center justify-end gap-3 text-[11px] text-ink-3">
        {date ? (
          <>
            <span className="num text-ink-2">{fmtDate(date)}</span>
            {event && <Pill tone="accent">{event}</Pill>}
            {status.get(date) && <span>{STATUS[status.get(date)!].label}</span>}
          </>
        ) : (
          <span>Pasa el cursor por las franjas para ver cada sesión.</span>
        )}
      </div>
      <Row label="Cierre" value={fmtLevel(hover == null ? d.closes[n - 1] : d.closes[hover])} hoverProps={hoverProps} strong>
        <Line values={d.closes} hover={hover} height={44} label="Cierre en el intervalo" />
      </Row>
      <Row
        label="En posición"
        sub={`${d.in_position.filter(Boolean).length} de ${n} sesiones al cierre`}
        value={hover == null ? DASH : d.in_position[hover] ? 'sí' : 'no'}
        hoverProps={hoverProps}
        strong
      >
        <Strip colors={posColors} hover={hover} label="En posición" />
      </Row>

      <div className="eyebrow mt-3 mb-0.5">Entrada · {d.entry_text}</div>
      <NodeRows node={d.entry} depth={0} hover={hover} hoverProps={hoverProps} root rootColors={d.entry.children.length ? undefined : entryColors} />
      {d.entry.children.length > 0 && (
        <Row label="Señal de entrada" sub="La regla completa, y qué fue de cada señal" value={hover == null ? `${d.signals.length}` : status.get(d.dates[hover]) ? 'sí' : 'no'} hoverProps={hoverProps} strong>
          <Strip colors={entryColors} hover={hover} label="Señales de entrada" />
        </Row>
      )}

      <div className="eyebrow mt-3 mb-0.5">Salida · {d.exit_text}</div>
      <NodeRows node={d.exit} depth={0} hover={hover} hoverProps={hoverProps} root />
      <Axis dates={d.dates} />
    </div>
  )
}

// ------------------------------------------------------------------ the panel

export function DiagnosisPanel({
  request,
  bt,
  win,
  onWindow,
}: {
  /** The backtest's request, as it ran (its period holds the window). */
  request: BacktestRequest
  bt: Backtest
  win: Window
  onWindow: (w: Window) => void
}) {
  // The dates as typed, until submitted; a window set from outside replaces them.
  const [draft, setDraft] = useState<Window>(win)
  const [prevWin, setPrevWin] = useState<Window>(win)
  if (win !== prevWin) {
    setPrevWin(win)
    setDraft(win)
  }
  const q = useDiagnosis({ ...request, window_start: win.start, window_end: win.end })

  const last = bt.trades[bt.trades.length - 1]
  const quick: { label: string; w: Window; hint: string }[] = [
    { label: '3M', w: { start: monthsAgo(3, bt.end), end: bt.end }, hint: 'Los últimos 3 meses del periodo' },
    { label: '6M', w: { start: monthsAgo(6, bt.end), end: bt.end }, hint: 'Los últimos 6 meses del periodo' },
    { label: '1A', w: { start: monthsAgo(12, bt.end), end: bt.end }, hint: 'El último año del periodo' },
    ...(last && last.outcome !== 'open'
      ? [{ label: 'Desde la última salida', w: { start: last.exit_date, end: bt.end }, hint: `Del ${fmtDate(last.exit_date)} al final: fuera de mercado desde entonces` }]
      : []),
  ]
  const dirty = draft.start !== win.start || draft.end !== win.end
  const d = q.data

  return (
    <div id="diagnosis" className="scroll-mt-4">
      <Card
        title={
          <span className="inline-flex items-center gap-1.5">
            <Microscope size={14} className="text-ink-3" aria-hidden /> ¿Por qué (no) dio señal?
          </span>
        }
        subtitle="Las reglas de la estrategia sesión a sesión en un intervalo del backtest: qué condición se cumplió, cuál faltó y a qué distancia estuvo, junto a la posición que tenía."
      >
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            onWindow(draft)
          }}
        >
          <label className="block">
            <span className="mb-1 block text-xs text-ink-2">Desde</span>
            <input type="date" className={clsx(inputCls, 'num w-[150px]')} value={draft.start} min={bt.start} max={bt.end} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-ink-2">Hasta</span>
            <input type="date" className={clsx(inputCls, 'num w-[150px]')} value={draft.end} min={bt.start} max={bt.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
          </label>
          <button
            type="submit"
            disabled={q.isFetching}
            className={clsx(
              'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors',
              dirty ? 'bg-accent text-canvas hover:opacity-90' : 'border border-line bg-surface-2 text-ink-2 hover:text-ink',
            )}
          >
            {q.isFetching ? <LoaderCircle size={13} className="animate-spin" /> : <Microscope size={13} />} Analizar
          </button>
          <div className="ml-auto flex flex-wrap gap-1">
            {quick.map((x) => (
              <button
                key={x.label}
                type="button"
                title={x.hint}
                onClick={() => onWindow(x.w)}
                className={clsx(
                  'h-7 rounded-md px-2 text-[11px] font-medium transition-colors',
                  win.start === x.w.start && win.end === x.w.end ? 'bg-surface-3 text-ink' : 'text-ink-3 hover:bg-surface-2 hover:text-ink-2',
                )}
              >
                {x.label}
              </button>
            ))}
          </div>
        </form>

        {q.isError && (
          <div className="mt-3">
            <ErrorState error={q.error} />
          </div>
        )}
        {d && (
          <div className={clsx('mt-4 space-y-3', (q.isFetching || q.isPlaceholderData) && 'is-stale')}>
            <div className="rounded-xl border border-line bg-surface-2 px-3.5 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-[14px] font-medium leading-snug text-ink">{d.verdict}</p>
                <span className="num text-[11px] text-ink-3">
                  {fmtDate(d.window_start)} – {fmtDate(d.window_end)} · {fmtNum(d.sessions, 0)} sesiones
                </span>
              </div>
              {d.reasons.length > 0 && (
                <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-ink-2">
                  {d.reasons.map((r) => (
                    <li key={r}>{r.endsWith(':') ? r : `· ${r}`}</li>
                  ))}
                </ul>
              )}
            </div>
            <Warnings items={d.warnings} />
            <div className="scroll-thin overflow-x-auto">
              <Trace d={d} />
            </div>
            <Legend />
          </div>
        )}
      </Card>
    </div>
  )
}
