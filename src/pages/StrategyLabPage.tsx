import clsx from 'clsx'
import { FlaskConical, LoaderCircle, Play } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { TimeChart, type Marker, type PaneSpec, type Pt } from '../components/charts/TimeChart'
import { Card, ErrorState, InfoTip, PageHeader, Pill, Segmented, Skeleton, Warnings } from '../components/ui'
import { useBacktest, useStrategyLabCatalog } from '../lib/api'
import { DASH, fmtDate, fmtLevel, fmtNum, fmtPct } from '../lib/format'
import type {
  Backtest,
  BacktestRequest,
  EntryPoint,
  ParamValue,
  PerformanceSummary,
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

interface FormState {
  strategy: string
  params: Record<string, string>
  instrument: string
  preset: Preset
  start: string
  end: string
  entryPoint: EntryPoint
  cost: string
}

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
  }
}

/** Numbers travel as numbers; anything else as typed, for the core to refuse in words. */
function value(raw: string, numeric: boolean): ParamValue {
  if (!numeric) return raw
  const n = Number(raw)
  return raw.trim() !== '' && Number.isFinite(n) ? n : raw
}

function toRequest(f: FormState, t: StrategyTemplate): BacktestRequest {
  const span = f.preset === 'custom' ? { start: f.start, end: f.end }
    : f.preset === 'all' ? { start: ALL_HISTORY, end: today() }
    : { start: yearsAgo(Number(f.preset)), end: today() }
  const cost = Number(f.cost)
  return {
    strategy: f.strategy,
    params: Object.fromEntries(t.params.map((p) => [p.name, value(f.params[p.name] ?? String(p.default), p.type !== 'choice')])),
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-line pt-4 first:border-t-0 first:pt-0">
      <div className="eyebrow mb-3">{title}</div>
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
}: {
  cat: StrategyLabCatalog
  form: FormState
  setForm: (f: FormState) => void
  template: StrategyTemplate
  dirty: boolean
  running: boolean
  /** The core's refusal of the last run, in its words. */
  error: string | null
  onRun: () => void
}) {
  const groups = useMemo(() => {
    const out = new Map<string, StrategyLabCatalog['instruments']>()
    for (const i of cat.instruments) out.set(i.group, [...(out.get(i.group) ?? []), i])
    return [...out.entries()]
  }, [cat.instruments])
  const set = (patch: Partial<FormState>) => setForm({ ...form, ...patch })

  return (
    <Card bodyClassName="space-y-4 p-4">
      <Section title="Estrategia">
        <Field label="Plantilla">
          <select
            className={inputCls}
            value={form.strategy}
            onChange={(e) => {
              const t = cat.strategies.find((s) => s.id === e.target.value)!
              set({ strategy: t.id, params: paramDefaults(t) })
            }}
          >
            {cat.strategies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-xs leading-relaxed text-ink-3">{template.description || template.summary}</p>
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

const OVERLAY_COLORS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)']

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
    return [
      {
        logScale: scale === 'log',
        series: [
          { type: 'line', id: 'px', label: r.instrument_label, data: column(s.dates, s.price), color: 'var(--ink-2)', width: 1, markers, format: (v) => fmtLevel(v) },
          ...s.overlays.map((o, i) => ({
            type: 'line' as const,
            id: o.id,
            label: o.label,
            data: column(s.dates, o.values),
            color: OVERLAY_COLORS[i % OVERLAY_COLORS.length],
            width: 1 as const,
            format: (v: number) => fmtLevel(v),
          })),
        ],
      },
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
      <TimeChart panes={panes} height={380} />
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

function Lab({ cat }: { cat: StrategyLabCatalog }) {
  const [form, setForm] = useState<FormState>(() => initialForm(cat))
  const template = cat.strategies.find((s) => s.id === form.strategy) ?? cat.strategies[0]
  const current = useMemo(() => toRequest(form, template), [form, template])
  const [submitted, setSubmitted] = useState<BacktestRequest>(current)
  const q = useBacktest(submitted)

  // The last result that came back keeps showing (dimmed) while a run is in
  // flight or after one the core refused.
  const [shown, setShown] = useState<Backtest | null>(null)
  if (q.data && !q.isPlaceholderData && q.data !== shown) setShown(q.data)

  const dirty = JSON.stringify(current) !== JSON.stringify(submitted)
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
          error={q.isError ? (q.error instanceof Error ? q.error.message : String(q.error)) : null}
          onRun={() => setSubmitted(current)}
        />
      </div>
      <div className="min-w-0 space-y-4">
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

export function StrategyLabPage() {
  const cat = useStrategyLabCatalog()
  return (
    <>
      <PageHeader
        eyebrow="Laboratorio"
        title="Strategy Lab"
        subtitle="Estrategias definidas por reglas y su backtest frente a comprar y mantener el mismo activo."
      >
        <Pill tone="neutral" title="Por ahora, plantillas con parámetros. Próximo paso: componer reglas nuevas.">
          <FlaskConical size={12} aria-hidden /> {cat.data ? `${cat.data.strategies.length} plantilla${cat.data.strategies.length === 1 ? '' : 's'}` : '…'}
        </Pill>
      </PageHeader>
      {cat.isError ? <ErrorState error={cat.error} /> : cat.data ? <Lab cat={cat.data} /> : <Skeleton className="h-[480px]" />}
    </>
  )
}
