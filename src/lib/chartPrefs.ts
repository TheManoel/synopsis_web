import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Timeframe3 } from './types'

/** An indicator on the chart. `slot` is its colour (--s{slot+1}) for as long
 * as it stays: overlays keep their colour when others come and go. */
export interface ActiveIndicator {
  uid: string
  spec: string
  slot: number
}

export interface ChartPrefs {
  timeframe: Timeframe3
  range: string
  style: 'candles' | 'line'
  log: boolean
  indicators: ActiveIndicator[]
  /** McClellan's Timing Models on the chart (only where they apply). Absent in older prefs = off. */
  timing?: 'off' | 'all' | 'strong'
  /** The option chain's levels as lines (only on an underlying with a chain). */
  options?: boolean
}

const KEY = 'synopsis.symbols.chart'

const uid = () => Math.random().toString(36).slice(2, 10)

export function fromSpecs(specs: string[]): ActiveIndicator[] {
  return specs.map((spec, i) => ({ uid: uid(), spec, slot: i }))
}

function load(): ChartPrefs | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as ChartPrefs
    return Array.isArray(p.indicators) ? p : null
  } catch {
    return null
  }
}

/** The chart setup, kept across symbols and visits (this browser). `null`
 * until the catalog's defaults arrive the first time. */
export function useChartPrefs(defaults: string[] | undefined) {
  const [stored, setStored] = useState<ChartPrefs | null>(() => load())
  const fallback = useMemo<ChartPrefs | null>(
    () => (defaults ? { timeframe: 'd', range: '1y', style: 'candles', log: false, indicators: fromSpecs(defaults) } : null),
    [defaults],
  )
  const prefs = stored ?? fallback

  useEffect(() => {
    if (!stored) return
    try {
      localStorage.setItem(KEY, JSON.stringify(stored))
    } catch {
      /* storage unavailable: the setup lives for this session */
    }
  }, [stored])

  const edit = useCallback(
    (fn: (p: ChartPrefs) => ChartPrefs) => setStored((p) => (p ?? fallback ? fn((p ?? fallback)!) : p)),
    [fallback],
  )
  const update = useCallback((patch: Partial<ChartPrefs>) => edit((p) => ({ ...p, ...patch })), [edit])
  const add = useCallback(
    (spec: string) =>
      edit((p) => {
        const used = new Set(p.indicators.map((i) => i.slot))
        let slot = 0
        while (used.has(slot)) slot++
        return { ...p, indicators: [...p.indicators, { uid: uid(), spec, slot }] }
      }),
    [edit],
  )
  const replace = useCallback(
    (id: string, spec: string) => edit((p) => ({ ...p, indicators: p.indicators.map((i) => (i.uid === id ? { ...i, spec } : i)) })),
    [edit],
  )
  const remove = useCallback(
    (id: string) => edit((p) => ({ ...p, indicators: p.indicators.filter((i) => i.uid !== id) })),
    [edit],
  )
  const reset = useCallback((specs: string[]) => edit((p) => ({ ...p, indicators: fromSpecs(specs) })), [edit])
  return { prefs, update, add, replace, remove, reset }
}

/** `id:v1,v2` → the id and its raw values (serialisation only; the core validates). */
export function splitSpec(spec: string): { id: string; values: string[] } {
  const [id, rest] = spec.split(':')
  return { id, values: rest ? rest.split(',') : [] }
}
