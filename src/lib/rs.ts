import { DASH, fmtNum, fmtSigned } from './format'

/** RS level as a diverging scale (user's choice, 2026-11-26): red (--down) below
 *  the median, green (--up) above, neutral around 50; intensity grows with the
 *  distance to 50. The number is always printed in the cell, so the reading
 *  never rests on colour alone (red/green is hard to tell apart with CVD). */
export const pctFill = (v: number | null | undefined) => {
  if (v == null) return 'transparent'
  const d = (Math.max(0, Math.min(100, v)) - 50) / 50
  if (Math.abs(d) < 0.08) return 'var(--surface-3)'
  // Capped so the ink keeps its contrast on the strongest cells, in both themes.
  return `color-mix(in oklab, var(${d < 0 ? '--down' : '--up'}) ${Math.round(10 + Math.abs(d) * 52)}%, transparent)`
}

/** The same red → neutral → green scale as a solid mark colour (scatter dots),
 *  neutral = --ink-3 so a point at the median reads as grey, not as a tint. */
export const pctDot = (v: number) => {
  const d = (Math.max(0, Math.min(100, v)) - 50) / 50
  return `color-mix(in oklab, var(${d < 0 ? '--down' : '--up'}) ${Math.round(Math.abs(d) * 100)}%, var(--ink-3))`
}

export const fmtPp = (v: number | null | undefined, d = 1) => fmtSigned(v, d, ' pp')
export const fmtFromHigh = (v: number | null | undefined) => (v == null ? DASH : v === 0 ? 'en máx.' : `${fmtNum(v, 1)}%`)

/** Range codes shared with Símbolos (the core's RANGES). */
export const RS_RANGES = [
  { value: '1y', label: '1A' },
  { value: '2y', label: '2A' },
  { value: '5y', label: '5A' },
  { value: '10y', label: '10A' },
  { value: 'max', label: 'Máx.' },
]

export type Sort<K extends string> = { key: K; dir: 'asc' | 'desc' }

/** Nulls always last, whichever the direction. */
export function sortBy<T>(rows: T[], get: (r: T) => number | string | null | undefined, dir: 'asc' | 'desc'): T[] {
  const s = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const va = get(a)
    const vb = get(b)
    if (va == null && vb == null) return 0
    if (va == null) return 1
    if (vb == null) return -1
    if (typeof va === 'string' || typeof vb === 'string') return String(va).localeCompare(String(vb), 'es') * s
    return (va - vb) * s
  })
}
