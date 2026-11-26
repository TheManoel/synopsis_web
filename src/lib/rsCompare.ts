import { useSyncExternalStore } from 'react'

/** An entity pinned to the comparison: a member or a group of one universe.
 *  `slot` is its series colour (--s1…--s8), given when pinned and kept while it
 *  stays: the colour follows the entity, never its position in the list. */
export interface CompareItem {
  universe: string
  kind: 'sector' | 'industry' | 'member'
  code: string
  label: string
  slot: number
}

export const COMPARE_MAX = 8
const KEY = 'synopsis.rs.compare'
const listeners = new Set<() => void>()
let cache: CompareItem[] | null = null

function read(): CompareItem[] {
  if (cache) return cache
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    cache = Array.isArray(raw) ? raw.filter((x) => x && typeof x.code === 'string') : []
  } catch {
    cache = []
  }
  return cache!
}

function write(items: CompareItem[]) {
  cache = items
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    /* storage unavailable: the list still works for this session */
  }
  listeners.forEach((l) => l())
}

export const sameItem = (a: Pick<CompareItem, 'universe' | 'kind' | 'code'>, b: Pick<CompareItem, 'universe' | 'kind' | 'code'>) =>
  a.universe === b.universe && a.kind === b.kind && a.code === b.code

export function useCompare(): CompareItem[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    read,
    () => [],
  )
}

/** Pins or unpins; returns false when the list is full. */
export function toggleCompare(item: Omit<CompareItem, 'slot'>): boolean {
  const items = read()
  if (items.some((x) => sameItem(x, item))) {
    write(items.filter((x) => !sameItem(x, item)))
    return true
  }
  if (items.length >= COMPARE_MAX) return false
  const used = new Set(items.map((x) => x.slot))
  const slot = [...Array(COMPARE_MAX).keys()].find((s) => !used.has(s)) ?? 0
  write([...items, { ...item, slot }])
  return true
}

export const clearCompare = () => write([])
