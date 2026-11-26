import clsx from 'clsx'
import { Loader2 } from 'lucide-react'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { LEVEL } from '../../lib/adminLevels'
import type { AdminLevel } from '../../lib/types'

/** Estado con punto + texto: el nivel nunca va solo por color. */
export function LevelDot({ level, text, className }: { level: AdminLevel; text?: string; className?: string }) {
  const l = LEVEL[level] ?? LEVEL.idle
  return (
    <span className={clsx('inline-flex items-center gap-1.5', className)}>
      <span className={clsx('relative inline-flex h-2 w-2 shrink-0 rounded-full', l.dot)} aria-hidden>
        {level === 'running' && <span className={clsx('absolute inset-0 animate-ping rounded-full opacity-60', l.dot)} />}
      </span>
      <span className={clsx('text-xs', text ? 'text-ink-2' : l.text)}>{text ?? l.label}</span>
    </span>
  )
}

export function ActionButton({
  children,
  onClick,
  busy,
  disabled,
  tone = 'neutral',
  title,
}: {
  children: ReactNode
  onClick: () => void
  busy?: boolean
  disabled?: boolean
  tone?: 'neutral' | 'accent' | 'danger'
  title?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled || busy}
      className={clsx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        tone === 'accent' && 'border-accent/40 bg-accent-soft text-ink hover:border-accent',
        tone === 'danger' && 'border-down/30 text-down hover:bg-down-soft',
        tone === 'neutral' && 'border-line bg-surface-2 text-ink-2 hover:text-ink',
      )}
    >
      {busy && <Loader2 size={12} className="animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

/** Bloque de texto monoespaciado con scroll, para logs. `follow`: se queda al final al
 * llegar líneas nuevas, salvo que hayas subido a leer. */
export function LogView({ text, className, follow }: { text: string; className?: string; follow?: boolean }) {
  const ref = useRef<HTMLPreElement>(null)
  const pinned = useRef(true)
  useLayoutEffect(() => {
    const el = ref.current
    if (follow && el && pinned.current) el.scrollTop = el.scrollHeight
  }, [text, follow])
  return (
    <pre
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
      }}
      className={clsx(
        'scroll-thin max-h-[420px] overflow-auto whitespace-pre-wrap break-all rounded-lg border border-line bg-canvas p-3 font-mono text-[11px] leading-relaxed text-ink-2',
        className,
      )}
    >
      {text || 'Sin líneas.'}
    </pre>
  )
}
