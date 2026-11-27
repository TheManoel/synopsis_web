import clsx from 'clsx'
import { FlaskConical, LoaderCircle, Pencil, Play, Plus, Save, Trash2, Undo2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import { BacktestResults } from '../components/strategy/BacktestResults'
import { Field } from '../components/strategy/form'
import { RulesEditor } from '../components/strategy/RulesEditor'
import { UniverseBacktestResults, UniverseJobProgress } from '../components/strategy/UniverseBacktestResults'
import { UniverseScreenResults } from '../components/strategy/UniverseScreenResults'
import { Card, ErrorState, InfoTip, PageHeader, Pill, Segmented, Skeleton, Warnings } from '../components/ui'
import {
  cancelUniverseJob,
  cancelUniverseScreen,
  fetchRules,
  useBacktest,
  useDeleteStrategy,
  useLabUniverses,
  useRulesPreview,
  useSaveStrategy,
  useStartUniverseBacktest,
  useStartUniverseScreen,
  useStrategyLabCatalog,
  useUniverseJob,
  useUniverseScreenJob,
} from '../lib/api'
import {
  errorText,
  inputCls,
  paramDefaults,
  paramValue,
  presetSpan,
  PRESETS,
  today,
  yearsAgo,
  type Preset,
} from '../lib/strategyForm'
import type {
  Backtest,
  BacktestRequest,
  Composition,
  EntryPoint,
  JobState,
  LabUniverse,
  LabUniverses,
  RulesPreview,
  StrategyLabCatalog,
  StrategyTemplate,
  UniverseBacktestRequest,
  UniverseScreenRequest,
} from '../lib/types'

// ------------------------------------------------------------------ form

/** `form.strategy` of a strategy written from scratch, not yet saved. */
const NEW = '__new__'
const NEW_LABEL = 'Estrategia nueva'

/** One instrument, or every member of a universe as one portfolio. */
type Scope = 'asset' | 'universe'
const SCOPES: { value: Scope; label: string; hint: string }[] = [
  { value: 'asset', label: 'Un activo', hint: 'Backtest en un solo activo frente a comprarlo y mantenerlo' },
  { value: 'universe', label: 'Universo', hint: 'Todos los valores de un universo (región, índice, sectores o industrias) como una cartera de N huecos' },
]

/** A backtest of the past, or a screen of the last session (signals now). */
type Mode = 'backtest' | 'screen'
const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: 'backtest', label: 'Backtest', hint: 'Cómo le habría ido a la estrategia en el pasado' },
  { value: 'screen', label: 'Screener', hint: 'Qué valores de un universo dan hoy la señal de entrada' },
]

interface FormState {
  /** A catalog id, or NEW (then `rules` holds the strategy). */
  strategy: string
  params: Record<string, string>
  mode: Mode
  /** Screener: the entry rule counts if it held in the last N sessions. */
  lookback: string
  /** Screener: add Yahoo's current (delayed) quote to the stored bars. */
  live: boolean
  scope: Scope
  instrument: string
  /** An instrument opened from a universe's table, outside the market catalog. */
  extraInstrument: { key: string; label: string } | null
  universe: string
  sectors: string[]
  industries: string[]
  slots: string
  draws: string
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

function initialForm(cat: StrategyLabCatalog): FormState {
  const t = cat.strategies.find((s) => s.id === cat.default_strategy) ?? cat.strategies[0]
  return {
    strategy: t.id,
    params: paramDefaults(t),
    mode: 'backtest',
    lookback: '1',
    live: true,
    scope: 'asset',
    instrument: cat.default_instrument,
    extraInstrument: null,
    universe: '',
    sectors: [],
    industries: [],
    slots: '',
    draws: '',
    preset: '30',
    start: yearsAgo(30),
    end: today(),
    entryPoint: cat.default_entry_point,
    cost: String(cat.default_cost_bps),
    rules: null,
    loaded: null,
  }
}

function toRequest(f: FormState, t: StrategyTemplate | null): BacktestRequest {
  const span = presetSpan(f.preset, f.start, f.end)
  const cost = Number(f.cost)
  const what: Pick<BacktestRequest, 'strategy' | 'params' | 'rules' | 'label'> = f.rules
    ? { rules: f.rules, label: !t ? NEW_LABEL : isModified(f) ? `${t.label} (modificada)` : t.label }
    : {
        strategy: f.strategy,
        params: Object.fromEntries((t?.params ?? []).map((p) => [p.name, paramValue(f.params[p.name] ?? String(p.default), p.type !== 'choice')])),
      }
  return {
    ...what,
    instrument: f.instrument,
    ...span,
    entry_point: f.entryPoint,
    cost_bps: f.cost.trim() !== '' && Number.isFinite(cost) ? cost : NaN,
  }
}

const numberOr = (raw: string, fallback: number) => {
  const n = Number(raw)
  return raw.trim() === '' ? fallback : Number.isFinite(n) ? n : NaN
}

function toUniverseRequest(f: FormState, t: StrategyTemplate | null, u: LabUniverses): UniverseBacktestRequest {
  const { instrument: _, ...base } = toRequest(f, t)
  return {
    ...base,
    universe: f.universe || u.default_universe,
    sectors: f.sectors,
    industries: f.industries,
    slots: numberOr(f.slots, u.default_slots),
    draws: numberOr(f.draws, u.default_draws),
  }
}

function toScreenRequest(f: FormState, t: StrategyTemplate | null, u: LabUniverses): UniverseScreenRequest {
  const { strategy, params, rules, label } = toRequest(f, t)
  return {
    strategy,
    params,
    rules,
    label,
    universe: f.universe || u.default_universe,
    sectors: f.sectors,
    industries: f.industries,
    lookback: numberOr(f.lookback, 1),
    live: f.live,
  }
}

const PRICES: { value: 'live' | 'stored'; label: string; hint: string }[] = [
  { value: 'live', label: 'Precio actual', hint: 'Lo guardado más la sesión de hoy de Yahoo (diferido): con el mercado abierto, la señal es provisional' },
  { value: 'stored', label: 'Último cierre', hint: 'Solo los cierres guardados en la base' },
]

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

/** Which members: a universe, narrowed optionally to sectors and industries. */
function UniversePicker({ u, form, set }: { u: LabUniverses; form: FormState; set: (patch: Partial<FormState>) => void }) {
  const universe: LabUniverse = u.universes.find((x) => x.code === (form.universe || u.default_universe)) ?? u.universes[0]
  const sectorName = new Map(universe.sectors.map((f) => [f.code, f.name]))
  const industries = universe.industries.filter((f) => !form.sectors.length || (f.sector_code && form.sectors.includes(f.sector_code)))
  const industryName = new Map(universe.industries.map((f) => [f.code, f.name]))
  const toggleSector = (code: string) => {
    const sectors = form.sectors.includes(code) ? form.sectors.filter((c) => c !== code) : [...form.sectors, code]
    // An industry outside the sectors left would select nothing: it goes.
    const keep = universe.industries.filter((f) => !sectors.length || (f.sector_code && sectors.includes(f.sector_code))).map((f) => f.code)
    set({ sectors, industries: form.industries.filter((c) => keep.includes(c)) })
  }
  const chip = 'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium transition-colors'
  return (
    <>
      <Field label="Universo">
        <select
          className={inputCls}
          value={universe.code}
          onChange={(e) => set({ universe: e.target.value, sectors: [], industries: [] })}
        >
          <optgroup label="Regiones (todas las acciones)">
            {u.universes.filter((x) => x.kind === 'region').map((x) => (
              <option key={x.code} value={x.code}>
                {x.label} · {x.n_members.toLocaleString('es-ES')} acciones
              </option>
            ))}
          </optgroup>
          <optgroup label="Índices">
            {u.universes.filter((x) => x.kind === 'index').map((x) => (
              <option key={x.code} value={x.code}>
                {x.label} · {x.n_members.toLocaleString('es-ES')} miembros
              </option>
            ))}
          </optgroup>
        </select>
      </Field>
      <p className="text-[11px] leading-relaxed text-ink-3">
        {universe.membership_note} Referencia: {universe.benchmark_label ?? '—'}.
      </p>
      <div>
        <span className="mb-1 flex items-center justify-between text-xs text-ink-2">
          Sectores
          {form.sectors.length > 0 && (
            <button type="button" onClick={() => set({ sectors: [], industries: [] })} className="text-[11px] text-ink-3 hover:text-ink">
              Todos
            </button>
          )}
        </span>
        <div className="flex flex-wrap gap-1">
          {universe.sectors.filter((f) => f.code !== 'UNKNOWN').map((f) => {
            const on = form.sectors.includes(f.code)
            return (
              <button
                key={f.code}
                type="button"
                aria-pressed={on}
                title={`${f.n_members} valores`}
                onClick={() => toggleSector(f.code)}
                className={clsx(chip, on ? 'border-accent/40 bg-accent-soft text-ink' : 'border-line bg-surface-2 text-ink-3 hover:text-ink-2')}
              >
                {f.name}
              </button>
            )
          })}
        </div>
        {!form.sectors.length && <p className="mt-1 text-[11px] text-ink-3">Ninguno marcado: todo el universo.</p>}
      </div>
      <Field label="Industrias">
        <select
          className={inputCls}
          value=""
          onChange={(e) => e.target.value && set({ industries: [...form.industries, e.target.value] })}
        >
          <option value="">{form.industries.length ? 'Añadir otra industria…' : 'Todas (o elige una o varias)…'}</option>
          {industries
            .filter((f) => f.code !== 'UNKNOWN' && !form.industries.includes(f.code))
            .map((f) => (
              <option key={f.code} value={f.code}>
                {f.name} · {f.n_members}
              </option>
            ))}
        </select>
      </Field>
      {form.industries.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {form.industries.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => set({ industries: form.industries.filter((x) => x !== c) })}
              className={clsx(chip, 'border-accent/40 bg-accent-soft text-ink')}
              title="Quitar"
            >
              {industryName.get(c) ?? c} <X size={11} aria-hidden />
            </button>
          ))}
        </div>
      )}
      {form.sectors.length > 0 && form.industries.length > 0 && (
        <p className="text-[11px] text-ink-3">
          Valores de {form.sectors.map((c) => sectorName.get(c) ?? c).join(', ')} que además están en las industrias elegidas.
        </p>
      )}
    </>
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
  universes,
}: {
  cat: StrategyLabCatalog
  /** The universes a strategy can run on (loaded apart: undefined while loading). */
  universes: LabUniverses | undefined
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

  const screen = form.mode === 'screen'
  return (
    <Card bodyClassName="space-y-4 p-4">
      <div className="[&>div]:flex [&>div]:w-full [&_button]:flex-1">
        <Segmented label="Qué hacer" value={form.mode} options={MODES} onChange={(v) => set({ mode: v })} />
      </div>
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

      {screen ? (
        <Section title="Universo y señal">
          {universes ? <UniversePicker u={universes} form={form} set={set} /> : <Skeleton className="h-[120px]" />}
          <Field label="Señal en las últimas" unit="sesiones" hint="1 = solo la última sesión. Con más, entra también quien dio la señal hace unos días (la tabla dice cuándo).">
            <input
              type="number"
              className={clsx(inputCls, 'num')}
              value={form.lookback}
              min={1}
              max={universes?.max_lookback}
              step={1}
              onChange={(e) => set({ lookback: e.target.value })}
            />
          </Field>
          <div>
            <span className="mb-1 block text-xs text-ink-2">Precios</span>
            <Segmented size="sm" label="Precios" value={form.live ? 'live' : 'stored'} options={PRICES} onChange={(v) => set({ live: v === 'live' })} />
            <p className="mt-1.5 text-[11px] text-ink-3">{PRICES.find((p) => p.value === (form.live ? 'live' : 'stored'))?.hint}.</p>
          </div>
        </Section>
      ) : (
        <Section title="Mercado y periodo">
          <Segmented size="sm" label="Ámbito" value={form.scope} options={SCOPES} onChange={(v) => set({ scope: v })} />
          {form.scope === 'asset' ? (
            <Field label="Activo">
              <select className={inputCls} value={form.instrument} onChange={(e) => set({ instrument: e.target.value })}>
                {form.extraInstrument && (
                  <optgroup label="Abierto desde un universo">
                    <option value={form.extraInstrument.key}>{form.extraInstrument.label}</option>
                  </optgroup>
                )}
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
          ) : universes ? (
            <UniversePicker u={universes} form={form} set={set} />
          ) : (
            <Skeleton className="h-[120px]" />
          )}
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
      )}

      {!screen && (
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
          {form.scope === 'universe' && universes && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Huecos" hint="Posiciones a la vez; cada operación entra con 1/N del patrimonio. Una señal sin hueco se pierde.">
                <input
                  type="number"
                  className={clsx(inputCls, 'num')}
                  value={form.slots}
                  placeholder={String(universes.default_slots)}
                  min={1}
                  max={universes.max_slots}
                  step={1}
                  onChange={(e) => set({ slots: e.target.value })}
                />
              </Field>
              <Field label="Sorteos" hint="Los días con más señales que huecos, el orden se sortea N veces: cada cifra es la mediana, con su banda p10–p90.">
                <input
                  type="number"
                  className={clsx(inputCls, 'num')}
                  value={form.draws}
                  placeholder={String(universes.default_draws)}
                  min={1}
                  max={universes.max_draws}
                  step={1}
                  onChange={(e) => set({ draws: e.target.value })}
                />
              </Field>
            </div>
          )}
        </Section>
      )}

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
        {running ? 'Calculando…' : screen ? (dirty ? 'Buscar señales' : 'Señales buscadas') : dirty ? (form.scope === 'universe' ? 'Ejecutar en el universo' : 'Ejecutar backtest') : 'Backtest ejecutado'}
      </button>
      {error && !running && <p className="text-xs text-down" role="alert">{error}</p>}
    </Card>
  )
}

// ------------------------------------------------------------------ jobs

interface Job<R> {
  id: string
  state: JobState
  stage: string
  done: number
  total: number
  queue_position: number
  elapsed_s: number
  error: string | null
  result: R | null
}

interface JobRun<R> {
  /** The request of the job last started (what "dirty" compares against). */
  submitted: unknown
  /** Its state (the result is ``shown``). */
  job: Job<unknown> | undefined
  /** The last result that came back: it keeps showing while another runs. */
  shown: R | null
  running: boolean
  /** Starting or running. */
  busy: boolean
  /** The core's refusal of the start, in its words. */
  error: string | null
  jobError: string | null
  cancelling: boolean
  start: (req: unknown) => Promise<void>
  cancel: () => Promise<void>
}

/** A background job of the core (backtest or screen on a universe): started by
 *  a POST, polled until it ends, cancellable. */
function useJobRun<Req, J extends Job<unknown>, R = NonNullable<J['result']>>(
  startM: UseMutationResult<J, Error, Req>,
  useJobQuery: (id: string | null) => UseQueryResult<J>,
  cancelFn: (id: string) => Promise<unknown>,
): JobRun<R> {
  const [submitted, setSubmitted] = useState<Req | null>(null)
  const [id, setId] = useState<string | null>(null)
  const q = useJobQuery(id)
  const [shown, setShown] = useState<R | null>(null)
  if (q.data?.result && q.data.result !== shown) setShown(q.data.result as R)
  const running = !!id && (!q.data || q.data.state === 'queued' || q.data.state === 'running') && !q.isError
  const [cancelling, setCancelling] = useState(false)
  return {
    submitted,
    job: q.data,
    shown,
    running,
    busy: startM.isPending || running,
    error: startM.isError ? errorText(startM.error) : null,
    jobError: q.data?.state === 'failed' ? q.data.error : q.isError ? errorText(q.error) : null,
    cancelling,
    start: async (req) => {
      if (!req) return
      try {
        const j = await startM.mutateAsync(req as Req)
        setSubmitted(req as Req)
        setId(j.id)
      } catch {
        /* the core's words are shown in the panel */
      }
    },
    cancel: async () => {
      if (!id) return
      setCancelling(true)
      try {
        await cancelFn(id)
        await q.refetch()
      } finally {
        setCancelling(false)
      }
    },
  }
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

  // On a universe, backtest and screen are background jobs: started by a POST
  // and polled until they end; the last result keeps showing meanwhile.
  const universes = useLabUniverses()
  const currentU = useMemo(() => (universes.data ? toUniverseRequest(form, template, universes.data) : null), [form, template, universes.data])
  const currentS = useMemo(() => (universes.data ? toScreenRequest(form, template, universes.data) : null), [form, template, universes.data])
  const backtestRun = useJobRun(useStartUniverseBacktest(), useUniverseJob, cancelUniverseJob)
  const screenRun = useJobRun(useStartUniverseScreen(), useUniverseScreenJob, cancelUniverseScreen)
  /** A member of the universe opened as its own backtest (with its chart). */
  const openSymbol = (sym: { key: string; ticker: string; name: string }) => {
    const listed = cat.instruments.some((i) => i.key === sym.key)
    const next: FormState = {
      ...form,
      mode: 'backtest',
      scope: 'asset',
      instrument: sym.key,
      extraInstrument: listed ? null : { key: sym.key, label: `${sym.ticker} · ${sym.name}` },
    }
    setForm(next)
    setSubmitted(toRequest(next, template))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const onScreen = form.mode === 'screen'
  const onUniverse = !onScreen && form.scope === 'universe'
  const run = onScreen ? screenRun : onUniverse ? backtestRun : null
  const dirty = onScreen
    ? !same(currentS, screenRun.submitted)
    : onUniverse
      ? !same(currentU, backtestRun.submitted)
      : !same(current, submitted)
  const panelError = run ? (run.error ?? openError) : q.isError ? errorText(q.error) : (openError ?? (del.isError ? errorText(del.error) : null))
  const jobPanel = (r: JobRun<unknown>, what: string) => (
    <>
      {universes.isError && <ErrorState error={universes.error} />}
      {r.running && r.job && <UniverseJobProgress job={r.job} onCancel={() => void r.cancel()} cancelling={r.cancelling} />}
      {r.jobError && <ErrorState error={new Error(r.jobError)} />}
      {r.job?.state === 'cancelled' && <p className="text-xs text-ink-3">{what} cancelado.</p>}
    </>
  )
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-4">
        <DefinitionPanel
          cat={cat}
          universes={universes.data}
          form={form}
          setForm={setForm}
          template={template}
          dirty={dirty}
          running={run ? run.busy : q.isFetching}
          error={panelError}
          onRun={() => (onScreen ? void screenRun.start(currentS) : onUniverse ? void backtestRun.start(currentU) : setSubmitted(current))}
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
        {onScreen ? (
          <>
            {jobPanel(screenRun, 'Screener')}
            {screenRun.shown ? (
              <UniverseScreenResults r={screenRun.shown} stale={screenRun.running || dirty} onOpenSymbol={openSymbol} />
            ) : (
              !screenRun.running && (
                <Card title="Screener de un universo">
                  <p className="text-sm leading-relaxed text-ink-2">
                    Lee la regla de entrada de la estrategia en la última sesión de cada valor del universo (o en las últimas N) y
                    lista los que dan señal, con cuándo empezó y el valor de cada serie de la estrategia. Con «Precio actual» se
                    añade la sesión de hoy de Yahoo. Elige el universo y pulsa «Buscar señales»: una región entera tarda
                    alrededor de un minuto.
                  </p>
                </Card>
              )
            )}
          </>
        ) : onUniverse ? (
          <>
            {jobPanel(backtestRun, 'Backtest')}
            {backtestRun.shown ? (
              <UniverseBacktestResults r={backtestRun.shown} stale={backtestRun.running || dirty} onOpenSymbol={openSymbol} />
            ) : (
              !backtestRun.running && (
                <Card title="Backtest sobre un universo">
                  <p className="text-sm leading-relaxed text-ink-2">
                    La estrategia se ejecuta en cada valor del universo, de una operación en una, y todas sus operaciones se
                    operan como una cartera de N huecos frente al índice de referencia. Una señal solo cuenta los días en que el
                    valor era miembro. Elige el universo (y, si quieres, sectores o industrias) y pulsa «Ejecutar en el
                    universo»: una región entera tarda alrededor de un minuto.
                  </p>
                </Card>
              )
            )}
          </>
        ) : (
          <>
            {q.isError && <ErrorState error={q.error} />}
            {shown ? (
              <BacktestResults r={shown} stale={q.isFetching || q.isError || dirty} />
            ) : q.isError ? null : (
              <div className="space-y-4">
                <Skeleton className="h-[84px]" />
                <Skeleton className="h-[96px]" />
                <Skeleton className="h-[460px]" />
              </div>
            )}
          </>
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
        subtitle="Estrategias definidas por reglas y su backtest: en un activo frente a comprarlo y mantenerlo, o en un universo entero como cartera."
      >
        <Pill tone="neutral" title="Plantillas del core y estrategias guardadas desde el editor de reglas">
          <FlaskConical size={12} aria-hidden /> {cat.data ? strategyCount(cat.data) : '…'}
        </Pill>
      </PageHeader>
      {cat.isError ? <ErrorState error={cat.error} /> : cat.data ? <Lab cat={cat.data} /> : <Skeleton className="h-[480px]" />}
    </>
  )
}
