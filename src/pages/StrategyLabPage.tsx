import clsx from 'clsx'
import { FlaskConical, LoaderCircle, Pencil, Play, Plus, Save, Trash2, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { TimeChart, type Marker, type PaneSpec, type Pt, type SeriesSpec } from '../components/charts/TimeChart'
import { RulesEditor } from '../components/strategy/RulesEditor'
import { Card, ErrorState, InfoTip, PageHeader, Pill, Segmented, Skeleton, Warnings } from '../components/ui'
import { fetchRules, useBacktest, useDeleteStrategy, useRulesPreview, useSaveStrategy, useStrategyLabCatalog } from '../lib/api'
import { DASH, fmtDate, fmtLevel, fmtNum, fmtPct } from '../lib/format'
import { seriesColor } from '../lib/theme'
import type {
  Backtest,
  BacktestRequest,
  Composition,
  EntryPoint,
  ParamValue,
  PerformanceSummary,
  RulesPreview,
  Scale as SeriesScale,
  StrategyLabCatalog,
  StrategyTemplate,
} from '../lib/types'

// ------------------------------------------------------------------ form

type Preset = '10' | '20' | '30' | '50' | 'all' | 'custom'

const PRESETS: { value: Preset; label: string; hint: string }[] = [
  { value: '10', label: '10A', hint: 'Últimos 10 años' },
  { value: '20', label: '20A', hint: 'Últimos 20 años' },
  { value: '30', label: '30A', hint: 'Últimos 30 años' },
  { value: '50', label: '50A', hint: 'Últimos 50 años' },
  { value: 'all', label: 'Todo', hint: 'Todo el histórico disponible del activo' },
  { value: 'custom', label: 'Fechas', hint: 'Elegir inicio y fin' },
]

/** Earliest date asked for with "Todo": the core starts at the first session it has. */
const ALL_HISTORY = '1900-01-01'

/** `form.strategy` of a strategy written from scratch, not yet saved. */
const NEW = '__new__'
const NEW_LABEL = 'Estrategia nueva'

interface FormState {
  /** A catalog id, or NEW (then `rules` holds the strategy). */
  strategy: string
  params: Record<string, string>
  instrument: string
  preset: Preset
  start: string
  end: string
  entryPoint: EntryPoint
  cost: string
  /** Editing: the rules in the editor replace the strategy's (and its params). */
  rules: Composition | null
  /** The rules as they were opened, to tell an edited strategy from the original. */
  loaded: Composition | null
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const isModified = (f: FormState) => f.rules !== null && !same(f.rules, f.loaded)

const iso = (d: Date) => d.toISOString().slice(0, 10)
const today = () => iso(new Date())

function yearsAgo(n: number): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - n)
  return iso(d)
}

function paramDefaults(t: StrategyTemplate): Record<string, string> {
  return Object.fromEntries(t.params.map((p) => [p.name, String(p.default)]))
}

function initialForm(cat: StrategyLabCatalog): FormState {
  const t = cat.strategies.find((s) => s.id === cat.default_strategy) ?? cat.strategies[0]
  return {
    strategy: t.id,
    params: paramDefaults(t),
    instrument: cat.default_instrument,
    preset: '30',
    start: yearsAgo(30),
    end: today(),
    entryPoint: cat.default_entry_point,
    cost: String(cat.default_cost_bps),
    rules: null,
    loaded: null,
  }
}

/** Numbers travel as numbers; anything else as typed, for the core to refuse in words. */
function value(raw: string, numeric: boolean): ParamValue {
  if (!numeric) return raw
  const n = Number(raw)
  return raw.trim() !== '' && Number.isFinite(n) ? n : raw
}

function toRequest(f: FormState, t: StrategyTemplate | null): BacktestRequest {
  const span = f.preset === 'custom' ? { start: f.start, end: f.end }
    : f.preset === 'all' ? { start: ALL_HISTORY, end: today() }
    : { start: yearsAgo(Number(f.preset)), end: today() }
  const cost = Number(f.cost)
  const what: Pick<BacktestRequest, 'strategy' | 'params' | 'rules' | 'label'> = f.rules
    ? { rules: f.rules, label: !t ? NEW_LABEL : isModified(f) ? `${t.label} (modificada)` : t.label }
    : {
        strategy: f.strategy,
        params: Object.fromEntries((t?.params ?? []).map((p) => [p.name, value(f.params[p.name] ?? String(p.default), p.type !== 'choice')])),
      }
  return {
    ...what,
    instrument: f.instrument,
    ...span,
    entry_point: f.entryPoint,
    cost_bps: f.cost.trim() !== '' && Number.isFinite(cost) ? cost : NaN,
  }
}

const inputCls =
  'h-8 w-full rounded-lg border border-line bg-surface-2 px-2.5 text-[13px] text-ink outline-none transition-colors focus:border-accent disabled:opacity-50'

function Field({ label, hint, children, unit }: { label: string; hint?: string | null; children: ReactNode; unit?: string | null }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-xs text-ink-2">
        {label}
        {hint && <InfoTip text={hint} />}
      </span>
      <span className="flex items-center gap-2">
        {children}
        {unit && <span className="shrink-0 text-[11px] text-ink-3">{unit}</span>}
      </span>
    </label>
  )
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="border-t border-line pt-4 first:border-t-0 first:pt-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="eyebrow">{title}</span>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function DefinitionPanel({
  cat,
  form,
  setForm,
  template,
  dirty,
  running,
  error,
  onRun,
  onEdit,
  opening,
  onDelete,
  deleting,
  onNew,
}: {
  cat: StrategyLabCatalog
  form: FormState
  setForm: (f: FormState) => void
  /** null: a strategy written from scratch (NEW). */
  template: StrategyTemplate | null
  dirty: boolean
  running: boolean
  /** The core's refusal of the last run, in its words. */
  error: string | null
  onRun: () => void
  /** Opens the strategy's rules (with the current values) in the editor. */
  onEdit: () => void
  opening: boolean
  onDelete: () => void
  deleting: boolean
  /** Opens the editor on a strategy from scratch, without a template. */
  onNew: () => void
}) {
  const groups = useMemo(() => {
    const out = new Map<string, StrategyLabCatalog['instruments']>()
    for (const i of cat.instruments) out.set(i.group, [...(out.get(i.group) ?? []), i])
    return [...out.entries()]
  }, [cat.instruments])
  const set = (patch: Partial<FormState>) => setForm({ ...form, ...patch })
  const builtin = cat.strategies.filter((t) => t.origin === 'builtin')
  const own = cat.strategies.filter((t) => t.origin === 'user')
  const basedOn = template?.based_on ? cat.strategies.find((t) => t.id === template.based_on) : undefined
  const editing = form.rules !== null
  const toDefault = () => {
    const t = cat.strategies.find((s) => s.id === cat.default_strategy) ?? cat.strategies[0]
    set({ strategy: t.id, params: paramDefaults(t), rules: null, loaded: null })
  }

  return (
    <Card bodyClassName="space-y-4 p-4">
      <Section
        title="Estrategia"
        action={
          !template ? null : (
            <button
              type="button"
              onClick={onNew}
              title="Escribe una estrategia desde cero, sin plantilla: tus series, tu regla de entrada y tu regla de salida"
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
            >
              <Plus size={12} /> Nueva estrategia
            </button>
          )
        }
      >
        <Field label="Estrategia">
          <select
            className={inputCls}
            value={form.strategy}
            onChange={(e) => {
              if (isModified(form) && !window.confirm('Hay cambios en las reglas sin guardar. ¿Descartarlos?')) return
              const t = cat.strategies.find((s) => s.id === e.target.value)!
              set({ strategy: t.id, params: paramDefaults(t), rules: null, loaded: null })
            }}
          >
            {!template && <option value={NEW}>{NEW_LABEL} (sin guardar)</option>}
            <optgroup label="Plantillas">
              {builtin.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </optgroup>
            {own.length > 0 && (
              <optgroup label="Mis estrategias">
                {own.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </Field>
        <p className="text-xs leading-relaxed text-ink-3">
          {!template
            ? 'Escrita desde cero en el editor: tus series, tu regla de entrada y tu regla de salida. Guárdala para volver a ella.'
            : template.description || template.summary || (template.origin === 'user' ? 'Estrategia guardada desde el editor de reglas.' : '')}
          {basedOn && <span className="mt-1 block">Basada en {basedOn.label}.</span>}
        </p>
        {editing || !template ? (
          <div className="rounded-lg border border-accent/30 bg-accent-soft px-3 py-2.5 text-xs text-ink-2">
            <div className="flex items-center gap-1.5 font-medium text-ink">
              <Pencil size={12} aria-hidden /> {template ? 'Editando las reglas' : 'Escribiendo las reglas'}
              {template && isModified(form) && <Pill tone="accent">modificadas</Pill>}
            </div>
            <p className="mt-1 text-ink-3">
              {template
                ? `Las reglas fijan ya sus valores${template.params.length ? ': los parámetros de la plantilla no se aplican' : ''}. `
                : 'Arranca con una regla mínima (el cierre frente a su SMA 50) para que la cambies entera. '}
              Se ejecutan tal y como están en el editor.
            </p>
            <button
              type="button"
              onClick={() => {
                if (isModified(form) && !window.confirm('¿Descartar los cambios en las reglas?')) return
                if (!template) toDefault()
                else set({ rules: null, loaded: null })
              }}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-ink-2 hover:text-ink"
            >
              <Undo2 size={12} /> {!template ? 'Descartar' : template.origin === 'user' ? 'Salir del editor' : 'Volver a la plantilla'}
            </button>
          </div>
        ) : (
          <>
            {template.params.map((p) =>
              p.type === 'choice' ? (
                <div key={p.name}>
                  <span className="mb-1 flex items-center gap-1.5 text-xs text-ink-2">
                    {p.label}
                    {p.description && <InfoTip text={p.description} />}
                  </span>
                  <Segmented
                    size="sm"
                    label={p.label}
                    value={form.params[p.name]}
                    options={p.choices.map((c) => ({ value: c.value, label: c.label }))}
                    onChange={(v) => set({ params: { ...form.params, [p.name]: v } })}
                  />
                </div>
              ) : (
                <Field key={p.name} label={p.label} hint={p.description} unit={p.unit}>
                  <input
                    type="number"
                    className={clsx(inputCls, 'num')}
                    value={form.params[p.name]}
                    min={p.min ?? undefined}
                    max={p.max ?? undefined}
                    step={p.type === 'int' ? 1 : 'any'}
                    onChange={(e) => set({ params: { ...form.params, [p.name]: e.target.value } })}
                  />
                </Field>
              ),
            )}
            {template.constraints.length > 0 && (
              <ul className="space-y-0.5 text-[11px] text-ink-3">
                {template.constraints.map((c) => (
                  <li key={c}>· {c}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onEdit}
                disabled={opening}
                title="Abre las reglas de la estrategia (con los valores de arriba) para cambiarlas, añadir condiciones y guardarlas como estrategia nueva"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 text-xs font-medium text-ink-2 transition-colors hover:text-ink disabled:opacity-60"
              >
                {opening ? <LoaderCircle size={13} className="animate-spin" /> : <Pencil size={13} />}
                Editar reglas
              </button>
              {template.origin === 'user' && (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={deleting}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-ink-3 transition-colors hover:text-down disabled:opacity-60"
                >
                  <Trash2 size={13} /> Borrar
                </button>
              )}
            </div>
          </>
        )}
      </Section>

      <Section title="Mercado y periodo">
        <Field label="Activo">
          <select className={inputCls} value={form.instrument} onChange={(e) => set({ instrument: e.target.value })}>
            {groups.map(([g, items]) => (
              <optgroup key={g} label={g}>
                {items.map((i) => (
                  <option key={i.key} value={i.key}>
                    {i.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <div>
          <span className="mb-1 block text-xs text-ink-2">Periodo</span>
          <Segmented size="sm" label="Periodo" value={form.preset} options={PRESETS} onChange={(v) => set({ preset: v })} />
        </div>
        {form.preset === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Desde">
              <input type="date" className={clsx(inputCls, 'num')} value={form.start} onChange={(e) => set({ start: e.target.value })} />
            </Field>
            <Field label="Hasta">
              <input type="date" className={clsx(inputCls, 'num')} value={form.end} onChange={(e) => set({ end: e.target.value })} />
            </Field>
          </div>
        )}
      </Section>

      <Section title="Ejecución">
        <div>
          <span className="mb-1 block text-xs text-ink-2">Órdenes</span>
          <Segmented
            size="sm"
            label="Ejecución de las órdenes"
            value={form.entryPoint}
            options={cat.entry_points}
            onChange={(v) => set({ entryPoint: v })}
          />
          <p className="mt-1.5 text-[11px] text-ink-3">{cat.entry_points.find((e) => e.value === form.entryPoint)?.hint}</p>
        </div>
        <Field label="Costes por lado" hint="Comisión + deslizamiento, en puntos básicos del importe operado. Se cobran en la entrada y en la salida." unit="pb">
          <input
            type="number"
            className={clsx(inputCls, 'num')}
            value={form.cost}
            min={0}
            max={cat.max_cost_bps}
            step="any"
            onChange={(e) => set({ cost: e.target.value })}
          />
        </Field>
      </Section>

      <button
        onClick={onRun}
        disabled={running}
        className={clsx(
          'inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg text-[13px] font-semibold transition-colors',
          dirty ? 'bg-accent text-canvas hover:opacity-90' : 'border border-line bg-surface-2 text-ink-2 hover:text-ink',
          running && 'cursor-progress opacity-70',
        )}
      >
        {running ? <LoaderCircle size={15} className="animate-spin" /> : <Play size={14} />}
        {running ? 'Calculando…' : dirty ? 'Ejecutar backtest' : 'Backtest ejecutado'}
      </button>
      {error && !running && <p className="text-xs text-down" role="alert">{error}</p>}
    </Card>
  )
}

// ------------------------------------------------------------------ results

const pct1 = (v: number | null | undefined) => fmtPct(v, 1)
const num2 = (v: number | null | undefined) => fmtNum(v, 2)

const METRICS: { key: keyof PerformanceSummary; label: string; fmt: (v: number | null) => string; hint: string }[] = [
  { key: 'cagr_pct', label: 'Rentabilidad anual (CAGR)', fmt: pct1, hint: 'Tasa anual compuesta entre el primer y el último día del periodo.' },
  { key: 'total_return_pct', label: 'Rentabilidad total', fmt: (v) => fmtPct(v, 0), hint: 'Del primer al último día, neta de costes.' },
  { key: 'max_drawdown_pct', label: 'Caída máxima', fmt: pct1, hint: 'La mayor caída del capital desde un máximo previo.' },
  { key: 'sharpe', label: 'Sharpe', fmt: num2, hint: 'Media / desviación de la rentabilidad diaria, anualizada (√252), sin tipo libre de riesgo. Cuenta los días en liquidez.' },
  { key: 'exposure_pct', label: 'Tiempo invertido', fmt: (v) => (v == null ? DASH : `${fmtNum(v, 0)}%`), hint: 'Porcentaje medio del capital en el mercado.' },
]

function Comparison({ r }: { r: Backtest }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {METRICS.map((m) => (
        <div key={m.key} className="card px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs text-ink-3">
            {m.label}
            <InfoTip text={m.hint} />
          </div>
          <div className="num mt-1 text-[22px] font-semibold tracking-tight">{m.fmt(r.strategy[m.key])}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
            <span className="h-[3px] w-3 rounded-full bg-ink-3" aria-hidden />
            <span className="num">{r.benchmark ? m.fmt(r.benchmark[m.key]) : DASH}</span>
            <span title={r.benchmark_label}>C&amp;M</span>
          </div>
        </div>
      ))}
    </div>
  )
}

const column = (dates: string[], values: (number | null)[]): Pt[] => dates.map((time, i) => ({ time, value: values[i] }))

type Scale = 'log' | 'linear'
const SCALES: { value: Scale; label: string }[] = [
  { value: 'log', label: 'Log' },
  { value: 'linear', label: 'Lineal' },
]

function EquityCard({ r }: { r: Backtest }) {
  const [scale, setScale] = useState<Scale>('log')
  const panes = useMemo<PaneSpec[]>(() => {
    const s = r.series
    return [
      {
        logScale: scale === 'log',
        stretch: 2.2,
        series: [
          { type: 'line', id: 'eq', label: r.strategy_label, data: column(s.dates, s.equity), color: 'var(--s1)', format: (v) => fmtNum(v, 1) },
          { type: 'line', id: 'bh', label: 'Comprar y mantener', data: column(s.dates, s.benchmark_equity), color: 'var(--ink-3)', width: 1, format: (v) => fmtNum(v, 1) },
        ],
      },
      {
        stretch: 1,
        levels: [{ value: 0 }],
        series: [
          { type: 'line', id: 'dd', label: 'Caída', data: column(s.dates, s.drawdown), color: 'var(--s1)', width: 1, format: pct1 },
          { type: 'line', id: 'dd_bh', label: 'Caída C&M', data: column(s.dates, s.benchmark_drawdown), color: 'var(--ink-3)', width: 1, format: pct1 },
        ],
      },
    ]
  }, [r, scale])
  return (
    <Card
      title="Curva de capital"
      subtitle="Base 100 el primer día, neta de costes. Abajo, la caída desde el máximo previo."
      actions={<Segmented size="sm" label="Escala" value={scale} options={SCALES} onChange={setScale} />}
    >
      <TimeChart panes={panes} height={420} />
    </Card>
  )
}

/** Series off the price scale go to a pane of their own, one per scale. */
const SCALE_PANES: { scale: SeriesScale; title: string; fmt: (v: number) => string }[] = [
  { scale: 'points', title: 'Oscilador (0–100)', fmt: (v) => fmtNum(v, 1) },
  { scale: 'percent', title: 'Porcentaje', fmt: (v) => fmtPct(v, 1) },
]

function PriceCard({ r }: { r: Backtest }) {
  const [scale, setScale] = useState<Scale>('log')
  const panes = useMemo<PaneSpec[]>(() => {
    const s = r.series
    const long = r.side === 'long'
    const markers: Marker[] = r.trades
      .flatMap((t): Marker[] => [
        { time: t.entry_date, position: long ? 'belowBar' : 'aboveBar', shape: long ? 'arrowUp' : 'arrowDown', color: 'var(--up)' },
        ...(t.outcome === 'open'
          ? []
          : [{ time: t.exit_date, position: long ? 'aboveBar' : 'belowBar', shape: long ? 'arrowDown' : 'arrowUp', color: 'var(--down)' } as Marker]),
      ])
      .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0))
    // The colour follows the series: its place in the rules, as in the editor.
    const order = new Map(r.rules.series.map((x, i) => [x.id, i]))
    const line = (o: Backtest['series']['overlays'][number], fmt: (v: number) => string): SeriesSpec => ({
      type: 'line',
      id: o.id,
      label: o.label,
      data: column(s.dates, o.values),
      color: seriesColor(order.get(o.id) ?? 0),
      width: 1,
      format: fmt,
    })
    return [
      {
        logScale: scale === 'log',
        stretch: 2.4,
        series: [
          { type: 'line', id: 'px', label: r.instrument_label, data: column(s.dates, s.price), color: 'var(--ink-2)', width: 1, markers, format: (v) => fmtLevel(v) },
          ...s.overlays.filter((o) => o.scale === 'price').map((o) => line(o, (v) => fmtLevel(v))),
        ],
      },
      ...SCALE_PANES.flatMap((p) => {
        const own = s.overlays.filter((o) => o.scale === p.scale)
        return own.length ? [{ title: p.title, stretch: 1, levels: p.scale === 'percent' ? [{ value: 0 }] : [], series: own.map((o) => line(o, p.fmt)) }] : []
      }),
    ]
  }, [r, scale])
  return (
    <Card
      title="Precio y operaciones"
      subtitle={
        <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1"><span className="text-up">▲</span> entrada</span>
          <span className="inline-flex items-center gap-1"><span className="text-down">▼</span> salida</span>
          <span>Ejecuciones en la sesión en que se llenan, no en la de la señal.</span>
        </span>
      }
      actions={<Segmented size="sm" label="Escala" value={scale} options={SCALES} onChange={setScale} />}
    >
      <TimeChart panes={panes} height={380 + (panes.length - 1) * 130} />
    </Card>
  )
}

function Row({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-line py-1.5 first:border-t-0">
      <span className="flex items-center gap-1.5 text-ink-2">
        {label}
        {hint && <InfoTip text={hint} />}
      </span>
      <span className="num font-medium text-ink">{value}</span>
    </div>
  )
}

function TradeStatsCard({ r }: { r: Backtest }) {
  const s = r.trade_stats
  return (
    <Card title="Operaciones" subtitle={`${s.n_trades} operaciones${s.n_open ? `, ${s.n_open} abierta al final` : ''}. Rentabilidades netas.`}>
      <div className="text-[13px]">
        <Row label="Ganadoras" value={s.win_rate_pct == null ? DASH : `${fmtNum(s.win_rate_pct, 0)}% (${s.n_wins})`} hint="Operaciones con rentabilidad neta positiva; la abierta cuenta a su marca." />
        <Row label="Factor de beneficio" value={num2(s.profit_factor)} hint="Suma de ganancias / suma de pérdidas, en % por operación." />
        <Row label="Media por operación" value={pct1(s.mean_return_pct)} />
        <Row label="Mediana por operación" value={pct1(s.median_return_pct)} />
        <Row label="Ganancia media" value={pct1(s.avg_win_pct)} />
        <Row label="Pérdida media" value={pct1(s.avg_loss_pct)} />
        <Row label="Duración mediana" value={s.bars_held_median == null ? DASH : `${fmtNum(s.bars_held_median, 0)} sesiones`} hint="De la señal a la salida." />
        <Row label="MFE / MAE medianos" value={`${pct1(s.mfe_median_pct)} / ${pct1(s.mae_median_pct)}`} hint="Lo mejor y lo peor que llegó a ir cada operación, en precio." />
        <Row
          label="Señales de entrada"
          value={`${r.entry_signals}`}
          hint={`Sesiones en que se cumplió la regla de entrada. ${r.skipped_in_position} con la posición ya abierta (ignoradas)${r.unfilled_signals ? `, ${r.unfilled_signals} pendiente` : ''}.`}
        />
      </div>
    </Card>
  )
}

function Signed({ v }: { v: number | null }) {
  return <span className={clsx(v != null && v > 0 && 'text-up', v != null && v < 0 && 'text-down')}>{pct1(v)}</span>
}

function YearsCard({ r }: { r: Backtest }) {
  const rows = [...r.years].reverse()
  return (
    <Card title="Año a año" subtitle="El primer y el último año pueden ser parciales." bodyClassName="p-0">
      <div className="scroll-thin max-h-[372px] overflow-auto">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 bg-surface">
            <tr className="text-[11px] text-ink-3">
              <th className="px-4 py-2 text-left font-medium">Año</th>
              <th className="px-2 py-2 text-right font-medium">Estrategia</th>
              <th className="px-2 py-2 text-right font-medium">C&amp;M</th>
              <th className="px-2 py-2 text-right font-medium" title="Estrategia menos comprar y mantener">Exceso</th>
              <th className="px-4 py-2 text-right font-medium" title="Caída máxima de la estrategia dentro del año">Caída máx.</th>
            </tr>
          </thead>
          <tbody className="num">
            {rows.map((y) => (
              <tr key={y.year} className="border-t border-line">
                <td className="px-4 py-1.5 text-ink-2">{y.year}</td>
                <td className="px-2 py-1.5 text-right"><Signed v={y.return_pct} /></td>
                <td className="px-2 py-1.5 text-right text-ink-2">{pct1(y.benchmark_pct)}</td>
                <td className="px-2 py-1.5 text-right"><Signed v={y.excess_pct} /></td>
                <td className="px-4 py-1.5 text-right text-ink-2">{pct1(y.max_drawdown_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function TradesTable({ r }: { r: Backtest }) {
  const rows = r.trades.map((t, i) => ({ ...t, n: i + 1 })).reverse()
  return (
    <Card title="Detalle de operaciones" subtitle="La más reciente primero. Precios de ejecución; rentabilidad neta de costes." bodyClassName="p-0">
      {rows.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-ink-3">Sin operaciones en el periodo.</p>
      ) : (
        <div className="scroll-thin max-h-[480px] overflow-auto">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead className="sticky top-0 bg-surface">
              <tr className="text-[11px] text-ink-3">
                <th className="px-4 py-2 text-left font-medium">#</th>
                <th className="px-2 py-2 text-left font-medium">Entrada</th>
                <th className="px-2 py-2 text-right font-medium">Precio</th>
                <th className="px-2 py-2 text-left font-medium">Salida</th>
                <th className="px-2 py-2 text-right font-medium">Precio</th>
                <th className="px-2 py-2 text-right font-medium" title="Sesiones de la señal a la salida">Sesiones</th>
                <th className="px-2 py-2 text-right font-medium">Rentabilidad</th>
                <th className="px-2 py-2 text-right font-medium" title="Lo mejor que llegó a ir (precio)">MFE</th>
                <th className="px-4 py-2 text-right font-medium" title="Lo peor que llegó a ir (precio)">MAE</th>
              </tr>
            </thead>
            <tbody className="num">
              {rows.map((t) => (
                <tr key={t.signal_date} className="border-t border-line">
                  <td className="px-4 py-1.5 text-ink-3">{t.n}</td>
                  <td className="px-2 py-1.5 text-ink-2" title={`Señal: ${fmtDate(t.signal_date)}`}>{fmtDate(t.entry_date)}</td>
                  <td className="px-2 py-1.5 text-right text-ink-2">{fmtLevel(t.entry_price)}</td>
                  <td className="px-2 py-1.5 text-ink-2">
                    {t.outcome === 'open' ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Pill tone="accent" title={`Sigue abierta: marcada al cierre del ${fmtDate(t.exit_date)}`}>Abierta</Pill>
                      </span>
                    ) : (
                      fmtDate(t.exit_date)
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right text-ink-2">{fmtLevel(t.exit_price)}</td>
                  <td className="px-2 py-1.5 text-right text-ink-2">{t.bars_held}</td>
                  <td className="px-2 py-1.5 text-right font-medium" title={`Bruta ${pct1(t.gross_return_pct)}`}>
                    <Signed v={t.return_pct} />
                  </td>
                  <td className="px-2 py-1.5 text-right text-ink-2">{pct1(t.mfe_pct)}</td>
                  <td className="px-4 py-1.5 text-right text-ink-2">{pct1(t.mae_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function Results({ r, stale }: { r: Backtest; stale: boolean }) {
  return (
    <div className={clsx('min-w-0 space-y-4', stale && 'is-stale')}>
      <div className="card px-4 py-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-[15px] font-semibold text-ink">
            {r.strategy_label} <span className="text-ink-3">·</span> {r.instrument_label}
          </h2>
          <span className="num text-xs text-ink-3">
            {fmtDate(r.start)} – {fmtDate(r.end)} · {fmtNum(r.sessions, 0)} sesiones
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-2">
          <span><span className="text-ink-3">Entrada:</span> {r.entry_text}</span>
          <span><span className="text-ink-3">Salida:</span> {r.exit_text}</span>
          <span><span className="text-ink-3">Costes:</span> <span className="num">{fmtNum(r.cost_bps, 1)}</span> pb por lado</span>
          <span><span className="text-ink-3">C&amp;M:</span> comprar y mantener {r.instrument_label}</span>
        </div>
      </div>
      <Warnings items={r.warnings} />
      <Comparison r={r} />
      <EquityCard r={r} />
      <PriceCard r={r} />
      <div className="grid gap-4 lg:grid-cols-2">
        <TradeStatsCard r={r} />
        <YearsCard r={r} />
      </div>
      <TradesTable r={r} />
      <Card title="Cómo se mide">
        <ul className="space-y-1.5 text-xs leading-relaxed text-ink-2">
          {r.conventions.map((c) => (
            <li key={c}>· {c}</li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

// ------------------------------------------------------------------ page

/** The rules the core last checked: the editor's state, settled for a moment. */
function useSettled<T>(v: T, ms = 300): T {
  const [settled, setSettled] = useState(v)
  useEffect(() => {
    const t = setTimeout(() => setSettled(v), ms)
    return () => clearTimeout(t)
  }, [v, ms])
  return settled
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

function SaveBar({
  template,
  form,
  onSaved,
}: {
  /** null: a strategy from scratch (saved with no template behind it). */
  template: StrategyTemplate | null
  form: FormState
  onSaved: (id: string) => void
}) {
  const save = useSaveStrategy()
  const [naming, setNaming] = useState(false)
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const own = template?.origin === 'user'
  const modified = isModified(form)
  const submit = async (replace: boolean) => {
    const over = replace && template ? template : null
    try {
      const saved = await save.mutateAsync({
        label: over ? over.label : label,
        description: over ? over.description : description,
        rules: form.rules!,
        based_on: !template ? null : own ? template.based_on : template.id,
        replace_id: over ? over.id : null,
      })
      setNaming(false)
      onSaved(saved.id)
    } catch {
      /* the core's words are shown below */
    }
  }
  const btn = 'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors disabled:opacity-50'
  return (
    <div className="border-t border-line pt-3.5">
      {naming ? (
        <form
          className="grid gap-2 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)_auto]"
          onSubmit={(e) => {
            e.preventDefault()
            void submit(false)
          }}
        >
          <input
            autoFocus
            className={inputCls}
            placeholder="Nombre de la estrategia"
            aria-label="Nombre de la estrategia"
            value={label}
            maxLength={80}
            onChange={(e) => setLabel(e.target.value)}
          />
          <input
            className={inputCls}
            placeholder={template ? 'Descripción (opcional): qué cambia y por qué' : 'Descripción (opcional): la idea detrás de las reglas'}
            aria-label="Descripción"
            value={description}
            maxLength={2000}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="submit" disabled={save.isPending || !label.trim()} className={clsx(btn, 'bg-accent text-canvas hover:opacity-90')}>
              {save.isPending ? <LoaderCircle size={13} className="animate-spin" /> : <Save size={13} />} Guardar
            </button>
            <button type="button" onClick={() => setNaming(false)} className={clsx(btn, 'text-ink-3 hover:text-ink')}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setLabel(!template ? '' : own ? `${template.label} (copia)` : `${template.label} · variante`)
              setDescription('')
              save.reset()
              setNaming(true)
            }}
            className={clsx(btn, 'border border-line bg-surface-2 text-ink-2 hover:text-ink')}
          >
            <Save size={13} /> {template ? 'Guardar como estrategia nueva…' : 'Guardar estrategia…'}
          </button>
          {own && template && (
            <button
              type="button"
              disabled={!modified || save.isPending}
              onClick={() => void submit(true)}
              title={modified ? `Sobrescribe «${template.label}»` : 'Sin cambios que guardar'}
              className={clsx(btn, modified ? 'bg-accent text-canvas hover:opacity-90' : 'border border-line text-ink-3')}
            >
              {save.isPending ? <LoaderCircle size={13} className="animate-spin" /> : <Save size={13} />} Guardar cambios
            </button>
          )}
          <span className="text-[11px] text-ink-3">Se guarda como YAML en el core (config/strategy_lab/user/).</span>
        </div>
      )}
      {save.isError && (
        <p className="mt-2 text-xs text-down" role="alert">
          {errorText(save.error)}
        </p>
      )}
    </div>
  )
}

function Lab({ cat }: { cat: StrategyLabCatalog }) {
  const [form, setForm] = useState<FormState>(() => initialForm(cat))
  const template = form.strategy === NEW ? null : (cat.strategies.find((s) => s.id === form.strategy) ?? cat.strategies[0])
  const current = useMemo(() => toRequest(form, template), [form, template])
  const [submitted, setSubmitted] = useState<BacktestRequest>(current)
  const q = useBacktest(submitted)

  // The last result that came back keeps showing (dimmed) while a run is in
  // flight or after one the core refused.
  const [shown, setShown] = useState<Backtest | null>(null)
  if (q.data && !q.isPlaceholderData && q.data !== shown) setShown(q.data)

  // The editor's rules, checked by the core as they are typed (names,
  // sentences, refusals in words). The last good check keeps the names.
  const settled = useSettled(form.rules)
  const check = useRulesPreview(settled ? { rules: settled } : null)
  const [checked, setChecked] = useState<RulesPreview | undefined>(undefined)
  if (check.data && !check.isPlaceholderData && check.data !== checked) setChecked(check.data)
  const checking = form.rules !== settled || check.isFetching

  const [opening, setOpening] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)
  const onNew = () => {
    if (isModified(form) && !window.confirm('Hay cambios en las reglas sin guardar. ¿Descartarlos?')) return
    const starter = cat.vocabulary.starter
    setOpenError(null)
    setForm((f) => ({ ...f, strategy: NEW, params: {}, rules: starter, loaded: starter }))
  }
  const onEdit = async () => {
    if (!template) return
    setOpening(true)
    setOpenError(null)
    try {
      const params = toRequest({ ...form, rules: null }, template).params
      const r = await fetchRules({ strategy: template.id, params })
      setChecked(r)
      setForm((f) => ({ ...f, rules: r.rules, loaded: r.rules }))
    } catch (e) {
      setOpenError(errorText(e))
    } finally {
      setOpening(false)
    }
  }

  const del = useDeleteStrategy()
  const onDelete = () => {
    if (!template || !window.confirm(`¿Borrar «${template.label}»? Se elimina su fichero del core.`)) return
    del.mutate(template.id, {
      onSuccess: () => {
        const t = cat.strategies.find((s) => s.id === cat.default_strategy) ?? cat.strategies[0]
        setForm((f) => ({ ...f, strategy: t.id, params: paramDefaults(t), rules: null, loaded: null }))
      },
    })
  }

  const dirty = JSON.stringify(current) !== JSON.stringify(submitted)
  const panelError = q.isError ? errorText(q.error) : openError ?? (del.isError ? errorText(del.error) : null)
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-4">
        <DefinitionPanel
          cat={cat}
          form={form}
          setForm={setForm}
          template={template}
          dirty={dirty}
          running={q.isFetching}
          error={panelError}
          onRun={() => setSubmitted(current)}
          onEdit={() => void onEdit()}
          opening={opening}
          onDelete={onDelete}
          deleting={del.isPending}
          onNew={onNew}
        />
      </div>
      <div className="min-w-0 space-y-4">
        <Warnings items={cat.warnings} />
        {form.rules && (
          <Card
            title={template ? 'Reglas' : `Reglas · ${NEW_LABEL.toLowerCase()}`}
            subtitle={
              !template
                ? 'Desde cero: elige las series que miran las reglas y escribe la entrada y la salida con condiciones y grupos. El core las comprueba y las redacta mientras editas.'
                : template.origin === 'user'
                  ? `«${template.label}». Cambia series y condiciones; el core las comprueba y las redacta mientras editas.`
                  : `Basadas en ${template.label}. Cambia, añade o quita series y condiciones; el core las comprueba y las redacta mientras editas.`
            }
            actions={!template ? <Pill tone="accent">sin guardar</Pill> : isModified(form) ? <Pill tone="accent">modificadas</Pill> : <Pill>sin cambios</Pill>}
          >
            <div className="space-y-3.5">
              <RulesEditor
                vocab={cat.vocabulary}
                rules={form.rules}
                onChange={(rules) => setForm((f) => ({ ...f, rules }))}
                preview={checked}
                error={!checking && check.isError ? errorText(check.error) : null}
                checking={checking}
              />
              <SaveBar
                template={template}
                form={form}
                onSaved={(id) => setForm((f) => ({ ...f, strategy: id, params: {}, loaded: f.rules }))}
              />
            </div>
          </Card>
        )}
        {q.isError && <ErrorState error={q.error} />}
        {shown ? (
          <Results r={shown} stale={q.isFetching || q.isError || dirty} />
        ) : q.isError ? null : (
          <div className="space-y-4">
            <Skeleton className="h-[84px]" />
            <Skeleton className="h-[96px]" />
            <Skeleton className="h-[460px]" />
          </div>
        )}
      </div>
    </div>
  )
}

function strategyCount(cat: StrategyLabCatalog): string {
  const own = cat.strategies.filter((s) => s.origin === 'user').length
  const builtin = cat.strategies.length - own
  const t = `${builtin} plantilla${builtin === 1 ? '' : 's'}`
  return own ? `${t} · ${own} propia${own === 1 ? '' : 's'}` : t
}

export function StrategyLabPage() {
  const cat = useStrategyLabCatalog()
  return (
    <>
      <PageHeader
        eyebrow="Laboratorio"
        title="Strategy Lab"
        subtitle="Estrategias definidas por reglas y su backtest frente a comprar y mantener el mismo activo."
      >
        <Pill tone="neutral" title="Plantillas del core y estrategias guardadas desde el editor de reglas">
          <FlaskConical size={12} aria-hidden /> {cat.data ? strategyCount(cat.data) : '…'}
        </Pill>
      </PageHeader>
      {cat.isError ? <ErrorState error={cat.error} /> : cat.data ? <Lab cat={cat.data} /> : <Skeleton className="h-[480px]" />}
    </>
  )
}
