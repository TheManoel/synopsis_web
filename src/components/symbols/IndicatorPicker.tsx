import clsx from 'clsx'
import { AlertTriangle, Loader2, Plus, RotateCcw, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { splitSpec, type ActiveIndicator } from '../../lib/chartPrefs'
import type { IndicatorCatalog, IndicatorDef } from '../../lib/types'

function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return { open, setOpen, ref }
}

/** Parameter form of one indicator: the values travel as a spec, the core validates them. */
function ParamsForm({ def, spec, onApply }: { def: IndicatorDef; spec: string; onApply: (spec: string) => void }) {
  const current = splitSpec(spec).values
  const [values, setValues] = useState(def.params.map((p, i) => current[i] ?? String(p.default)))
  return (
    <form
      className="space-y-2.5"
      onSubmit={(e) => {
        e.preventDefault()
        onApply(values.length ? `${def.id}:${values.join(',')}` : def.id)
      }}
    >
      <p className="text-[11px] leading-snug text-ink-3">{def.description}</p>
      {def.params.map((p, i) => (
        <label key={p.key} className="flex items-center justify-between gap-3 text-xs text-ink-2">
          {p.label}
          {p.kind === 'choice' ? (
            <select
              value={values[i]}
              onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
              className="h-8 rounded-lg border border-line bg-surface-2 px-2 text-xs text-ink"
            >
              {p.choices.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="number"
              value={values[i]}
              min={p.min ?? undefined}
              max={p.max ?? undefined}
              step={p.step ?? (p.kind === 'int' ? 1 : 0.1)}
              onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
              className="num h-8 w-24 rounded-lg border border-line bg-surface-2 px-2 text-right text-xs text-ink"
            />
          )}
        </label>
      ))}
      <button type="submit" className="w-full rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-canvas hover:opacity-90">
        Aplicar
      </button>
    </form>
  )
}

export interface ChipState {
  label: string
  loading: boolean
  error: string | null
  color: string | null
}

function Chip({
  ind,
  def,
  state,
  onReplace,
  onRemove,
}: {
  ind: ActiveIndicator
  def: IndicatorDef | undefined
  state: ChipState
  onReplace: (spec: string) => void
  onRemove: () => void
}) {
  const pop = usePopover()
  return (
    <div ref={pop.ref} className="relative">
      <div
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-2 pr-1 text-[11px]',
          state.error ? 'border-down/40 bg-down-soft text-ink-2' : 'border-line bg-surface-2 text-ink-2',
        )}
        title={state.error ?? def?.description}
      >
        {state.color && <span className="h-[3px] w-2.5 rounded-full" style={{ background: state.color }} aria-hidden />}
        {state.loading && <Loader2 size={11} className="animate-spin text-ink-3" aria-label="Cargando" />}
        {state.error && <AlertTriangle size={11} className="text-down" aria-label={state.error} />}
        <button onClick={() => pop.setOpen((o) => !o)} className="font-medium hover:text-ink" disabled={!def?.params.length}>
          {state.label}
        </button>
        <button onClick={onRemove} className="rounded-full p-0.5 text-ink-3 hover:bg-surface-3 hover:text-down" aria-label={`Quitar ${state.label}`}>
          <X size={11} />
        </button>
      </div>
      {pop.open && def && (
        <div className="card absolute left-0 top-[calc(100%+6px)] z-30 w-[260px] p-3">
          <div className="mb-2 text-[12px] font-semibold text-ink">{def.label}</div>
          {state.error && <p className="mb-2 text-[11px] text-down">{state.error}</p>}
          <ParamsForm
            def={def}
            spec={ind.spec}
            onApply={(s) => {
              onReplace(s)
              pop.setOpen(false)
            }}
          />
        </div>
      )}
    </div>
  )
}

export function IndicatorBar({
  catalog,
  active,
  states,
  onAdd,
  onReplace,
  onRemove,
  onReset,
}: {
  catalog: IndicatorCatalog
  active: ActiveIndicator[]
  states: Record<string, ChipState>
  onAdd: (spec: string) => void
  onReplace: (uid: string, spec: string) => void
  onRemove: (uid: string) => void
  onReset: () => void
}) {
  const pop = usePopover()
  const [filter, setFilter] = useState('')
  const defs = new Map(catalog.groups.flatMap((g) => g.indicators).map((d) => [d.id, d]))
  const f = filter.trim().toLowerCase()
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div ref={pop.ref} className="relative">
        <button
          onClick={() => pop.setOpen((o) => !o)}
          aria-expanded={pop.open}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-2 hover:text-ink"
        >
          <SlidersHorizontal size={13} /> Indicadores
        </button>
        {pop.open && (
          <div className="card absolute left-0 top-[calc(100%+6px)] z-30 w-[340px] p-2">
            <input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar indicadores…"
              className="mb-1 h-8 w-full rounded-lg border border-line bg-surface-2 px-2.5 text-xs text-ink outline-none placeholder:text-ink-3"
            />
            <div className="scroll-thin max-h-[420px] overflow-y-auto">
              {catalog.groups.map((g) => {
                const items = g.indicators.filter((d) => !f || d.label.toLowerCase().includes(f) || d.description.toLowerCase().includes(f))
                if (!items.length) return null
                return (
                  <div key={g.title} className="py-1">
                    <div className="eyebrow px-2 py-1">{g.title}</div>
                    {items.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => onAdd(d.default_spec)}
                        className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2"
                      >
                        <Plus size={13} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
                        <span className="min-w-0">
                          <span className="block text-xs font-medium text-ink">
                            {d.label}
                            <span className="ml-1.5 text-[10px] font-normal text-ink-3">
                              {d.placement === 'overlay' ? 'sobre el precio' : 'panel propio'}
                            </span>
                          </span>
                          <span className="block text-[11px] leading-snug text-ink-3">{d.description}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
            <button
              onClick={() => {
                onReset()
                pop.setOpen(false)
              }}
              className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-ink-3 hover:bg-surface-2 hover:text-ink-2"
            >
              <RotateCcw size={12} /> Volver a los indicadores por defecto
            </button>
          </div>
        )}
      </div>
      {active.map((ind) => (
        <Chip
          key={ind.uid}
          ind={ind}
          def={defs.get(splitSpec(ind.spec).id)}
          state={states[ind.uid] ?? { label: ind.spec, loading: true, error: null, color: null }}
          onReplace={(s) => onReplace(ind.uid, s)}
          onRemove={() => onRemove(ind.uid)}
        />
      ))}
    </div>
  )
}
