import type { Quadrant, Timeframe } from './types'

/** Clockwise RRG cycle: the order quadrants are read and listed in. */
export const QUADRANTS: Quadrant[] = ['Leading', 'Weakening', 'Lagging', 'Improving']

export const QUADRANT_LABEL: Record<Quadrant, string> = {
  Leading: 'Liderando',
  Weakening: 'Debilitándose',
  Lagging: 'Rezagado',
  Improving: 'Mejorando',
}

export const QUADRANT_HINT: Record<Quadrant, string> = {
  Leading: 'RS-Ratio ≥ 100 y RS-Momentum ≥ 100: mejor que la cesta y ganando ventaja',
  Weakening: 'RS-Ratio ≥ 100 y RS-Momentum < 100: aún mejor que la cesta, pero perdiendo ventaja',
  Lagging: 'RS-Ratio < 100 y RS-Momentum < 100: peor que la cesta y empeorando',
  Improving: 'RS-Ratio < 100 y RS-Momentum ≥ 100: aún peor que la cesta, pero recortando',
}

/** Quadrant = a state: status tokens, always shown together with its label. */
export const QUADRANT_TONE: Record<Quadrant, 'up' | 'warn' | 'down' | 'accent'> = {
  Leading: 'up',
  Weakening: 'warn',
  Lagging: 'down',
  Improving: 'accent',
}

export const QUADRANT_COLOR: Record<Quadrant, string> = {
  Leading: 'var(--up)',
  Weakening: 'var(--warn)',
  Lagging: 'var(--down)',
  Improving: 'var(--accent)',
}

export const QUADRANT_SOFT: Record<Quadrant, string> = {
  Leading: 'var(--up-soft)',
  Weakening: 'var(--warn-soft)',
  Lagging: 'var(--down-soft)',
  Improving: 'var(--accent-soft)',
}

/** Compass point of an RRG heading (0° = east = RS-Ratio rising). */
export function headingLabel(deg: number | null | undefined): string {
  if (deg == null || !Number.isFinite(deg)) return '—'
  const points = ['E', 'NE', 'N', 'NO', 'O', 'SO', 'S', 'SE']
  return points[Math.round((((deg % 360) + 360) % 360) / 45) % 8]
}

export const barUnit = (tf: Timeframe, n: number) =>
  tf === 'weekly' ? (n === 1 ? 'semana' : 'semanas') : n === 1 ? 'sesión' : 'sesiones'

export const barUnitShort = (tf: Timeframe) => (tf === 'weekly' ? 'sem' : 'ses')
