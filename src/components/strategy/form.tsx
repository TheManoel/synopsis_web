import type { ReactNode } from 'react'
import { InfoTip } from '../ui'

/** A labelled form field of the strategy forms. */
export function Field({ label, hint, children, unit }: { label: string; hint?: string | null; children: ReactNode; unit?: string | null }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-xs text-ink-2">
        {label}
        {hint && <InfoTip text={hint} />}
      </span>
      <span className="flex items-center gap-2">
        {children}
        {unit && <span className="shrink-0 text-[11px] text-ink-3">{unit}</span>}
      </span>
    </label>
  )
}
