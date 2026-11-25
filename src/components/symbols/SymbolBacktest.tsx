import clsx from 'clsx'
import { ArrowUpRight, LoaderCircle, Play } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useBacktest, useStrategyLabCatalog } from '../../lib/api'
import type { Backtest, BacktestRequest, EntryPoint, StrategyLabCatalog, StrategyTemplate } from '../../lib/types'
import { BacktestResults } from '../strategy/BacktestResults'
import { DiagnosisPanel } from '../strategy/DiagnosisPanel'
import { Field } from '../strategy/form'
import { defaultWindow, inputCls, paramDefaults, paramValue, presetSpan, today, yearsAgo, type Preset, type Window } from '../../lib/strategyForm'
import { Card, ErrorState, InfoTip, Segmented, Skeleton, Warnings } from '../ui'

/**
 * A strategy of the Strategy Lab (a template or a saved one) backtested on the
 * symbol of the page, and the analysis of why it did (not) signal in a window.
 * The settings follow the user from symbol to symbol (localStorage); the rules
 * are written in the Strategy Lab.
 */

const PREFS_KEY = 'synopsis.symbols.backtest'

const PRESETS: { value: Preset; label: string; hint: string }[] = [
  { value: '5', label: '5A', hint: 'Últimos 5 años' },
  { value: '10', label: '10A', hint: 'Últimos 10 años' },
  { value: '20', label: '20A', hint: 'Últimos 20 años' },
  { value: 'all', label: 'Todo', hint: 'Todo el histórico disponible del activo' },
  { value: 'custom', label: 'Fechas', hint: 'Elegir inicio y fin' },
]

interface Settings {
  strategy: string
  params: Record<string, string>
  preset: Preset
  start: string
  end: string
  entryPoint: EntryPoint
  cost: string
}

function initial(cat: StrategyLabCatalog): Settings {
  const fallback = cat.strategies.find((s) => s.id === cat.default_strategy) ?? cat.strategies[0]
  const base: Settings = {
    strategy: fallback.id,
    params: paramDefaults(fallback),
    preset: '10',
    start: yearsAgo(10),
    end: today(),
    entryPoint: cat.default_entry_point,
    cost: String(cat.default_cost_bps),
  }
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Partial<Settings> | null
    if (!saved) return base
    // A strategy deleted since: back to the default one.
    const t = cat.strategies.find((s) => s.id === saved.strategy)
    return t
      ? { ...base, ...saved, params: { ...paramDefaults(t), ...saved.params } }
      : { ...base, ...saved, strategy: base.strategy, params: base.params }
  } catch {
    return base
  }
}

/** The request without the instrument: the page's symbol is added on use. */
type Run = Omit<BacktestRequest, 'instrument'>

function toRun(s: Settings, t: StrategyTemplate): Run {
  const cost = Number(s.cost)
  return {
    strategy: t.id,
    params: Object.fromEntries(t.params.map((p) => [p.name, paramValue(s.params[p.name] ?? String(p.default), p.type !== 'choice')])),
    ...presetSpan(s.preset, s.start, s.end),
    entry_point: s.entryPoint,
    cost_bps: s.cost.trim() !== '' && Number.isFinite(cost) ? cost : NaN,
  }
}

function Form({
  cat,
  s,
  set,
  template,
  dirty,
  running,
  onRun,
}: {
  cat: StrategyLabCatalog
  s: Settings
  set: (patch: Partial<Settings>) => void
  template: StrategyTemplate
  dirty: boolean
  running: boolean
  onRun: () => void
}) {
  const builtin = cat.strategies.filter((t) => t.origin === 'builtin')
  const own = cat.strategies.filter((t) => t.origin === 'user')
  return (
    <Card
      title="Backtest de una estrategia"
      subtitle="Una plantilla o una estrategia guardada del Strategy Lab, sobre este activo, frente a comprar y mantenerlo."
      actions={
        <Link to="/strategy-lab" className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-3 hover:text-ink">
          Escribir o editar reglas en el Strategy Lab <ArrowUpRight size={12} />
        </Link>
      }
    >
      <form
        className="grid gap-x-4 gap-y-3 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]"
        onSubmit={(e) => {
          e.preventDefault()
          onRun()
        }}
      >
        <div className="space-y-2">
          <Field label="Estrategia">
            <select
              className={inputCls}
              value={s.strategy}
              onChange={(e) => {
                const t = cat.strategies.find((x) => x.id === e.target.value)!
                set({ strategy: t.id, params: paramDefaults(t) })
              }}
            >
              <optgroup label="Plantillas">
                {builtin.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
              {own.length > 0 && (
                <optgroup label="Mis estrategias">
                  {own.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </Field>
          <p className="line-clamp-3 text-[11px] leading-snug text-ink-3" title={template.description || template.summary}>
            {template.summary || template.description || 'Estrategia guardada desde el editor de reglas.'}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
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
                  value={s.params[p.name]}
                  options={p.choices.map((c) => ({ value: c.value, label: c.label }))}
                  onChange={(v) => set({ params: { ...s.params, [p.name]: v } })}
                />
              </div>
            ) : (
              <div key={p.name} className="w-[120px]">
                <Field label={p.label} hint={p.description} unit={p.unit}>
                  <input
                    type="number"
                    className={clsx(inputCls, 'num')}
                    value={s.params[p.name]}
                    min={p.min ?? undefined}
                    max={p.max ?? undefined}
                    step={p.type === 'int' ? 1 : 'any'}
                    onChange={(e) => set({ params: { ...s.params, [p.name]: e.target.value } })}
                  />
                </Field>
              </div>
            ),
          )}
          <div>
            <span className="mb-1 block text-xs text-ink-2">Periodo</span>
            <Segmented size="sm" label="Periodo" value={s.preset} options={PRESETS} onChange={(v) => set({ preset: v })} />
          </div>
          {s.preset === 'custom' && (
            <>
              <div className="w-[140px]">
                <Field label="Desde">
                  <input type="date" className={clsx(inputCls, 'num')} value={s.start} onChange={(e) => set({ start: e.target.value })} />
                </Field>
              </div>
              <div className="w-[140px]">
                <Field label="Hasta">
                  <input type="date" className={clsx(inputCls, 'num')} value={s.end} onChange={(e) => set({ end: e.target.value })} />
                </Field>
              </div>
            </>
          )}
          <div>
            <span className="mb-1 flex items-center gap-1.5 text-xs text-ink-2">
              Órdenes <InfoTip text={cat.entry_points.find((e) => e.value === s.entryPoint)?.hint ?? ''} />
            </span>
            <Segmented size="sm" label="Ejecución de las órdenes" value={s.entryPoint} options={cat.entry_points} onChange={(v) => set({ entryPoint: v })} />
          </div>
          <div className="w-[110px]">
            <Field label="Costes por lado" hint="Comisión + deslizamiento, en puntos básicos del importe operado. Se cobran en la entrada y en la salida." unit="pb">
              <input type="number" className={clsx(inputCls, 'num')} value={s.cost} min={0} max={cat.max_cost_bps} step="any" onChange={(e) => set({ cost: e.target.value })} />
            </Field>
          </div>
          <button
            type="submit"
            disabled={running}
            className={clsx(
              'inline-flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold transition-colors',
              dirty ? 'bg-accent text-canvas hover:opacity-90' : 'border border-line bg-surface-2 text-ink-2 hover:text-ink',
              running && 'cursor-progress opacity-70',
            )}
          >
            {running ? <LoaderCircle size={13} className="animate-spin" /> : <Play size={13} />}
            {running ? 'Calculando…' : dirty ? 'Ejecutar backtest' : 'Ejecutado'}
          </button>
        </div>
      </form>
    </Card>
  )
}

function Lab({ cat, symbolKey }: { cat: StrategyLabCatalog; symbolKey: string }) {
  const [s, setS] = useState<Settings>(() => initial(cat))
  const set = (patch: Partial<Settings>) => setS((prev) => ({ ...prev, ...patch }))
  const template = cat.strategies.find((t) => t.id === s.strategy) ?? cat.strategies[0]
  const current = useMemo(() => toRun(s, template), [s, template])
  const [submitted, setSubmitted] = useState<Run>(current)
  // The page's symbol: changing it reruns the same settings on the new one.
  const request = useMemo<BacktestRequest>(() => ({ ...submitted, instrument: symbolKey }), [submitted, symbolKey])
  const q = useBacktest(request)

  const [shown, setShown] = useState<Backtest | null>(null)
  if (q.data && !q.isPlaceholderData && q.data !== shown) setShown(q.data)
  const fresh = shown?.instrument_key === symbolKey ? shown : null

  // The analysed window: reset to a default for every new backtest.
  const [win, setWin] = useState<{ for: Backtest; w: Window } | null>(null)
  const shownWin = fresh ? (win?.for === fresh ? win.w : defaultWindow(fresh)) : null
  const analyze = (w: Window) => {
    if (!fresh) return
    setWin({ for: fresh, w })
    requestAnimationFrame(() => document.getElementById('diagnosis')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const run = () => {
    setSubmitted(current)
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(s))
    } catch {
      /* no storage */
    }
  }
  // The analysis runs on the backtest shown, whatever the form says now.
  const ranRequest = useMemo<BacktestRequest | null>(
    () =>
      fresh && {
        strategy: fresh.strategy_id,
        params: fresh.params,
        instrument: fresh.instrument_key,
        start: fresh.start,
        end: fresh.end,
        entry_point: fresh.entry_point,
        cost_bps: fresh.cost_bps,
      },
    [fresh],
  )

  const dirty = JSON.stringify(current) !== JSON.stringify(submitted)
  return (
    <div className="space-y-4">
      <Warnings items={cat.warnings} />
      <Form cat={cat} s={s} set={set} template={template} dirty={dirty} running={q.isFetching} onRun={run} />
      {q.isError && <ErrorState error={q.error} />}
      {fresh && ranRequest && shownWin ? (
        <BacktestResults
          r={fresh}
          stale={q.isFetching || q.isError || dirty}
          onAnalyze={(start, end) => analyze({ start, end })}
          afterPrice={<DiagnosisPanel request={ranRequest} bt={fresh} win={shownWin} onWindow={analyze} />}
        />
      ) : q.isError ? null : (
        <div className="space-y-4">
          <Skeleton className="h-[84px]" />
          <Skeleton className="h-[96px]" />
          <Skeleton className="h-[460px]" />
        </div>
      )}
    </div>
  )
}

/** Only listed price instruments: a ratio or a spread has no strategy return. */
const backtestable = (key: string) => !key.startsWith('ratio:') && !key.startsWith('spread:')

export function SymbolBacktest({ symbolKey }: { symbolKey: string }) {
  const cat = useStrategyLabCatalog()
  if (!backtestable(symbolKey))
    return (
      <Card title="Backtest">
        <p className="text-xs text-ink-3">El backtest solo está disponible para instrumentos cotizados de precio, no para ratios ni diferenciales.</p>
      </Card>
    )
  if (cat.isError) return <ErrorState error={cat.error} />
  if (!cat.data) return <Skeleton className="h-[200px]" />
  return <Lab cat={cat.data} symbolKey={symbolKey} />
}
