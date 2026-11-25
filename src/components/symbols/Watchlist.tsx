import clsx from 'clsx'
import { AlertTriangle, GripVertical, Star, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useSaveWatchlist, useWatchlist } from '../../lib/api'
import { fmtChange, fmtLevel } from '../../lib/format'
import type { WatchItem } from '../../lib/types'
import { Sparkline } from '../charts/Sparkline'
import { Delta, ErrorState, Skeleton, Warnings } from '../ui'
import { symbolPath } from '../../lib/symbolNav'

function Row({
  item,
  active,
  onRemove,
  drag,
}: {
  item: WatchItem
  active: boolean
  onRemove: () => void
  drag: { onDragStart: () => void; onDragOver: (e: React.DragEvent) => void; onDrop: () => void; over: 'before' | 'after' | null }
}) {
  return (
    <li
      draggable
      onDragStart={drag.onDragStart}
      onDragOver={drag.onDragOver}
      onDrop={drag.onDrop}
      className={clsx(
        'group relative',
        drag.over === 'before' && 'before:absolute before:inset-x-2 before:-top-px before:h-0.5 before:rounded before:bg-accent',
        drag.over === 'after' && 'after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded after:bg-accent',
      )}
    >
      <Link
        to={symbolPath(item.key)}
        aria-current={active ? 'page' : undefined}
        className={clsx(
          'flex items-center gap-2 rounded-lg py-2 pl-1 pr-2 transition-colors',
          active ? 'bg-accent-soft' : 'hover:bg-surface-2',
        )}
      >
        <GripVertical size={13} className="shrink-0 cursor-grab text-ink-3 opacity-0 group-hover:opacity-100" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate text-[13px] font-semibold text-ink">{item.ticker}</span>
            {item.warnings.length > 0 && (
              <span title={item.warnings.join(' · ')}>
                <AlertTriangle size={11} className="text-warn" aria-label={item.warnings.join(' · ')} />
              </span>
            )}
          </div>
          <div className="truncate text-[11px] text-ink-3">{item.name ?? ''}</div>
        </div>
        <Sparkline values={item.spark} width={46} height={22} />
        <div className="w-[64px] shrink-0 text-right">
          <div className="num text-[12px] text-ink">{fmtLevel(item.last, item.kind)}</div>
          <Delta
            value={item.change_1d}
            text={fmtChange({ horizon: '1D', value: item.change_1d, pct: null }, item.kind)}
            className="justify-end text-[11px]"
          />
        </div>
      </Link>
      <button
        onClick={onRemove}
        className="absolute -right-1 top-1 hidden rounded-full bg-surface-3 p-0.5 text-ink-3 hover:text-down group-hover:block"
        aria-label={`Quitar ${item.ticker} de la watchlist`}
        title="Quitar de la watchlist"
      >
        <X size={11} />
      </button>
    </li>
  )
}

export function WatchlistPanel({ activeKey }: { activeKey: string | null }) {
  const { data, isLoading, error } = useWatchlist()
  const save = useSaveWatchlist()
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const items = data?.items ?? []
  const keys = items.map((i) => i.key)

  const move = (from: number, to: number) => {
    if (from === to) return
    const next = [...keys]
    const [k] = next.splice(from, 1)
    next.splice(to, 0, k) // takes the target's place: after it going down, before it going up
    save.mutate(next)
  }

  return (
    <div>
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="eyebrow">Watchlist</span>
        <span className="text-[10px] text-ink-3">{items.length ? `${items.length}` : ''}</span>
      </div>
      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} />}
      {save.error && <ErrorState error={save.error} />}
      {data && <Warnings items={data.warnings} className="mb-2" />}
      {data && items.length === 0 && (
        <div className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[11px] leading-relaxed text-ink-3">
          Sin símbolos guardados. Marca la <Star size={11} className="inline align-[-1px]" aria-hidden /> de un símbolo para
          tenerlo aquí a un clic.
        </div>
      )}
      <ul
        className="space-y-0.5"
        onDragLeave={() => setOver(null)}
        onDragEnd={() => {
          setDragFrom(null)
          setOver(null)
        }}
      >
        {items.map((item, i) => (
          <Row
            key={item.key}
            item={item}
            active={item.key === activeKey}
            onRemove={() => save.mutate(keys.filter((k) => k !== item.key))}
            drag={{
              onDragStart: () => setDragFrom(i),
              onDragOver: (e) => {
                e.preventDefault()
                setOver(i)
              },
              onDrop: () => {
                if (dragFrom != null) move(dragFrom, i)
                setDragFrom(null)
                setOver(null)
              },
              over: over === i && dragFrom != null && dragFrom !== i ? (dragFrom > i ? 'before' : 'after') : null,
            }}
          />
        ))}
      </ul>
      {items.length > 1 && <p className="px-1 pt-2 text-[10px] text-ink-3">Arrastra para reordenar.</p>}
    </div>
  )
}
