import type { SymbolTiming, TimingSignal } from '../../lib/types'
import type { EventLine } from '../charts/eventLinesPrimitive'
import type { Marker } from '../charts/TimeChart'

export type TimingMode = 'off' | 'all' | 'strong'

/** Colour of a forecast: its sign (bottom up, top down), BC apart (it may invert),
 * grey when it did not happen, went unrecorded or the author dropped it. */
export function tint(s: TimingSignal): string {
  if (s.state === 'missed' || s.state === 'unrecorded' || (s.state === 'upcoming' && !s.in_latest)) return 'var(--ink-3)'
  if (s.block === 'bc') return 'var(--s7)'
  if (s.direction === 'volatility') return 'var(--warn)'
  return s.direction === 'bottom' ? 'var(--up)' : 'var(--down)'
}

const below = (dir: string | null) => dir === 'bottom'

export function visibleSignals(t: SymbolTiming | undefined, mode: TimingMode): TimingSignal[] {
  if (!t || mode === 'off') return []
  return t.signals.filter((s) => mode === 'all' || s.strong)
}

/** Markers on the price series (lines for sessions without a bar yet) and the hover
 * lines, keyed by session. */
export function timingOverlay(
  signals: TimingSignal[],
  last?: { time: string; close: number },
): { markers: Marker[]; future: EventLine[]; notes: Record<string, string[]> } {
  const markers: Marker[] = []
  const future: EventLine[] = []
  const notes: Record<string, string[]> = {}
  const note = (t: string, text: string) => (notes[t] ??= []).push(text)
  for (const s of signals) {
    if (!s.chart_time) continue
    const color = tint(s)
    const text = s.block === 'bc' ? 'BC' : (s.cluster ?? undefined)
    note(s.chart_time, s.check ? `${s.text}\n   ↳ ${s.check.text}` : s.text)
    // A session with no bar yet cannot hold a marker: a line on the chart instead.
    if (last && s.chart_time > last.time) {
      future.push({ time: s.chart_time, color, up: s.direction !== 'top', strong: s.strong, text })
      continue
    }
    markers.push({
      time: s.chart_time,
      position: below(s.direction) ? 'belowBar' : 'aboveBar',
      shape: s.direction === 'volatility' ? 'square' : below(s.direction) ? 'arrowUp' : 'arrowDown',
      color,
      size: s.strong ? 2 : 1,
      text,
    })
    if (s.actual_time && s.actual_time !== s.chart_time) {
      markers.push({ time: s.actual_time, position: below(s.actual_direction) ? 'belowBar' : 'aboveBar', shape: 'circle', color })
      note(s.actual_time, `Fecha real de: ${s.text}`)
    }
  }
  return { markers, future, notes }
}
