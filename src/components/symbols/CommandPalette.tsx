import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useWatchlist } from '../../lib/api'
import { symbolPath } from '../../lib/symbolNav'
import { SymbolSearch } from './SymbolSearch'

/** ⌘K / Ctrl+K from anywhere: find a symbol and open its analysis. */
export function CommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape') setOpen(false)
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('synopsis:search', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('synopsis:search', onOpen)
    }
  }, [])

  return open ? <Palette close={() => setOpen(false)} /> : null
}

/** Mounted only while open: the watchlist is read when the palette is used. */
function Palette({ close }: { close: () => void }) {
  const navigate = useNavigate()
  const watch = useWatchlist()
  const watched = new Set(watch.data?.items.map((i) => i.key) ?? [])
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar símbolo"
        className="card w-full max-w-[560px] p-3"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <SymbolSearch
          inline={false}
          autoFocus
          watched={watched}
          onEscape={close}
          onPick={(h) => {
            close()
            navigate(symbolPath(h.key))
          }}
        />
        <p className="px-1 pt-2 text-[10px] text-ink-3">↑ ↓ para moverte · Enter para abrir · Esc para cerrar</p>
      </div>
    </div>
  )
}
