// Mirrors of the /api/v2 DTOs (screener_core: src/applications/synopsis/models.py).

export type Kind = 'price' | 'yield' | 'level' | 'spread'

export interface Change {
  horizon: string
  value: number | null
  pct: number | null
}

/** The provisional tail of a series: sessions the quote provider already has
 * and the base (end-of-day ETL) does not yet. `as_of`/`last` = current price. */
export interface LiveQuote {
  provisional_from: string
  as_of: string
  last: number
  fetched_at: string
  source: string
  /** The last bar's session is still open: its close is the latest quote. */
  in_progress: boolean
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
  live: LiveQuote | null
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
  live: LiveQuote | null
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
export type ParamValue = number | string | boolean

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
  /** builtin = shipped template (read-only); user = saved from the editor. */
  origin: 'builtin' | 'user'
  based_on: string | null
}

// -- rule editor: the vocabulary and the composition (src/core/strategy_lab/domain/rules.py)

export type Scale = 'price' | 'points' | 'percent'

/** A knob of a series kind (an average's period) or of a condition (a divergence's windows). */
export interface KindParam {
  name: string
  label: string
  type: 'int' | 'float' | 'choice' | 'bool'
  default: ParamValue
  min: number | null
  max: number | null
  choices: { value: string; label: string }[]
  unit: string | null
  /** Only used when another choice param takes one of these values; left out otherwise. */
  applies_when?: Record<string, string[]> | null
}

export interface SeriesKind {
  kind: string
  label: string
  description: string
  params: KindParam[]
  /** null = the scale of the series it is applied to (`of`). */
  scale: Scale | null
  accepts_of: boolean
}

export interface ConditionOp {
  op: string
  label: string
  hint: string
  operand: 'series_or_value' | 'series'
  takes_pct: boolean
  takes_bars: boolean
  /** B can be a series of any scale (a divergence: oscillator against price). */
  any_scale: boolean
  /** The op's own knobs, as a series kind's. */
  params: KindParam[]
}

export interface RulesVocabulary {
  series_kinds: SeriesKind[]
  conditions: ConditionOp[]
  combinators: { value: Combinator; label: string }[]
  sides: { value: string; label: string }[]
  scales: { value: Scale; label: string; unit: string }[]
  max_series: number
  max_conditions: number
  max_depth: number
  max_bars: number
  max_pct: number
  /** Where a strategy written from scratch starts (rules the core accepts). */
  starter: Composition
}

export type Combinator = 'all' | 'any'

export interface SeriesDef {
  id: string
  kind: string
  params: Record<string, ParamValue>
  of?: string
}

/** B of a condition: another series or a number on A's scale. */
export type Operand = { series: string } | { value: number | string }

export interface RuleCondition {
  a: string
  op: string
  b: Operand
  pct?: number | string
  bars?: number | string
  /** The op's own knobs (only ops that have them). */
  params?: Record<string, ParamValue>
}

export interface RuleGroup {
  combinator: Combinator
  conditions: (RuleCondition | RuleGroup)[]
}

export interface Composition {
  side: string
  series: SeriesDef[]
  entry: RuleGroup
  exit: RuleGroup
}

export interface RulesRequest {
  strategy?: string
  params?: Record<string, ParamValue>
  rules?: Composition
}

export interface RulesPreview {
  rules: Composition
  entry_text: string
  exit_text: string
  series: { id: string; label: string; scale: Scale }[]
  warmup_bars: number
}

export interface SaveStrategyRequest {
  label: string
  description: string
  rules: Composition
  based_on: string | null
  replace_id: string | null
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
  vocabulary: RulesVocabulary
  /** Saved strategies that could not be loaded, in words. */
  warnings: string[]
}

/** A catalog strategy with its params, or hand-written `rules` (then `label` names them). */
export interface BacktestRequest {
  strategy?: string
  params?: Record<string, ParamValue>
  rules?: Composition
  label?: string
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

/** One stretch during which the ceiling/floor the rules read has the same
 * points: it forms from `first_point` and is the level from `start` to `end`;
 * the zone is the centroid ± the tolerance (`lower`…`upper`). */
export interface ZoneEpisode {
  first_point: string
  start: string
  end: string
  lower: number
  centroid: number
  upper: number
  points: { date: string; price: number }[]
  /** interval: one of its points leaves it; new_point: a new one changes the K. */
  end_reason: 'open' | 'interval' | 'new_point'
  /** The episode in words (the core writes it). */
  text: string
}

export interface Overlay {
  id: string
  label: string
  scale: Scale
  values: (number | null)[]
  /** line: draw the values; zones: draw `zones` (a ceiling/floor). */
  shape: 'line' | 'zones'
  zones: ZoneEpisode[]
}

/** Every daily series on one calendar (columnar); null = no value that day. */
export interface BacktestSeries {
  dates: string[]
  price: (number | null)[]
  /** The rest of the bar (the candles). */
  open: (number | null)[]
  high: (number | null)[]
  low: (number | null)[]
  equity: (number | null)[]
  benchmark_equity: (number | null)[]
  drawdown: (number | null)[]
  benchmark_drawdown: (number | null)[]
  overlays: Overlay[]
}

export interface Backtest {
  /** "custom" for hand-written rules. */
  strategy_id: string
  strategy_label: string
  params: Record<string, ParamValue>
  /** The rules that ran, as the editor edits them. */
  rules: Composition
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

/** A backtest's request plus the window to explain (inside its period). */
export interface DiagnoseRequest extends BacktestRequest {
  window_start: string
  window_end: string
}

/** pct: % of B (price series) · pp: percentage points · points: oscillator points. */
export type MarginUnit = 'pct' | 'pp' | 'points'

/** A condition or a group of a rule over the window's sessions. */
export interface TraceNode {
  kind: 'condition' | 'group'
  text: string
  combinator: 'all' | 'any' | null
  /** Per session: held or not; null while its inputs are undefined (warm-up). */
  held: (boolean | null)[]
  held_count: number
  /** Comparisons: how far from holding, per session (> 0: on the side it asks for). */
  margin: (number | null)[] | null
  margin_unit: MarginUnit | null
  summary: string
  last_before: string | null
  children: TraceNode[]
}

export type SignalStatus = 'taken' | 'in_position' | 'unfilled'

export interface Diagnosis {
  strategy_label: string
  instrument_key: string
  instrument_label: string
  entry_text: string
  exit_text: string
  window_start: string
  window_end: string
  sessions: number
  dates: string[]
  closes: number[]
  in_position: boolean[]
  signals: { date: string; status: SignalStatus }[]
  entries: string[]
  exits: string[]
  verdict: string
  reasons: string[]
  entry: TraceNode
  exit: TraceNode
  max_sessions: number
  warnings: string[]
}

// ---------------------------------------------------------------- symbols

export type IndicatorUnit = 'price' | 'percent' | 'oscillator' | 'points' | 'volume' | 'index' | 'percentile'
export type Timeframe3 = 'd' | 'w' | 'm'

export interface IndicatorParam {
  key: string
  label: string
  kind: 'int' | 'float' | 'choice'
  default: number | string
  min: number | null
  max: number | null
  step: number | null
  choices: { value: string; label: string }[]
}

export interface IndicatorDef {
  id: string
  label: string
  group: string
  placement: 'overlay' | 'pane'
  unit: IndicatorUnit
  description: string
  params: IndicatorParam[]
  outputs: { key: string; label: string; style: 'line' | 'dashed' | 'histogram' }[]
  levels: number[]
  needs_benchmark: boolean
  stored: boolean
  default_spec: string
}

export interface IndicatorCatalog {
  groups: { title: string; indicators: IndicatorDef[] }[]
  default_specs: string[]
  timeframes: { value: string; label: string }[]
  ranges: { value: string; label: string }[]
}

export interface SymbolHit {
  key: string
  ticker: string
  exchange: string
  name: string | null
  asset_type: string | null
  active: boolean
  country: string | null
  currency: string | null
}

export interface WatchItem {
  key: string
  ticker: string
  name: string | null
  asset_type: string | null
  kind: Kind
  last: number | null
  as_of: string | null
  change_1d: number | null
  change_1m: number | null
  ytd: number | null
  trend: InstrumentCard['trend']
  spark: number[]
  warnings: string[]
}

export interface Watchlist {
  items: WatchItem[]
  warnings: string[]
}

export interface TaxonomyRef {
  code: string
  name: string
}

export interface SymbolReference {
  role: 'index' | 'sector' | 'industry'
  key: string
  label: string
}

export interface HorizonMove {
  horizon: string
  start: string | null
  ret: number | null
  /** Move of the RS line (asset / reference), %. */
  relative: number | null
}

export interface RelativeRow {
  role: string
  key: string
  label: string
  moves: HorizonMove[]
}

export interface RelativeTable {
  horizons: string[]
  asset: RelativeRow
  references: RelativeRow[]
  note: string
}

export interface RsLensReading {
  key: string
  label: string
  percentile: number | null
  change_1m: number | null
  within_sector: number | null
  within_industry: number | null
  ret: number | null
  excess: number | null
  n_ranked: number | null
}

export interface RsRank {
  universe_code: string
  universe_label: string
  benchmark_label: string
  as_of: string
  lenses: RsLensReading[]
  price_from_high: number | null
  rs_line_from_high: number | null
  reading: string
  warnings: string[]
}

export interface StageSegment {
  stage: string
  label: string
  start: string
  end: string
}

export interface StageInfo {
  stage: string
  label: string
  meaning: string
  conviction: number
  since: string
  base_count: number
  base_note: string
  contested: boolean
  leader: string | null
  leader_label: string | null
  scores: { stage: string; label: string; score: number }[]
  segments: StageSegment[]
  benchmark_label: string | null
  note: string
}

export interface TechnicalReading {
  code: string
  label: string
  value: number | null
  unit: 'percent' | 'oscillator' | 'ratio' | 'price'
  text: string
  tone: 'up' | 'down' | 'warn' | 'neutral'
}

export interface EarningsRow {
  date: string
  eps: number | null
  estimate: number | null
  surprise_pct: number | null
  yoy_pct: number | null
}

export interface SymbolProfile {
  key: string
  ticker: string
  exchange: string
  name: string
  asset_type: string | null
  currency: string | null
  country: string | null
  status: string | null
  successor: string | null
  sector: TaxonomyRef | null
  industry: TaxonomyRef | null
  universes: TaxonomyRef[]
  reading: InstrumentCard
  technicals: TechnicalReading[]
  references: SymbolReference[]
  relative: RelativeTable | null
  rs_rank: RsRank | null
  stage: StageInfo | null
  earnings: { last: EarningsRow[]; next_date: string | null; warnings: string[] } | null
  warnings: string[]
}

export interface ChartEvent {
  time: string
  kind: 'earnings'
  label: string
  text: string
}

export interface SymbolChart {
  key: string
  label: string
  timeframe: Timeframe3
  range: string
  dates: string[]
  open: number[]
  high: number[]
  low: number[]
  close: number[]
  volume: (number | null)[]
  has_ohlc: boolean
  has_volume: boolean
  last_bar_partial: boolean
  events: ChartEvent[]
  live: LiveQuote | null
  warnings: string[]
}

export interface IndicatorSeries {
  spec: string
  id: string
  label: string
  placement: 'overlay' | 'pane'
  unit: IndicatorUnit
  levels: number[]
  dates: string[]
  lines: { key: string; label: string; style: 'line' | 'dashed' | 'histogram'; values: (number | null)[] }[]
  reference: SymbolReference | null
  warnings: string[]
}
