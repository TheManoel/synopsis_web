import { useMemo, useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light'
const KEY = 'synopsis.theme'

function current(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

const listeners = new Set<() => void>()

export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t
  try {
    localStorage.setItem(KEY, t)
  } catch {
    /* storage unavailable: theme still applies for this session */
  }
  listeners.forEach((l) => l())
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    current,
    () => 'dark',
  )
}

/** Resolved values of CSS custom properties, re-read when the theme changes.
 *  Canvas-based charts (lightweight-charts) cannot read var(--x) themselves. */
export function useCssVars<K extends string>(names: readonly K[]): Record<K, string> {
  const theme = useTheme()
  const key = names.join('|')
  return useMemo(() => {
    const cs = getComputedStyle(document.documentElement)
    return Object.fromEntries(key.split('|').map((n) => [n, cs.getPropertyValue(`--${n}`).trim()])) as Record<K, string>
    // `theme` is the trigger: the CSS variables change when it does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, key])
}

export const SERIES_VARS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'] as const

/** The fixed series colour of position `i` (--s1…--s8): a series keeps its
 *  colour wherever it is drawn. */
export const seriesColor = (i: number) => `var(--s${(i % 8) + 1})`
