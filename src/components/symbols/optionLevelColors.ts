import type { AnalystLevelKind } from '../../lib/types'

/** Colour per level, from the design system: calls --s1, puts --s2, the flip warns, the
 * volatility trigger --s7; the implied move is a soft dashed band. 0DTE shares its wall's hue. */
export const LEVEL_COLOR: Record<AnalystLevelKind, string> = {
  call_wall: 'var(--s1)',
  put_wall: 'var(--s2)',
  gamma_flip: 'var(--warn)',
  vol_trigger: 'var(--s7)',
  call_wall_0dte: 'var(--s1)',
  put_wall_0dte: 'var(--s2)',
  em_session_hi: 'var(--ink-3)',
  em_session_lo: 'var(--ink-3)',
  em_week_hi: 'var(--axis)',
  em_week_lo: 'var(--axis)',
}

/** The step lines drawn over the price, in legend order. */
export const LEVEL_SERIES = [
  { kind: 'call_wall', label: 'Call Wall' },
  { kind: 'put_wall', label: 'Put Wall' },
  { kind: 'gamma_flip', label: 'Gamma Flip' },
  { kind: 'vol_trigger', label: 'Vol. Trigger' },
  { kind: 'em_session_hi', label: '±1σ sesión ↑' },
  { kind: 'em_session_lo', label: '±1σ sesión ↓' },
] as const
