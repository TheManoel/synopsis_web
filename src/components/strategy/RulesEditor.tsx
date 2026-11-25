import clsx from 'clsx'
import { CircleCheck, LoaderCircle, Plus, Trash2, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import type {
  Combinator,
  Composition,
  ConditionOp,
  KindParam,
  Operand,
  ParamValue,
  RuleCondition,
  RuleGroup,
  RulesPreview,
  RulesVocabulary,
  Scale,
  SeriesDef,
  SeriesKind,
} from '../../lib/types'
import { seriesColor } from '../../lib/theme'
import { InfoTip, Segmented } from '../ui'

const ctl =
  'h-7 rounded-md border border-line bg-surface-2 px-2 text-[12px] text-ink outline-none transition-colors focus:border-accent'
const numCtl = clsx(ctl, 'num w-[68px]')

/** Numbers travel as numbers; anything else as typed, for the core to refuse in words. */
const asNumber = (raw: string): number | string => {
  const n = Number(raw)
  return raw.trim() !== '' && Number.isFinite(n) ? n : raw
}

const isGroup = (c: RuleCondition | RuleGroup): c is RuleGroup => 'conditions' in c

const applies = (p: KindParam, values: Record<string, ParamValue>) =>
  !p.applies_when || Object.entries(p.applies_when).every(([k, vs]) => vs.includes(String(values[k])))

/** The knobs that apply under these values (the one a detector does not use is
 *  left out), the missing ones at their defaults. In order: a knob depends on an earlier one. */
function settle(params: KindParam[], values: Record<string, ParamValue>): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {}
  for (const p of params) if (applies(p, out)) out[p.name] = values[p.name] ?? p.default
  return out
}

const defaults = (params: KindParam[]) => settle(params, {})

/** One knob of a series or a condition: a choice, or a number with its unit. */
function ParamInput({
  p,
  value,
  onChange,
  named = false,
}: {
  p: KindParam
  value: ParamValue | undefined
  onChange: (v: ParamValue) => void
  /** Says its label before the box (a condition's knobs are not obvious from the unit). */
  named?: boolean
}) {
  if (p.type === 'bool')
    return (
      <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-ink-3" title={p.label}>
        <input
          type="checkbox"
          className="accent-[var(--color-accent)]"
          aria-label={p.label}
          checked={Boolean(value ?? p.default)}
          onChange={(e) => onChange(e.target.checked)}
        />
        {p.label.toLowerCase()}
      </label>
    )
  if (p.type === 'choice')
    return (
      <select className={ctl} aria-label={p.label} title={p.label} value={String(value ?? p.default)} onChange={(e) => onChange(e.target.value)}>
        {p.choices.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    )
  return (
    <label className="flex items-center gap-1.5 text-[11px] text-ink-3" title={p.label}>
      {named && <span>{p.label.toLowerCase()}</span>}
      <input
        type="number"
        className={numCtl}
        aria-label={p.label}
        value={String(value ?? '')}
        min={p.min ?? undefined}
        max={p.max ?? undefined}
        step={p.type === 'int' ? 1 : 'any'}
        onChange={(e) => onChange(asNumber(e.target.value))}
      />
      {p.unit}
    </label>
  )
}

/** Ids the rules read: by conditions (A and B) and by series applied to others. */
function usedIds(r: Composition): Set<string> {
  const out = new Set<string>()
  const walk = (g: RuleGroup) =>
    g.conditions.forEach((c) => {
      if (isGroup(c)) return walk(c)
      out.add(c.a)
      if ('series' in c.b) out.add(c.b.series)
    })
  walk(r.entry)
  walk(r.exit)
  r.series.forEach((s) => s.of && out.add(s.of))
  return out
}

function nextId(series: SeriesDef[]): string {
  const taken = new Set(series.map((s) => s.id))
  let n = series.length + 1
  while (taken.has(`s${n}`)) n++
  return `s${n}`
}

interface Ctx {
  vocab: RulesVocabulary
  rules: Composition
  kinds: Map<string, SeriesKind>
  ops: Map<string, ConditionOp>
  label: (id: string) => string
  scale: (id: string) => Scale
}

function useCtx(vocab: RulesVocabulary, rules: Composition, preview: RulesPreview | undefined): Ctx {
  const kinds = new Map(vocab.series_kinds.map((k) => [k.kind, k]))
  const ops = new Map(vocab.conditions.map((c) => [c.op, c]))
  const byId = new Map(rules.series.map((s) => [s.id, s]))
  const named = new Map(preview?.series.map((s) => [s.id, s.label]))
  // The scale only filters what B can be; the core checks it again.
  const scale = (id: string, depth = 0): Scale => {
    const s = byId.get(id)
    const k = s && kinds.get(s.kind)
    if (!s || !k) return 'price'
    if (k.scale) return k.scale
    return s.of && depth < 8 ? scale(s.of, depth + 1) : 'price'
  }
  // Names come from the core (its last check); a series it has not seen yet
  // goes by its kind until the next check.
  const label = (id: string) => named.get(id) ?? kinds.get(byId.get(id)?.kind ?? '')?.label ?? id
  return { vocab, rules, kinds, ops, label, scale }
}

// ------------------------------------------------------------------ series

function SeriesRow({
  ctx,
  s,
  index,
  used,
  onChange,
  onRemove,
}: {
  ctx: Ctx
  s: SeriesDef
  index: number
  used: boolean
  onChange: (s: SeriesDef) => void
  onRemove: () => void
}) {
  const kind = ctx.kinds.get(s.kind)
  const earlier = ctx.rules.series.slice(0, index)
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-2/50 px-2.5 py-2">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: seriesColor(index) }} aria-hidden />
      <span className="min-w-[96px] text-[12px] font-medium text-ink">{ctx.label(s.id)}</span>
      <select
        className={ctl}
        aria-label="Tipo de serie"
        value={s.kind}
        onChange={(e) => {
          const k = ctx.kinds.get(e.target.value)!
          onChange({
            id: s.id,
            kind: k.kind,
            // Another kind is another series: its own defaults (an RSI is 14, not the SMA's 50).
            params: defaults(k.params),
            ...(k.accepts_of && s.of ? { of: s.of } : {}),
          })
        }}
      >
        {ctx.vocab.series_kinds.map((k) => (
          <option key={k.kind} value={k.kind}>
            {k.label}
          </option>
        ))}
      </select>
      {kind?.params
        .filter((p) => applies(p, s.params))
        .map((p) => (
          <ParamInput key={p.name} p={p} value={s.params[p.name]} onChange={(v) => onChange({ ...s, params: settle(kind.params, { ...s.params, [p.name]: v }) })} />
        ))}
      {kind?.accepts_of && (
        <label className="flex items-center gap-1.5 text-[11px] text-ink-3">
          sobre
          <select
            className={ctl}
            aria-label="Serie sobre la que se calcula"
            value={s.of ?? ''}
            onChange={(e) => {
              const { of: _drop, ...rest } = s
              onChange(e.target.value ? { ...rest, of: e.target.value } : rest)
            }}
          >
            <option value="">el cierre</option>
            {/* An anchored level only anchors inside a condition: nothing is computed on it. */}
            {earlier.filter((o) => !o.params.anchored).map((o) => (
              <option key={o.id} value={o.id}>
                {ctx.label(o.id)}
              </option>
            ))}
          </select>
        </label>
      )}
      {kind && <InfoTip text={kind.description} />}
      <button
        type="button"
        onClick={onRemove}
        disabled={used}
        title={used ? 'Se usa en las reglas: quita antes las condiciones que la leen' : 'Quitar serie'}
        aria-label="Quitar serie"
        className="ml-auto rounded p-1 text-ink-3 transition-colors hover:text-down disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-ink-3"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

// ------------------------------------------------------------------ conditions

function ConditionRow({
  ctx,
  c,
  removable,
  onChange,
  onRemove,
}: {
  ctx: Ctx
  c: RuleCondition
  removable: boolean
  onChange: (c: RuleCondition) => void
  onRemove: () => void
}) {
  const op = ctx.ops.get(c.op)
  const scaleA = ctx.scale(c.a)
  const unit = ctx.vocab.scales.find((s) => s.value === scaleA)?.unit
  // What B can be under an op: another series on A's scale, or on any (a divergence).
  const fits = (o: ConditionOp | undefined, id: string) => id !== c.a && (!!o?.any_scale || ctx.scale(id) === scaleA)
  const peers = ctx.rules.series.filter((s) => fits(op, s.id))
  const isValue = 'value' in c.b
  const isCross = c.op.startsWith('crosses')

  const setOp = (next: ConditionOp) => {
    const nextPeers = ctx.rules.series.filter((s) => fits(next, s.id))
    let b: Operand = c.b
    if ('series' in b && !fits(next, b.series) && nextPeers[0]) b = { series: nextPeers[0].id }
    if ('value' in b && next.operand === 'series' && nextPeers[0]) b = { series: nextPeers[0].id }
    // A divergence reads an oscillator against the price: offer the price as B.
    const price = nextPeers.find((s) => s.kind === 'price')
    if (next.any_scale && !op?.any_scale && price) b = { series: price.id }
    const { pct: _p, params: kept, ...rest } = c
    // Knobs of the same name survive the change (bullish ↔ bearish keep their windows).
    const params = next.params.length ? settle(next.params, kept ?? {}) : null
    onChange({ ...rest, op: next.op, b, ...(next.takes_pct ? { pct: c.pct ?? 1 } : {}), ...(params ? { params } : {}) })
  }

  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      <select className={ctl} aria-label="Serie A" value={c.a} onChange={(e) => onChange({ ...c, a: e.target.value })}>
        {ctx.rules.series.map((s) => (
          <option key={s.id} value={s.id}>
            {ctx.label(s.id)}
          </option>
        ))}
      </select>
      <select
        className={ctl}
        aria-label="Condición"
        value={c.op}
        title={op?.hint}
        onChange={(e) => setOp(ctx.ops.get(e.target.value)!)}
      >
        {ctx.vocab.conditions.map((o) => (
          <option key={o.op} value={o.op}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        className={ctl}
        aria-label="Serie B o valor"
        value={isValue ? '__value' : (c.b as { series: string }).series}
        onChange={(e) =>
          onChange({ ...c, b: e.target.value === '__value' ? { value: 0 } : { series: e.target.value } })
        }
      >
        {/* A series of another scale stays listed while chosen: the core says why it cannot be. */}
        {[...peers, ...ctx.rules.series.filter((s) => !isValue && s.id === (c.b as { series: string }).series && !peers.includes(s))].map(
          (s) => (
            <option key={s.id} value={s.id}>
              {ctx.label(s.id)}
            </option>
          ),
        )}
        {(op?.operand === 'series_or_value' || isValue) && <option value="__value">un valor…</option>}
      </select>
      {isValue && (
        <label className="flex items-center gap-1.5 text-[11px] text-ink-3">
          <input
            type="number"
            step="any"
            className={clsx(numCtl, 'w-[88px]')}
            aria-label="Valor"
            value={String((c.b as { value: number | string }).value)}
            onChange={(e) => onChange({ ...c, b: { value: asNumber(e.target.value) } })}
          />
          {unit}
        </label>
      )}
      {op?.params
        .filter((p) => applies(p, c.params ?? {}))
        .map((p) => (
          <ParamInput
            key={p.name}
            p={p}
            named
            value={c.params?.[p.name]}
            onChange={(v) => onChange({ ...c, params: settle(op.params, { ...c.params, [p.name]: v }) })}
          />
        ))}
      {op?.takes_pct && (
        <label className="flex items-center gap-1.5 text-[11px] text-ink-3" title="Distancia mínima entre A y B, en % de B">
          X =
          <input
            type="number"
            step="any"
            min={0}
            max={ctx.vocab.max_pct}
            className={numCtl}
            aria-label="Distancia mínima en %"
            value={String(c.pct ?? '')}
            onChange={(e) => onChange({ ...c, pct: asNumber(e.target.value) })}
          />
          %
        </label>
      )}
      {op?.takes_bars && (
        <label
          className="flex items-center gap-1.5 text-[11px] text-ink-3"
          title={
            isCross
              ? 'Sesiones seguidas que A debe mantenerse al otro lado de B tras cruzar (1 = la sesión del cruce)'
              : 'Sesiones seguidas en que debe cumplirse (1 = basta la sesión actual)'
          }
        >
          {isCross ? 'y se mantiene' : 'durante'}
          <input
            type="number"
            step={1}
            min={1}
            max={ctx.vocab.max_bars}
            className={clsx(numCtl, 'w-[56px]')}
            aria-label="Sesiones seguidas"
            value={String(c.bars ?? 1)}
            onChange={(e) => onChange({ ...c, bars: asNumber(e.target.value) })}
          />
          ses.
        </label>
      )}
      {op && <InfoTip text={op.hint} />}
      <button
        type="button"
        onClick={onRemove}
        disabled={!removable}
        aria-label="Quitar condición"
        title={removable ? 'Quitar condición' : 'Una regla necesita al menos una condición'}
        className="ml-auto rounded p-1 text-ink-3 transition-colors hover:text-down disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-ink-3"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

function newCondition(ctx: Ctx): RuleCondition {
  const a = ctx.rules.series[0]
  const peer = ctx.rules.series.find((s) => s.id !== a.id && ctx.scale(s.id) === ctx.scale(a.id))
  return { a: a.id, op: 'above', b: peer ? { series: peer.id } : { value: 0 } }
}

function GroupBox({
  ctx,
  g,
  depth,
  onChange,
  onRemove,
}: {
  ctx: Ctx
  g: RuleGroup
  depth: number
  onChange: (g: RuleGroup) => void
  onRemove?: () => void
}) {
  const set = (i: number, c: RuleCondition | RuleGroup) =>
    onChange({ ...g, conditions: g.conditions.map((x, j) => (j === i ? c : x)) })
  const remove = (i: number) => onChange({ ...g, conditions: g.conditions.filter((_, j) => j !== i) })
  const btn = 'inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink'
  return (
    <div className={clsx(depth > 1 && 'rounded-lg border border-line border-l-2 border-l-accent/50 bg-surface-2/40 px-3 py-2')}>
      <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-3">
        <span>{depth > 1 ? 'Grupo:' : 'Se cumple'}</span>
        <Segmented<Combinator>
          size="sm"
          label="Combinación"
          value={g.combinator}
          options={ctx.vocab.combinators.map((c) => ({
            value: c.value,
            label: c.label,
            hint: c.value === 'all' ? 'Todas las condiciones a la vez (y)' : 'Basta con una (o)',
          }))}
          onChange={(v) => onChange({ ...g, combinator: v })}
        />
        <span>{g.combinator === 'all' ? 'las condiciones' : 'de las condiciones'}</span>
        {onRemove && (
          <button type="button" onClick={onRemove} className={clsx(btn, 'ml-auto hover:text-down')} aria-label="Quitar grupo">
            <Trash2 size={13} /> Quitar grupo
          </button>
        )}
      </div>
      <div className="divide-y divide-line">
        {g.conditions.map((c, i) =>
          isGroup(c) ? (
            <div key={i} className="py-1.5">
              <GroupBox ctx={ctx} g={c} depth={depth + 1} onChange={(x) => set(i, x)} onRemove={() => remove(i)} />
            </div>
          ) : (
            <ConditionRow key={i} ctx={ctx} c={c} removable={g.conditions.length > 1} onChange={(x) => set(i, x)} onRemove={() => remove(i)} />
          ),
        )}
      </div>
      <div className="mt-1 flex gap-1">
        <button type="button" className={btn} onClick={() => onChange({ ...g, conditions: [...g.conditions, newCondition(ctx)] })}>
          <Plus size={13} /> Condición
        </button>
        {depth < ctx.vocab.max_depth && (
          <button
            type="button"
            className={btn}
            title="Un grupo combina sus condiciones con su propio «todas / alguna»"
            onClick={() =>
              onChange({
                ...g,
                conditions: [...g.conditions, { combinator: g.combinator === 'all' ? 'any' : 'all', conditions: [newCondition(ctx)] }],
              })
            }
          >
            <Plus size={13} /> Grupo
          </button>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ editor

function Block({ title, hint, children, sentence }: { title: string; hint?: string; children: ReactNode; sentence?: ReactNode }) {
  return (
    <div className="border-t border-line pt-3.5 first:border-t-0 first:pt-0">
      <div className="eyebrow mb-2 flex items-center gap-1.5">
        {title}
        {hint && <InfoTip text={hint} />}
      </div>
      {children}
      {sentence}
    </div>
  )
}

export function RulesEditor({
  vocab,
  rules,
  onChange,
  preview,
  error,
  checking,
}: {
  vocab: RulesVocabulary
  rules: Composition
  onChange: (r: Composition) => void
  /** The core's last successful check of the rules (names, sentences, warm-up). */
  preview: RulesPreview | undefined
  /** The core's refusal of the current rules, in its words. */
  error: string | null
  checking: boolean
}) {
  const ctx = useCtx(vocab, rules, preview)
  const used = usedIds(rules)
  const btn = 'inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink'
  const sentence = (text: string | undefined) =>
    text ? (
      <p className={clsx('mt-2 rounded-md bg-surface-2 px-2.5 py-1.5 text-xs text-ink-2', (checking || error) && 'opacity-60')}>
        <span className="text-ink-3">Se lee: </span>
        {text}
      </p>
    ) : null

  return (
    <div className="space-y-3.5">
      <Block title="Series" hint="Lo que miran las reglas. Cada serie se dibuja en el gráfico de precio con su color; osciladores (RSI, percentiles) y series en % (variaciones, anchura de Bollinger), en su propio panel.">
        <div className="space-y-1.5">
          {rules.series.map((s, i) => (
            <SeriesRow
              key={s.id}
              ctx={ctx}
              s={s}
              index={i}
              used={used.has(s.id)}
              onChange={(x) => onChange({ ...rules, series: rules.series.map((y, j) => (j === i ? x : y)) })}
              onRemove={() => onChange({ ...rules, series: rules.series.filter((_, j) => j !== i) })}
            />
          ))}
        </div>
        {rules.series.length < vocab.max_series && (
          <button
            type="button"
            className={clsx(btn, 'mt-1')}
            onClick={() => onChange({ ...rules, series: [...rules.series, { id: nextId(rules.series), kind: 'sma', params: { period: 50 } as Record<string, ParamValue> }] })}
          >
            <Plus size={13} /> Serie
          </button>
        )}
      </Block>
      <Block title="Entrada" hint="Se evalúa al cierre de cada sesión estando en liquidez: si se cumple, se abre la posición." sentence={sentence(preview?.entry_text)}>
        <GroupBox ctx={ctx} g={rules.entry} depth={1} onChange={(g) => onChange({ ...rules, entry: g })} />
      </Block>
      <Block title="Salida" hint="Se evalúa al cierre de cada sesión con la posición abierta: si se cumple, se cierra." sentence={sentence(preview?.exit_text)}>
        <GroupBox ctx={ctx} g={rules.exit} depth={1} onChange={(g) => onChange({ ...rules, exit: g })} />
      </Block>
      <div className="flex items-start gap-1.5 text-xs" role={error ? 'alert' : 'status'}>
        {checking ? (
          <>
            <LoaderCircle size={14} className="mt-px shrink-0 animate-spin text-ink-3" />
            <span className="text-ink-3">Comprobando las reglas…</span>
          </>
        ) : error ? (
          <>
            <TriangleAlert size={14} className="mt-px shrink-0 text-down" />
            <span className="text-down">{error}</span>
          </>
        ) : preview ? (
          <>
            <CircleCheck size={14} className="mt-px shrink-0 text-up" />
            <span className="text-ink-3">
              Reglas válidas. Necesitan <span className="num">{preview.warmup_bars}</span> sesiones de histórico antes de la primera señal.
            </span>
          </>
        ) : null}
      </div>
    </div>
  )
}
