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

// ---------------------------------------------------------------- relative strength (/rs)
// Leída del histórico guardado del core (analytics.rs_*). Todo valor por lente
// va indexado por la clave de lente (`rs_12m`, `rs_3m`, `rs_1m`); null = sin valor.

export type RsLensKey = string
export type ByLens<T> = Record<RsLensKey, T>

export interface RsLensRef {
  key: RsLensKey
  label: string
  description: string
  return_bars: number
}

export interface RsUniverse {
  code: string
  label: string
  benchmark_label: string
  first_bar: string
  last_bar: string
  n_bars: number
  market_last_bar: string | null
  lag_sessions: number | null
  lenses: RsLensRef[]
  deltas: { bars: number; label: string }[]
  leader_percentile: number
  laggard_percentile: number
  warnings: string[]
}

export interface RsBreadth {
  n_with_excess: number
  median_excess: number | null
  pct_beating: number | null
  median_return: number | null
}

export interface RsGroupLens {
  n_members: number
  mean_percentile: number
  pct_leaders: number
  pct_laggards: number
  net_participation: number
  mean_delta: number | null
  median_excess: number | null
  pct_beating: number | null
}

export type RsScope = 'sector' | 'industry'

export interface RsGroup {
  scope: RsScope
  code: string
  name: string
  sector_code: string | null
  n_members: number
  lenses: ByLens<RsGroupLens>
}

export interface RsMember {
  key: string
  ticker: string
  name: string
  sector_code: string | null
  industry_code: string | null
  percentile: ByLens<number | null>
  delta: ByLens<number | null>
  within_sector: ByLens<number | null>
  within_industry: ByLens<number | null>
  ret: ByLens<number | null>
  excess: ByLens<number | null>
  price_from_high: number | null
  rs_line_from_high: number | null
}

export interface RsBoard {
  universe: string
  universe_label: string
  benchmark: string | null
  requested: string | null
  bar_date: string
  delta_bars: number
  delta_date: string | null
  n_members: number
  n_ranked: ByLens<number>
  membership_as_of: string
  leader_percentile: number
  laggard_percentile: number
  lenses: RsLensRef[]
  summary: ByLens<RsBreadth>
  sectors: RsGroup[]
  industries: RsGroup[]
  members: RsMember[]
  warnings: string[]
}

export interface RsGroupSeries {
  universe: string
  scope: RsScope
  code: string
  name: string
  sector_code: string | null
  sampling: 'daily' | 'weekly'
  dates: string[]
  mean_percentile: ByLens<(number | null)[]>
  pct_leaders: ByLens<(number | null)[]>
  pct_laggards: ByLens<(number | null)[]>
  n_members: (number | null)[]
  leader_percentile: number
  laggard_percentile: number
  warnings: string[]
}

export interface RsMemberSeries {
  key: string
  ticker: string
  name: string
  universe: string | null
  universes: string[]
  sector_code: string | null
  sector_name: string | null
  industry_code: string | null
  industry_name: string | null
  sampling: 'daily' | 'weekly'
  dates: string[]
  percentile: ByLens<(number | null)[]>
  within_sector: ByLens<(number | null)[]>
  within_industry: ByLens<(number | null)[]>
  excess: ByLens<(number | null)[]>
  price_from_high: (number | null)[]
  rs_line_from_high: (number | null)[]
  warnings: string[]
}

export interface RsHeatmap {
  universe: string
  scope: RsScope
  sector: string | null
  lens: RsLensKey
  weeks: string[]
  rows: { code: string; name: string; sector_code: string | null; n_members: number | null; values: (number | null)[] }[]
  warnings: string[]
}

// ------------------------------------------------------------ Timing Models (McClellan)
export type TimingBlock = 'stocks' | 'bonds' | 'gold' | 'bc'

export interface TimingBlockInfo {
  code: TimingBlock
  label: string
  note: string
}

export interface TimingReport {
  report_no: number
  published_on: string
  prepared_on: string | null
  next_report_on: string | null
  /** The next issue should be out and is not loaded. */
  next_overdue: boolean
}

export interface TimingSignal {
  block: TimingBlock
  direction: 'top' | 'bottom' | 'volatility'
  /** BC: may invert. */
  implied: boolean
  source: string | null
  cluster: string | null
  strong: boolean
  predicted_raw: string
  predicted_from: string
  predicted_to: string
  first_report: number
  first_published: string
  last_report: number
  in_latest: boolean
  actual_status: 'hit' | 'missed' | 'forming' | 'unparsed' | null
  actual_raw: string | null
  actual_direction: 'top' | 'bottom' | null
  actual_date: string | null
  inverted: boolean
  upcoming: boolean
  /** Decided by the core: `awaiting` = date passed after the last report (not annotated yet);
   * `unrecorded` = passed before it and the author wrote no real date. */
  state: 'upcoming' | 'awaiting' | 'hit' | 'inverted' | 'missed' | 'forming' | 'unparsed' | 'unrecorded'
  /** The chart bar (or a `future_dates` slot) it is drawn on; null = off the chart. */
  chart_time: string | null
  actual_time: string | null
  /** The core's sentence. */
  text: string
  /** Checked against our prices (closing pivots), once its date has come. */
  check?: TimingCheck | null
}

export interface TimingCheck {
  on: string
  on_label: string
  /** hit = a closing turn within ±2 sessions, near = ±5. */
  verdict: 'hit' | 'near' | 'none' | 'pending'
  turn_date: string | null
  turn_kind: 'top' | 'bottom' | null
  offset: number | null
  text: string
}

export interface TimingScore {
  block: TimingBlock
  block_label: string
  subset: 'all' | 'strong'
  on: string
  on_label: string
  checked: number
  hits: number
  nears: number
  /** What any session of the same period would score: the bar to beat. */
  base_hit_pct: number | null
  base_near_pct: number | null
  near: number
  close: number
}

export interface SymbolTiming {
  key: string
  source: string
  applies: boolean
  blocks: TimingBlockInfo[]
  report: TimingReport | null
  signals: TimingSignal[]
  /** Bar slots after the last bar where forecasts fall: drawn as whitespace. */
  future_dates: string[]
  warnings: string[]
}

export interface TimingBoard {
  source: string
  blocks: TimingBlockInfo[]
  report: TimingReport | null
  signals: TimingSignal[]
  scorecard: TimingScore[]
  warnings: string[]
}

// ------------------------------------------------------------ Seasonality (cycles)
export interface CycleSegment {
  start: string
  end: string
  sessions: number
  total_pct: number
}

export interface CycleStudy {
  id: string
  label: string
  description: string
  source: string
  period_label: string
  /** Default reading: with its drift (raw) or only the shape (detrended). */
  reading: 'raw' | 'detrended'
  segments: CycleSegment[]
  current: CycleSegment
  axis: string[]
  mean_pct: number[]
  mean_detrended_pct: number[]
  current_pct: (number | null)[]
  projected_from: string | null
  position: number
  phase: string | null
  next_mark: string | null
  marks: { time: string; label: string }[]
  ahead_mean_pct: number | null
  ahead_positive: number
  ahead_total: number
  summary: string
  warnings: string[]
}

export interface Seasonality {
  key: string
  label: string
  studies: CycleStudy[]
  warnings: string[]
}

// ------------------------------------------------------------ analyst option levels on a price chart
export type AnalystLevelKind =
  | 'call_wall' | 'put_wall' | 'gamma_flip' | 'vol_trigger' | 'call_wall_0dte' | 'put_wall_0dte'
  | 'em_session_hi' | 'em_session_lo' | 'em_week_hi' | 'em_week_lo'

/** A post of the analyst and the session it applies to. */
export interface LevelSource {
  ref: string
  url: string | null
  known_at: string
  session: string
  /** Published with the session already open. */
  late: boolean
}

export interface AnalystLevel {
  kind: AnalystLevelKind
  value: number
  label: string
  text: string
  /** Sessions since its post (0 = published for this session). */
  age: number
  source: LevelSource
  /** The post's line it comes from. */
  evidence: string
  /** Other figures the same post gives for this level. */
  issues: string[]
  /** What the session did with the level (only once it has traded). */
  reaction: string | null
}

/** The close the author states against ours: the alignment proof. */
export interface CloseCheck {
  stated: number
  session: string
  ours: number | null
  diff_pct: number | null
  ok: boolean
  text: string
}

export interface SymbolOptionLevels {
  key: string
  applies: boolean
  feed: string | null
  feed_label: string | null
  binding: string | null
  as_of: string | null
  first_session: string | null
  last_session: string | null
  prior_session: string | null
  prior_close: number | null
  bar: { session: string; open: number; high: number; low: number; close: number } | null
  levels: AnalystLevel[]
  regime: string | null
  check: CloseCheck | null
  sources: LevelSource[]
  rejected: string[]
  warnings: string[]
}

export type LevelHistoryKind = 'call_wall' | 'put_wall' | 'gamma_flip' | 'vol_trigger' | 'em_session_hi' | 'em_session_lo'

/** The levels in force on every session of the chart, drawn as steps. */
export interface SymbolOptionLevelsHistory {
  key: string
  applies: boolean
  feed_label: string | null
  dates: string[]
  series: Partial<Record<LevelHistoryKind, (number | null)[]>>
  /** Sessions with a post of their own (no carry-over). */
  published: string[]
  alignment: string | null
  mismatches: CloseCheck[]
  warnings: string[]
}

// ---------------------------------------------------------------- admin (panel del sistema)
/** Salud que decide el core: ok · running · warn · down · idle (parado a propósito). */
export type AdminLevel = 'ok' | 'running' | 'warn' | 'down' | 'idle'
export type ServiceAction = 'start' | 'stop' | 'restart'

export interface AdminService {
  name: string
  label: string
  role: 'database' | 'orchestrator' | 'tool' | 'init' | string
  description: string
  container: string | null
  state: string
  health: string | null
  status_text: string
  started_at: string | null
  ports: string[]
  image: string | null
  url: string | null
  actions: ServiceAction[]
  stop_warning: string | null
  level: AdminLevel
  condition: string
}

export interface AdminSystem {
  compose_dir: string
  docker_available: boolean
  services: AdminService[]
  airflow_url: string
  level: AdminLevel
  warnings: string[]
}

export interface AdminLog {
  source: string
  lines: string[]
}

export interface AdminDataset {
  code: string
  label: string
  table: string
  cadence: 'sessions' | 'days'
  last: string | null
  lag: number | null
  level: AdminLevel
  text: string
  pipeline: string | null
  note: string | null
}

export interface AdminDatabase {
  reachable: boolean
  database: string | null
  version: string | null
  timescale: string | null
  size_bytes: number | null
  started_at: string | null
  max_connections: number | null
  connections: { state: string; count: number }[]
  connections_total: number | null
  schemas: { schema_name: string; size_bytes: number; tables: number }[]
  tables: { schema_name: string; table: string; size_bytes: number; rows_estimate: number | null }[]
  datasets: AdminDataset[]
  level: AdminLevel
  warnings: string[]
}

export type RunState = 'queued' | 'running' | 'success' | 'failed' | string

export interface AdminRun {
  run_id: string
  state: RunState
  run_type: string
  logical_date: string | null
  start: string | null
  end: string | null
  duration_s: number | null
  note: string | null
}

export interface AdminTracker {
  etl_run_id: string
  status: 'running' | 'success' | 'failed' | string
  start: string
  end: string | null
  duration_s: number | null
  row_count: number | null
  error: string | null
  facts: { key: string; value: string }[]
  warnings: string[]
}

export interface AdminPipeline {
  dag_id: string
  description: string | null
  tags: string[]
  paused: boolean
  schedule: string | null
  scheduled: boolean
  next_run: string | null
  next_run_due: boolean
  level: AdminLevel
  condition: string
  runs: AdminRun[]
  tracker: AdminTracker | null
  datasets: string[]
}

export interface AdminPipelines {
  airflow_url: string
  reachable: boolean
  pipelines: AdminPipeline[]
  running: number
  level: AdminLevel
  warnings: string[]
}

export interface AdminTask {
  task_id: string
  state: string | null
  try_number: number
  start: string | null
  end: string | null
  duration_s: number | null
  operator: string | null
}

export interface AdminRunDetail {
  dag_id: string
  run: AdminRun
  tasks: AdminTask[]
  tracker: AdminTracker | null
}

export interface AdminTaskLog {
  dag_id: string
  run_id: string
  task_id: string
  try_number: number
  text: string
}

export interface AdminSource {
  code: string
  label: string
  channel: string
  description: string
  pipeline: string
  credential: { key: string; label: string; configured: boolean | null; hint: string } | null
  counts: { key: string; value: string }[]
  /** published: ISO con hora (Substack) o solo fecha AAAA-MM-DD (McClellan). */
  items: { title: string; published: string; kind: string; url: string | null; complete: boolean; detail: string }[]
  level: AdminLevel
  warnings: string[]
}

export interface AdminSources {
  sources: AdminSource[]
}
