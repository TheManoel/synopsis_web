import clsx from 'clsx'
import { ArrowDown, ArrowUp, Pin, PinOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { DASH, fmtNum } from '../../lib/format'
import { pctFill, type Sort } from '../../lib/rs'
import { COMPARE_MAX, sameItem, toggleCompare, useCompare, type CompareItem } from '../../lib/rsCompare'

export function PctCell({ value, title }: { value: number | null | undefined; title?: string }) {
  return (
    <span
      title={title}
      className={clsx('num inline-block min-w-[38px] rounded-md px-1.5 py-0.5 text-right text-[12px]', value == null ? 'text-ink-3' : 'text-ink')}
      style={{ background: pctFill(value) }}
    >
      {value == null ? DASH : fmtNum(value, 0)}
    </span>
  )
}

export function HeatLegend({ label = 'Percentil' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[11px] text-ink-3">
      {label}
      <span className="num">0</span>
      <span
        className="h-2 w-28 rounded-sm"
        style={{ background: `linear-gradient(90deg, ${[0, 25, 50, 75, 100].map(pctFill).join(', ')})` }}
      />
      <span className="num">100</span>
    </span>
  )
}

/** Laggards to the left, leaders to the right of a centre line. */
export function ParticipationBar({ leaders, laggards }: { leaders: number; laggards: number }) {
  return (
    <div className="relative h-3 min-w-[90px]" title={`${fmtNum(leaders, 0)}% líderes · ${fmtNum(laggards, 0)}% rezagados`}>
      <div className="absolute inset-y-0 left-1/2 w-px" style={{ background: 'var(--axis)' }} />
      <div className="absolute inset-y-0 rounded-l-[3px] bg-down" style={{ right: '50%', width: `${laggards / 2}%`, marginRight: 1 }} />
      <div className="absolute inset-y-0 rounded-r-[3px] bg-up" style={{ left: '50%', width: `${leaders / 2}%`, marginLeft: 1 }} />
    </div>
  )
}


export function PinButton({ item }: { item: Omit<CompareItem, 'slot'> }) {
  const items = useCompare()
  const on = items.some((x) => sameItem(x, item))
  const full = !on && items.length >= COMPARE_MAX
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        toggleCompare(item)
      }}
      disabled={full}
      title={on ? 'Quitar de la comparación' : full ? `La comparación admite ${COMPARE_MAX}` : 'Añadir a la comparación'}
      aria-label={on ? `Quitar ${item.label} de la comparación` : `Comparar ${item.label}`}
      aria-pressed={on}
      className={clsx(
        'inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors disabled:opacity-30',
        on ? 'bg-accent-soft text-accent' : 'text-ink-3 hover:bg-surface-3 hover:text-ink-2',
      )}
    >
      {on ? <PinOff size={13} /> : <Pin size={13} />}
    </button>
  )
}

/** Sortable column header: click toggles, a new column starts descending. */
export function SortTh<K extends string>({
  k,
  sort,
  onSort,
  children,
  align = 'right',
  title,
  className,
}: {
  k: K
  sort: Sort<K>
  onSort: (s: Sort<K>) => void
  children: ReactNode
  align?: 'left' | 'right' | 'center'
  title?: string
  className?: string
}) {
  const active = sort.key === k
  return (
    <th
      className={clsx('px-2 py-2 font-medium', align === 'left' ? 'text-left' : align === 'center' ? 'text-center' : 'text-right', className)}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      title={title}
    >
      <button
        onClick={() => onSort({ key: k, dir: active && sort.dir === 'desc' ? 'asc' : 'desc' })}
        className={clsx('inline-flex items-center gap-0.5 hover:text-ink-2', active && 'text-ink')}
      >
        {children}
        {active && (sort.dir === 'desc' ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
      </button>
    </th>
  )
}

