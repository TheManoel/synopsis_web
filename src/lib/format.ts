import type { Change, Kind } from './types'

const LOCALE = 'es-ES'
const cache = new Map<string, Intl.NumberFormat>()

function nf(min: number, max: number, extra: Intl.NumberFormatOptions = {}) {
  const k = `${min}|${max}|${JSON.stringify(extra)}`
  let f = cache.get(k)
  if (!f) {
    f = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: min, maximumFractionDigits: max, ...extra })
    cache.set(k, f)
  }
  return f
}

export const DASH = '—'

/** Decimals that keep ~5 significant digits for a price-like level. */
export function priceDecimals(v: number): number {
  const a = Math.abs(v)
  if (a >= 1000) return 2
  if (a >= 10) return 2
  if (a >= 1) return 4
  return 5
}

export function fmtLevel(v: number | null | undefined, kind: Kind = 'price'): string {
  if (v == null || !Number.isFinite(v)) return DASH
  if (kind === 'yield') return `${nf(3, 3).format(v)}%`
  if (kind === 'spread') return `${nf(1, 1).format(v)} pb`
  const d = priceDecimals(v)
  return nf(d, d).format(v)
}

export function fmtNum(v: number | null | undefined, decimals = 2): string {
  if (v == null || !Number.isFinite(v)) return DASH
  return nf(decimals, decimals).format(v)
}

export function fmtSigned(v: number | null | undefined, decimals = 2, suffix = ''): string {
  if (v == null || !Number.isFinite(v)) return DASH
  const s = nf(decimals, decimals, { signDisplay: 'exceptZero' }).format(v)
  return `${s}${suffix}`
}

export const fmtPct = (v: number | null | undefined, decimals = 2) => fmtSigned(v, decimals, '%')

/** A horizon move in the instrument's unit: % for prices, bp for yields, pts for levels. */
export function fmtChange(c: Change | undefined, kind: Kind): string {
  if (!c || c.value == null) return DASH
  if (kind === 'yield' || kind === 'spread') return fmtSigned(c.value, 1, ' pb')
  if (kind === 'level') return fmtSigned(c.value, 2)
  return fmtPct(c.value)
}

/** A signed distance in the instrument's unit (used for "from 52w high"). */
export function fmtInUnit(v: number | null | undefined, kind: Kind): string {
  if (kind === 'yield' || kind === 'spread') return fmtSigned(v, 1, ' pb')
  if (kind === 'level') return fmtSigned(v, 2)
  return fmtPct(v, 1)
}

export function fmtCompact(v: number | null | undefined, decimals = 1): string {
  if (v == null || !Number.isFinite(v)) return DASH
  return nf(0, decimals, { notation: 'compact', compactDisplay: 'short' }).format(v)
}

/** Dollar gamma exposure: $ per 1% move, in billions/millions. */
export function fmtUsdCompact(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return DASH
  const a = Math.abs(v)
  const sign = v < 0 ? '−' : v > 0 ? '+' : ''
  if (a >= 1e9) return `${sign}${nf(2, 2).format(a / 1e9)} mm$`
  if (a >= 1e6) return `${sign}${nf(1, 1).format(a / 1e6)} M$`
  return `${sign}${nf(0, 0).format(a)} $`
}

export const fmtIv = (v: number | null | undefined, decimals = 1) =>
  v == null || !Number.isFinite(v) ? DASH : `${nf(decimals, decimals).format(v * 100)}%`

const dateFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })
const shortDate = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' })
const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })

const asDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)

export const fmtDate = (iso: string | null | undefined) => (iso ? dateFmt.format(asDate(iso)) : DASH)
export const fmtShortDate = (iso: string | null | undefined) => (iso ? shortDate.format(asDate(iso)) : DASH)
export const fmtTime = (iso: string | null | undefined) => (iso ? timeFmt.format(new Date(iso)) : DASH)

export function tone(v: number | null | undefined): 'up' | 'down' | 'flat' {
  if (v == null || !Number.isFinite(v) || v === 0) return 'flat'
  return v > 0 ? 'up' : 'down'
}
