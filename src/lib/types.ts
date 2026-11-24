// Mirrors of the /api/v2 DTOs (screener_core: src/applications/synopsis/models.py).

export type Kind = 'price' | 'yield' | 'level' | 'spread'

export interface Change {
  horizon: string
  value: number | null
  pct: number | null
}

export interface InstrumentCard {
  key: string
  label: string
  kind: Kind
  is_ratio: boolean
  note: string | null
  last: number | null
  as_of: string | null
  session_in_progress: boolean
  changes: Change[]
  high_52w: number | null
  low_52w: number | null
  range_position: number | null
  /** Distance to the 52-week high, in the unit of `kind` (%, bp, points). */
  from_high: number | null
  sma50: number | null
  sma200: number | null
  /** Distance to SMA50 / SMA200 in the unit of `kind`. */
  dist_sma50: number | null
  dist_sma200: number | null
  trend: 'up' | 'down' | 'mixed' | 'unknown'
  realized_vol_21d: number | null
  spark: number[]
  warnings: string[]
}

export interface Group {
  code: string
  title: string
  comparable: boolean
  cards: InstrumentCard[]
}

export interface Section {
  code: string
  title: string
  subtitle: string
  groups: Group[]
  generated_at: string
}

export interface SeriesPoint {
  time: string
  open: number | null
  high: number | null
  low: number | null
  close: number
}

export interface LinePoint {
  time: string
  value: number
}

export interface InstrumentSeries {
  key: string
  label: string
  kind: Kind
  has_ohlc: boolean
  bars: SeriesPoint[]
  sma50: LinePoint[]
  sma200: LinePoint[]
  warnings: string[]
}

export interface Performance {
  section: string
  group: string
  start: string | null
  lines: { key: string; label: string; points: LinePoint[]; total_return_pct: number | null }[]
  warnings: string[]
}

export interface Gauge {
  code: string
  label: string
  value: number | null
  unit: 'pts' | '%' | 'ratio' | 'count'
  change_5d: number | null
  zone: 'overbought' | 'oversold' | 'positive' | 'negative' | 'neutral' | 'unknown'
  zone_label: string
  explain: string
}

export interface Signal {
  code: string
  label: string
  state: 'bullish' | 'bearish' | 'neutral'
  headline: string
  detail: string
  last_event: string | null
}

export interface BreadthBoard {
  universe: string
  benchmark_label: string
  as_of: string | null
  gauges: Gauge[]
  signals: Signal[]
  dates: string[]
  series: Record<string, (number | null)[]>
  warnings: string[]
}

export interface TermPoint {
  expiry: string
  days: number
  forward: number
  discount: number
  implied_rate: number | null
  forward_method: string
  atm_iv: number | null
  expected_move: number | null
  expected_move_pct: number | null
  straddle: number | null
  rr25: number | null
  put25_iv: number | null
  call25_iv: number | null
  warnings: string[]
}

export interface StrikeExposure {
  strike: number
  call_gex: number
  put_gex: number
  net_gex: number
  call_weight: number
  put_weight: number
}

export type Basis = 'auto' | 'open_interest' | 'volume'

export interface Positioning {
  basis: Exclude<Basis, 'auto'>
  oi_coverage: number
  max_days: number
  expiries: string[]
  strikes: StrikeExposure[]
  spot_grid: number[]
  gamma_curve: number[]
  total_gex: number
  zero_gamma: number | null
  call_wall: number | null
  put_wall: number | null
  max_pain: number | null
  pcr_weight: number | null
  excluded_weight_share: number
  warnings: string[]
}

export interface SnapshotMeta {
  underlying: string
  root: string
  spot: number
  spot_time: string | null
  fetched_at: string
  source: string
  delay_minutes: number | null
  contracts: number
  expiries: string[]
  warnings: string[]
  assumptions: string[]
}

export interface OptionsSummary {
  meta: SnapshotMeta
  term: TermPoint[]
  atm_iv_30d: number | null
  positioning: Positioning
}

export interface QuoteSide {
  bid: number | null
  ask: number | null
  mid: number | null
  last: number | null
  volume: number | null
  open_interest: number | null
  provider_iv: number | null
  delta: number | null
}

export interface ChainRow {
  strike: number
  iv: number | null
  gamma: number | null
  call: QuoteSide | null
  put: QuoteSide | null
}

export interface ExpiryDetail {
  meta: SnapshotMeta
  term: TermPoint
  basis: Exclude<Basis, 'auto'>
  oi_coverage: number
  max_pain: number | null
  pcr_weight: number | null
  pcr_volume: number | null
  rows: ChainRow[]
  warnings: string[]
}

export interface VolContext {
  as_of: string | null
  readings: { code: string; label: string; value: number | null; percentile_1y: number | null; change_5d: number | null }[]
  term_ratio: number | null
  realized_vol_21d: number | null
  variance_premium: number | null
  dates: string[]
  series: Record<string, (number | null)[]>
  warnings: string[]
}
