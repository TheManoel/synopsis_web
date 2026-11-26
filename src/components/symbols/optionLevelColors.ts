import type { PriceLevel } from '../../lib/types'

/** Colour per level, from the design system: calls --s1, puts --s2, the flip warns. */
export const LEVEL_COLOR: Record<PriceLevel['kind'], string> = {
  call_wall: 'var(--s1)',
  put_wall: 'var(--s2)',
  gamma_flip: 'var(--warn)',
  max_pain: 'var(--ink-3)',
  em_session_hi: 'var(--ink-2)',
  em_session_lo: 'var(--ink-2)',
  em_week_hi: 'var(--axis)',
  em_week_lo: 'var(--axis)',
}
