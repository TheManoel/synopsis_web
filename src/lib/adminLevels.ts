import type { AdminLevel } from './types'

/** Cómo se pinta cada nivel de salud que decide el core (punto + texto, nunca solo color). */
export const LEVEL: Record<AdminLevel, { label: string; dot: string; text: string }> = {
  ok: { label: 'Bien', dot: 'bg-up', text: 'text-up' },
  running: { label: 'En curso', dot: 'bg-accent', text: 'text-accent' },
  warn: { label: 'Atención', dot: 'bg-warn', text: 'text-warn' },
  down: { label: 'Fallo', dot: 'bg-down', text: 'text-down' },
  idle: { label: 'Inactivo', dot: 'bg-ink-3', text: 'text-ink-3' },
}

export const levelLabel = (level: AdminLevel): string => (LEVEL[level] ?? LEVEL.idle).label
