import clsx from 'clsx'
import { FlaskConical, LoaderCircle, Pencil, Play, Plus, Save, Trash2, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { BacktestResults } from '../components/strategy/BacktestResults'
import { Field } from '../components/strategy/form'
import { RulesEditor } from '../components/strategy/RulesEditor'
import { Card, ErrorState, InfoTip, PageHeader, Pill, Segmented, Skeleton, Warnings } from '../components/ui'
import { fetchRules, useBacktest, useDeleteStrategy, useRulesPreview, useSaveStrategy, useStrategyLabCatalog } from '../lib/api'
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
import type { Backtest, BacktestRequest, Composition, EntryPoint, RulesPreview, StrategyLabCatalog, StrategyTemplate } from '../lib/types'

// ------------------------------------------------------------------ form

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
          <BacktestResults r={shown} stale={q.isFetching || q.isError || dirty} />
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
