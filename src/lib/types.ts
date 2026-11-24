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

// ---------------------------------------------------------------- groups & rotation

export type Quadrant = 'Leading' | 'Weakening' | 'Lagging' | 'Improving'
export type Timeframe = 'weekly' | 'daily'

export interface RotationUniverseRef {
  code: string
  title: string
  subtitle: string
  benchmark_label: string
  has_participation: boolean
}

export interface TrailPoint {
  date: string
  ratio: number
  momentum: number
  quadrant: Quadrant
}

export interface Excess {
  horizon: string
  group_pct: number | null
  bench_pct: number | null
  /** group_pct − bench_pct, percentage points. */
  excess_pp: number | null
}

export interface RotationGroup {
  symbol: string
  /** `TICKER@MIC`, for /markets/instruments/{key}/series. */
  key: string
  label: string
  as_of: string | null
  quadrant: Quadrant | null
  ratio: number | null
  momentum: number | null
  dwell_bars: number | null
  /** Mean step over the last 4 bars, RRG points. */
  velocity: number | null
  /** 0° = RS-Ratio rising (east), 90° = RS-Momentum rising (north). */
  heading_deg: number | null
  distance: number | null
  trail: TrailPoint[]
  excess: Excess[]
  warnings: string[]
}

export interface QuadrantEvent {
  symbol: string
  label: string
  date: string
  from_quadrant: Quadrant
  to_quadrant: Quadrant
  velocity: number
  heading_deg: number
}

export interface RotationSignalEvent {
  symbol: string
  label: string
  date: string
  kind: string
  name: string
  description: string
  polarity: 'bullish' | 'bearish'
  quadrant: Quadrant
  ratio: number
  momentum: number
}

export interface RotationBoard {
  code: string
  title: string
  subtitle: string
  timeframe: Timeframe
  benchmark_key: string
  benchmark_label: string
  peer_note: string
  as_of: string | null
  bar_in_progress: boolean
  dates: string[]
  quadrant_counts: Record<Quadrant, number>
  groups: RotationGroup[]
  events: QuadrantEvent[]
  signals: RotationSignalEvent[]
  signals_note: string
  generated_at: string
  warnings: string[]
}

export interface ParticipationRow {
  code: string
  name: string
  symbol: string | null
  n_members: number
  mean_percentile: number
  pct_leaders: number
  pct_laggards: number
  net_participation: number
  mean_delta: number | null
}

export type ParticipationLens = 'rs_1m' | 'rs_3m' | 'rs_12m'

export interface Participation {
  code: string
  universe: string
  scope: string
  lens_key: ParticipationLens
  lens_label: string
  bar_date: string
  delta_bars: number
  leader_percentile: number
  laggard_percentile: number
  rows: ParticipationRow[]
  warnings: string[]
}

export interface RelativeLine {
  symbol: string
  label: string
  benchmark_label: string
  start: string | null
  points: LinePoint[]
  change_pct: number | null
  warnings: string[]
}

// ---------------------------------------------------------------- strategy lab

export type EntryPoint = 'open_t1' | 'close_t'
export type ParamValue = number | string

export interface StrategyParam {
  name: string
  label: string
  type: 'int' | 'float' | 'choice'
  default: ParamValue
  min: number | null
  max: number | null
  choices: { value: string; label: string }[]
  unit: string | null
  description: string | null
}

export interface StrategyTemplate {
  id: string
  label: string
  summary: string
  description: string
  side: 'long' | 'short'
  params: StrategyParam[]
  /** Relations between params, in words. */
  constraints: string[]
}

export interface LabInstrument {
  key: string
  label: string
  group: string
  note: string | null
}

export interface StrategyLabCatalog {
  strategies: StrategyTemplate[]
  instruments: LabInstrument[]
  entry_points: { value: EntryPoint; label: string; hint: string }[]
  default_strategy: string
  default_instrument: string
  default_entry_point: EntryPoint
  default_cost_bps: number
  max_cost_bps: number
}

export interface BacktestRequest {
  strategy: string
  params: Record<string, ParamValue>
  instrument: string
  start: string
  end: string
  entry_point: EntryPoint
  cost_bps: number
}

export interface PerformanceSummary {
  total_return_pct: number | null
  cagr_pct: number | null
  max_drawdown_pct: number | null
  sharpe: number | null
  exposure_pct: number | null
}

export interface TradeStats {
  n_trades: number
  n_open: number
  n_wins: number
  win_rate_pct: number | null
  profit_factor: number | null
  mean_return_pct: number | null
  median_return_pct: number | null
  avg_win_pct: number | null
  avg_loss_pct: number | null
  bars_held_median: number | null
  mfe_median_pct: number | null
  mae_median_pct: number | null
}

export interface BacktestTrade {
  signal_date: string
  entry_date: string
  entry_price: number
  exit_date: string
  exit_price: number
  outcome: 'signal' | 'open' | 'stop' | 'target'
  return_pct: number
  gross_return_pct: number
  bars_held: number
  mfe_pct: number | null
  mae_pct: number | null
}

export interface BacktestYear {
  year: number
  return_pct: number | null
  benchmark_pct: number | null
  excess_pct: number | null
  max_drawdown_pct: number | null
}

/** Every daily series on one calendar (columnar); null = no value that day. */
export interface BacktestSeries {
  dates: string[]
  price: (number | null)[]
  equity: (number | null)[]
  benchmark_equity: (number | null)[]
  drawdown: (number | null)[]
  benchmark_drawdown: (number | null)[]
  overlays: { id: string; label: string; values: (number | null)[] }[]
}

export interface Backtest {
  strategy_id: string
  strategy_label: string
  params: Record<string, ParamValue>
  side: 'long' | 'short'
  entry_text: string
  exit_text: string
  instrument_key: string
  instrument_label: string
  start: string
  end: string
  sessions: number
  entry_point: EntryPoint
  cost_bps: number
  rules_defined_from: string | null
  benchmark_label: string
  strategy: PerformanceSummary
  benchmark: PerformanceSummary | null
  trade_stats: TradeStats
  entry_signals: number
  skipped_in_position: number
  unfilled_signals: number
  series: BacktestSeries
  trades: BacktestTrade[]
  years: BacktestYear[]
  conventions: string[]
  warnings: string[]
  generated_at: string
}
