import clsx from 'clsx'
import { Loader2, Search, Star } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useSymbolSearch } from '../../lib/api'
import { assetTypeLabel } from '../../lib/format'
import type { SymbolHit } from '../../lib/types'

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/**
 * Symbol finder: ticker or name, ranked by the core. Arrow keys move, Enter
 * opens, Escape clears. `inline` drops the results under the box; otherwise
 * they render in flow (the command palette).
 */
export function SymbolSearch({
  onPick,
  watched,
  autoFocus,
  inline = true,
  placeholder = 'Buscar símbolo o empresa…',
  onEscape,
}: {
  onPick: (hit: SymbolHit) => void
  watched?: Set<string>
  autoFocus?: boolean
  inline?: boolean
  placeholder?: string
  onEscape?: () => void
}) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const q = useDebounced(text.trim(), 150)
  const { data, isFetching, isError } = useSymbolSearch(q)
  const hits = q && data?.query === q ? data.hits : q ? (data?.hits ?? []) : []
  const listId = useId()
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) input.current?.focus()
  }, [autoFocus])

  const pick = (h: SymbolHit) => {
    onPick(h)
    setText('')
    setOpen(false)
    input.current?.blur()
  }

  const showList = (inline ? open : true) && text.trim().length > 0

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-[10px] border border-line bg-surface-2 px-2.5 focus-within:border-accent/60">
        {isFetching ? <Loader2 size={15} className="animate-spin text-ink-3" aria-hidden /> : <Search size={15} className="text-ink-3" aria-hidden />}
        <input
          ref={input}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label="Buscar símbolo"
          value={text}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(a + 1, Math.max(0, hits.length - 1)))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (e.key === 'Enter' && (hits[active] ?? hits[0])) {
              e.preventDefault()
              pick(hits[active] ?? hits[0])
            } else if (e.key === 'Escape') {
              if (text) setText('')
              else onEscape?.()
            }
          }}
          className="h-9 w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3"
        />
      </div>
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className={clsx(
            'scroll-thin max-h-[360px] overflow-y-auto',
            inline ? 'card absolute inset-x-0 top-[calc(100%+6px)] z-30 p-1' : 'mt-2',
          )}
        >
          {isError && <li className="px-3 py-2 text-xs text-down">La búsqueda ha fallado</li>}
          {!isError && hits.length === 0 && !isFetching && q && (
            <li className="px-3 py-2 text-xs text-ink-3">Sin resultados para «{q}»</li>
          )}
          {hits.map((h, i) => (
            <li
              key={h.key}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(h)
              }}
              onMouseEnter={() => setActive(i)}
              className={clsx(
                'flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2',
                i === active ? 'bg-surface-3' : 'hover:bg-surface-2',
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-ink">{h.ticker}</span>
                  {watched?.has(h.key) && <Star size={11} className="fill-warn text-warn" aria-label="En la watchlist" />}
                  {!h.active && <span className="text-[10px] text-warn">no activo</span>}
                </div>
                <div className="truncate text-[11px] text-ink-3">{h.name ?? '—'}</div>
              </div>
              <div className="shrink-0 text-right text-[10px] leading-tight text-ink-3">
                <div>{assetTypeLabel(h.asset_type)}</div>
                <div>
                  {h.exchange}
                  {h.currency ? ` · ${h.currency}` : ''}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
