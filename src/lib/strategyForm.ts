import type { Backtest, ParamValue, StrategyTemplate } from './types'

/** Form helpers shared by the Strategy Lab and the backtest of the Symbols page. */

export type Preset = '5' | '10' | '20' | '30' | '50' | 'all' | 'custom'

export const PRESETS: { value: Preset; label: string; hint: string }[] = [
  { value: '10', label: '10A', hint: 'Últimos 10 años' },
  { value: '20', label: '20A', hint: 'Últimos 20 años' },
  { value: '30', label: '30A', hint: 'Últimos 30 años' },
  { value: '50', label: '50A', hint: 'Últimos 50 años' },
  { value: 'all', label: 'Todo', hint: 'Todo el histórico disponible del activo' },
  { value: 'custom', label: 'Fechas', hint: 'Elegir inicio y fin' },
]

/** Earliest date asked for with "Todo": the core starts at the first session it has. */
export const ALL_HISTORY = '1900-01-01'

export const iso = (d: Date) => d.toISOString().slice(0, 10)
export const today = () => iso(new Date())

export function yearsAgo(n: number): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - n)
  return iso(d)
}

export function monthsAgo(n: number, from?: string): string {
  const d = from ? new Date(`${from}T12:00:00`) : new Date()
  d.setMonth(d.getMonth() - n)
  return iso(d)
}

/** The period a preset stands for (custom: the dates as typed). */
export function presetSpan(preset: Preset, start: string, end: string): { start: string; end: string } {
  if (preset === 'custom') return { start, end }
  if (preset === 'all') return { start: ALL_HISTORY, end: today() }
  return { start: yearsAgo(Number(preset)), end: today() }
}

export function paramDefaults(t: StrategyTemplate): Record<string, string> {
  return Object.fromEntries(t.params.map((p) => [p.name, String(p.default)]))
}

/** Numbers travel as numbers; anything else as typed, for the core to refuse in words. */
export function paramValue(raw: string, numeric: boolean): ParamValue {
  if (!numeric) return raw
  const n = Number(raw)
  return raw.trim() !== '' && Number.isFinite(n) ? n : raw
}

export const inputCls =
  'h-8 w-full rounded-lg border border-line bg-surface-2 px-2.5 text-[13px] text-ink outline-none transition-colors focus:border-accent disabled:opacity-50'

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** A window of a backtest's period to analyse (ISO dates). */
export interface Window {
  start: string
  end: string
}

/** A sensible first window: since the last exit (if recent), else the last year. */
export function defaultWindow(bt: Backtest): Window {
  const last = bt.trades[bt.trades.length - 1]
  const yearAgo = monthsAgo(12, bt.end)
  const from = last && last.outcome !== 'open' && last.exit_date > monthsAgo(24, bt.end) ? last.exit_date : yearAgo
  return { start: from < bt.start ? bt.start : from, end: bt.end }
}
