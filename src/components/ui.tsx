import clsx from 'clsx'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Clock, Info, Minus } from 'lucide-react'
import type { ReactNode } from 'react'
import { fmtShortDate, fmtTime, tone } from '../lib/format'
import type { LiveQuote } from '../lib/types'

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  size = 'md',
  label,
}: {
  value: T
  options: { value: T; label: string; hint?: string }[]
  onChange: (v: T) => void
  size?: 'sm' | 'md'
  label?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex items-center gap-0.5 rounded-[10px] border border-line bg-surface-2 p-0.5"
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={active}
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={clsx(
              'whitespace-nowrap rounded-[8px] font-medium transition-colors',
              size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs',
              active ? 'bg-surface-3 text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Signed move with arrow: the sign is never carried by colour alone. */
export function Delta({ value, text, className }: { value: number | null | undefined; text: string; className?: string }) {
  const t = tone(value)
  const Icon = t === 'up' ? ArrowUpRight : t === 'down' ? ArrowDownRight : Minus
  return (
    <span
      className={clsx(
        'num inline-flex items-center gap-0.5 font-medium',
        t === 'up' && 'text-up',
        t === 'down' && 'text-down',
        t === 'flat' && 'text-ink-3',
        className,
      )}
    >
      <Icon size={13} strokeWidth={2.25} aria-hidden />
      {text}
    </span>
  )
}

export function Pill({
  children,
  tone: t = 'neutral',
  title,
}: {
  children: ReactNode
  tone?: 'up' | 'down' | 'warn' | 'accent' | 'neutral'
  title?: string
}) {
  return (
    <span
      title={title}
      className={clsx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium',
        t === 'up' && 'bg-up-soft text-up',
        t === 'down' && 'bg-down-soft text-down',
        t === 'warn' && 'bg-warn-soft text-warn',
        t === 'accent' && 'bg-accent-soft text-accent',
        t === 'neutral' && 'bg-surface-3 text-ink-2',
      )}
    >
      {children}
    </span>
  )
}

/** Says that the series ends in provisional bars (not yet in the base) and where they come from. */
export function LiveBadge({ live }: { live: LiveQuote | null | undefined }) {
  if (!live) return null
  const span =
    live.provisional_from === live.as_of
      ? `la sesión del ${fmtShortDate(live.as_of)}`
      : `las sesiones del ${fmtShortDate(live.provisional_from)} al ${fmtShortDate(live.as_of)}`
  return (
    <Pill
      tone="warn"
      title={`La base aún no tiene ${span}: vienen de ${live.source} (consultado ${fmtTime(live.fetched_at)}) y pueden cambiar hasta la carga de cierre.`}
    >
      <Clock size={11} aria-hidden />
      {live.in_progress ? 'En curso' : 'Provisional'} · {fmtShortDate(live.as_of)}
    </Pill>
  )
}

export function Warnings({ items, className }: { items: string[]; className?: string }) {
  if (!items.length) return null
  return (
    <div className={clsx('flex items-start gap-2 rounded-xl border border-warn/25 bg-warn-soft px-3 py-2 text-xs text-ink-2', className)}>
      <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warn" aria-label="Aviso" />
      <ul className="space-y-0.5">
        {items.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
    </div>
  )
}

export function InfoTip({ text }: { text: string }) {
  return (
    <span title={text} className="inline-flex cursor-help text-ink-3 hover:text-ink-2">
      <Info size={13} aria-label={text} />
    </span>
  )
}

export function Card({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={clsx('card', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-4 pt-3.5">
          <div className="min-w-0">
            {title && <h3 className="text-[13px] font-semibold text-ink">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx('p-4', bodyClassName)}>{children}</div>
    </section>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} aria-hidden />
}

export function ErrorState({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error)
  return (
    <div className="flex items-start gap-2 rounded-xl border border-down/30 bg-down-soft px-3 py-2.5 text-sm text-ink-2">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-down" aria-hidden />
      <div>
        <div className="font-medium text-ink">No se pudo cargar</div>
        <div className="text-xs">{msg}</div>
      </div>
    </div>
  )
}

export function PageHeader({ eyebrow, title, subtitle, children }: { eyebrow?: string; title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

/** Hero-style figure: proportional digits, sans, no colour unless it carries meaning. */
export function Stat({
  label,
  value,
  sub,
  hint,
  emphasis,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  hint?: string
  emphasis?: 'up' | 'down' | 'warn'
}) {
  return (
    <div className="card px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-ink-3">
        {label}
        {hint && <InfoTip text={hint} />}
      </div>
      <div
        className={clsx(
          'mt-1 text-[22px] font-semibold tracking-tight',
          emphasis === 'up' && 'text-up',
          emphasis === 'down' && 'text-down',
          emphasis === 'warn' && 'text-warn',
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-ink-3">{sub}</div>}
    </div>
  )
}
