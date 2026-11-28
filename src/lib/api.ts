import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AdminDatabase,
  AdminLog,
  AdminPipelines,
  AdminRun,
  AdminRunDetail,
  AdminService,
  AdminSources,
  AdminSystem,
  AdminTaskLog,
  ServiceAction,
  SymbolOptionLevels,
  SymbolOptionLevelsHistory,
  Seasonality,
  SymbolTiming,
  TimingBoard,
  Backtest,
  BacktestRequest,
  Basis,
  BreadthBoard,
  Diagnosis,
  DiagnoseRequest,
  ExpiryDetail,
  IndicatorCatalog,
  IndicatorSeries,
  InstrumentSeries,
  OiChanges,
  OptionsSummary,
  Participation,
  ParticipationLens,
  Performance,
  RelativeLine,
  RotationBoard,
  RotationUniverseRef,
  RsBoard,
  RsGroupSeries,
  RsHeatmap,
  RsMemberSeries,
  RsScope,
  RsUniverse,
  RulesPreview,
  RulesRequest,
  SaveStrategyRequest,
  Section,
  StrategyLabCatalog,
  StrategyTemplate,
  StrikeHistory,
  LabUniverses,
  UniverseBacktestJob,
  UniverseBacktestRequest,
  UniverseScreenJob,
  UniverseScreenRequest,
  SymbolChart,
  SymbolHit,
  SymbolProfile,
  Timeframe,
  VolContext,
  Watchlist,
} from './types'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function get<T>(path: string): Promise<T> {
  return request<T>(path)
}

async function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

async function put<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

async function del(path: string): Promise<void> {
  await request<void>(path, { method: 'DELETE' })
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v2${path}`, init)
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail =
        typeof body.detail === 'string'
          ? body.detail
          : Array.isArray(body.detail) // FastAPI validation: [{loc, msg}, …]
            ? body.detail.map((d: { loc?: unknown[]; msg?: string }) => `${d.loc?.at(-1) ?? ''}: ${d.msg ?? ''}`).join(' · ')
            : JSON.stringify(body.detail)
    } catch {
      /* body was not JSON */
    }
    throw new ApiError(res.status, detail)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

const enc = encodeURIComponent

/** Price reads reach the current (delayed) quote; the core refreshes it once a minute. */
const LIVE = 60_000

export const useSection = (code: string) =>
  useQuery({ queryKey: ['section', code], queryFn: () => get<Section>(`/markets/sections/${code}`), refetchInterval: LIVE })

export const useInstrumentSeries = (key: string | null, bars: number) =>
  useQuery({
    queryKey: ['series', key, bars],
    queryFn: () => get<InstrumentSeries>(`/markets/instruments/${enc(key!)}/series?bars=${bars}`),
    enabled: !!key,
    placeholderData: keepPreviousData,
    refetchInterval: LIVE,
  })

/** Several instruments' series at once (e.g. the Treasury curve levels). */
export const useSeriesMany = (keys: string[], bars: number) =>
  useQueries({
    queries: keys.map((key) => ({
      queryKey: ['series', key, bars],
      queryFn: () => get<InstrumentSeries>(`/markets/instruments/${enc(key)}/series?bars=${bars}`),
      refetchInterval: LIVE,
    })),
  })

export const usePerformance = (section: string, group: string | null, bars: number) =>
  useQuery({
    queryKey: ['performance', section, group, bars],
    queryFn: () => get<Performance>(`/markets/sections/${section}/groups/${group}/performance?bars=${bars}`),
    enabled: !!group,
    placeholderData: keepPreviousData,
    refetchInterval: LIVE,
  })

export const useBreadth = (bars: number) =>
  useQuery({
    queryKey: ['breadth', 'nyse', bars],
    queryFn: () => get<BreadthBoard>(`/breadth/nyse?bars=${bars}`),
    placeholderData: keepPreviousData,
  })

export const useOptionsSummary = (basis: Basis, maxDays: number, refreshNonce: number) =>
  useQuery({
    queryKey: ['options', 'spx', basis, maxDays, refreshNonce],
    queryFn: () =>
      get<OptionsSummary>(`/options/spx/summary?basis=${basis}&max_days=${maxDays}${refreshNonce ? '&refresh=true' : ''}`),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

export const useExpiryDetail = (expiry: string | null, basis: Basis, refreshNonce: number) =>
  useQuery({
    queryKey: ['options', 'spx', 'expiry', expiry, basis, refreshNonce],
    queryFn: () => get<ExpiryDetail>(`/options/spx/expiries/${expiry}?basis=${basis}&band=0.1`),
    enabled: !!expiry,
    placeholderData: keepPreviousData,
  })

export const useStrikeHistory = (pick: { expiry: string; strike: number; right: 'C' | 'P' } | null) =>
  useQuery({
    queryKey: ['options', 'spx', 'history', 'strike', pick],
    queryFn: () =>
      get<StrikeHistory>(`/options/spx/history/strike?expiry=${pick!.expiry}&strike=${pick!.strike}&right=${pick!.right}`),
    enabled: !!pick,
    placeholderData: keepPreviousData,
  })

/** 409 = aún no hay fotos de dos sesiones: se muestra el motivo, no es un fallo. */
export const useOiChanges = (maxDays: number) =>
  useQuery({
    queryKey: ['options', 'spx', 'history', 'oi', maxDays],
    queryFn: () => get<OiChanges>(`/options/spx/history/oi-changes?top=20&max_days=${maxDays}`),
    retry: false,
  })

export const useVolContext = (bars: number) =>
  useQuery({
    queryKey: ['options', 'spx', 'vol', bars],
    queryFn: () => get<VolContext>(`/options/spx/vol-context?bars=${bars}`),
    placeholderData: keepPreviousData,
  })

export const useRotationUniverses = () =>
  useQuery({ queryKey: ['groups'], queryFn: () => get<RotationUniverseRef[]>('/groups'), staleTime: Infinity })

export const useRotationBoard = (code: string, timeframe: Timeframe) =>
  useQuery({
    queryKey: ['groups', code, 'rotation', timeframe],
    queryFn: () => get<RotationBoard>(`/groups/${code}/rotation?timeframe=${timeframe}`),
    placeholderData: keepPreviousData,
  })

export const useRelativeLine = (code: string, symbol: string | null, bars: number) =>
  useQuery({
    queryKey: ['groups', code, 'relative', symbol, bars],
    queryFn: () => get<RelativeLine>(`/groups/${code}/relative/${enc(symbol!)}?bars=${bars}`),
    enabled: !!symbol,
    placeholderData: keepPreviousData,
  })

/** The components' RS panel: slow when cold (~1 min), cached by the core afterwards. */
export const useParticipation = (code: string, lens: ParticipationLens, enabled: boolean) =>
  useQuery({
    queryKey: ['groups', code, 'participation', lens],
    queryFn: () => get<Participation>(`/groups/${code}/participation?lens=${lens}`),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 15 * 60_000,
    retry: 0,
  })

export const useStrategyLabCatalog = () =>
  useQuery({
    queryKey: ['strategy-lab', 'catalog'],
    queryFn: () => get<StrategyLabCatalog>('/strategy-lab/catalog'),
    staleTime: Infinity,
  })

/** A backtest is a pure function of its request: cached by it, never retried
 *  (a 422 is the core refusing the values, in words). */
export const useBacktest = (req: BacktestRequest | null) =>
  useQuery({
    queryKey: ['strategy-lab', 'backtest', req],
    queryFn: () => post<Backtest>('/strategy-lab/backtest', req),
    enabled: !!req,
    placeholderData: keepPreviousData,
    staleTime: 15 * 60_000,
    retry: 0,
  })

/** Why a strategy did (not) signal in a window of a backtest: its rules traced
 *  session by session. Pure like the backtest: cached by its request. */
export const useDiagnosis = (req: DiagnoseRequest | null) =>
  useQuery({
    queryKey: ['strategy-lab', 'diagnose', req],
    queryFn: () => post<Diagnosis>('/strategy-lab/diagnose', req),
    enabled: !!req,
    placeholderData: keepPreviousData,
    staleTime: 15 * 60_000,
    retry: 0,
  })

/** The rules as the editor edits them, with the core's sentences: a template
 *  opened for editing, or the editor's own rules checked as they are typed. */
export const useRulesPreview = (req: RulesRequest | null) =>
  useQuery({
    queryKey: ['strategy-lab', 'rules', req],
    queryFn: () => post<RulesPreview>('/strategy-lab/rules', req),
    enabled: !!req,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    retry: 0,
  })

export const fetchRules = (req: RulesRequest) => post<RulesPreview>('/strategy-lab/rules', req)

/** Saves (or overwrites) a user strategy; the catalog is reloaded. */
export function useSaveStrategy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (req: SaveStrategyRequest) => post<StrategyTemplate>('/strategy-lab/strategies', req),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategy-lab', 'catalog'] }),
  })
}

export function useDeleteStrategy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => del(`/strategy-lab/strategies/${enc(id)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategy-lab', 'catalog'] }),
  })
}

// ------------------------------------------------- strategy lab · universe

export const useLabUniverses = () =>
  useQuery({
    queryKey: ['strategy-lab', 'universes'],
    queryFn: () => get<LabUniverses>('/strategy-lab/universes'),
    staleTime: 10 * 60_000,
  })

/** Queues a backtest on a universe; a 422 is the core refusing the values before queuing. */
export function useStartUniverseBacktest() {
  return useMutation({
    mutationFn: (req: UniverseBacktestRequest) => post<UniverseBacktestJob>('/strategy-lab/universe-backtest', req),
  })
}

const RUNNING_STATES = new Set(['queued', 'running'])

/** A background job of the core, polled every second until it ends; a finished one is kept. */
const useJob = <T extends { state: string }>(kind: 'universe-backtest' | 'universe-screen', id: string | null) =>
  useQuery({
    queryKey: ['strategy-lab', kind, id],
    queryFn: () => get<T>(`/strategy-lab/${kind}/${enc(id!)}`),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data && !RUNNING_STATES.has(q.state.data.state) ? false : 1000),
    staleTime: Infinity,
    retry: 0,
  })

export const useUniverseJob = (id: string | null) => useJob<UniverseBacktestJob>('universe-backtest', id)

export const cancelUniverseJob = (id: string) =>
  request<UniverseBacktestJob>(`/strategy-lab/universe-backtest/${enc(id)}`, { method: 'DELETE' })

/** Queues a screen of a universe (which members signal now); a 422 is refused before queuing. */
export function useStartUniverseScreen() {
  return useMutation({
    mutationFn: (req: UniverseScreenRequest) => post<UniverseScreenJob>('/strategy-lab/universe-screen', req),
  })
}

export const useUniverseScreenJob = (id: string | null) => useJob<UniverseScreenJob>('universe-screen', id)

export const cancelUniverseScreen = (id: string) =>
  request<UniverseScreenJob>(`/strategy-lab/universe-screen/${enc(id)}`, { method: 'DELETE' })

// ---------------------------------------------------------------- symbols

export const useIndicatorCatalog = () =>
  useQuery({ queryKey: ['symbols', 'indicators'], queryFn: () => get<IndicatorCatalog>('/symbols/indicators'), staleTime: Infinity })

export const useSymbolSearch = (q: string) =>
  useQuery({
    queryKey: ['symbols', 'search', q],
    queryFn: ({ signal }) =>
      request<{ query: string; hits: SymbolHit[] }>(`/symbols/search?q=${enc(q)}&limit=12`, { signal }),
    enabled: q.trim().length > 0,
    placeholderData: keepPreviousData,
    staleTime: 10 * 60_000,
  })

export const useSymbolProfile = (key: string | null) =>
  useQuery({
    queryKey: ['symbols', 'profile', key],
    queryFn: () => get<SymbolProfile>(`/symbols/${enc(key!)}`),
    enabled: !!key,
    retry: 0,
    refetchInterval: LIVE,
  })

export const useSymbolChart = (key: string | null, timeframe: string, range: string) =>
  useQuery({
    queryKey: ['symbols', 'chart', key, timeframe, range],
    queryFn: () => get<SymbolChart>(`/symbols/${enc(key!)}/chart?timeframe=${timeframe}&range=${range}`),
    enabled: !!key,
    placeholderData: keepPreviousData,
    retry: 0,
    refetchInterval: LIVE,
  })

/** The asset's cycle studies (average year, presidential cycle, its own cycles). */
export const useSeasonality = (key: string | null, enabled = true) =>
  useQuery({
    queryKey: ['seasonality', key],
    queryFn: () => get<Seasonality>(`/seasonality/${enc(key!)}`),
    enabled: !!key && enabled,
    retry: 0,
    staleTime: 30 * 60_000,
  })

/** The analyst's option levels in force on a session (`asOf` null = the latest published). */
export const useSymbolOptionLevels = (key: string | null, asOf: string | null) =>
  useQuery({
    queryKey: ['symbols', 'option-levels', key, asOf],
    queryFn: () => get<SymbolOptionLevels>(`/symbols/${enc(key!)}/option-levels${asOf ? `?as_of=${asOf}` : ''}`),
    enabled: !!key,
    placeholderData: keepPreviousData,
    retry: 0,
    staleTime: 5 * 60_000,
  })

/** The analyst's levels on every session of the chart (posts arrive hourly in the morning). */
export const useSymbolOptionLevelsHistory = (key: string | null, timeframe: string, range: string, enabled: boolean) =>
  useQuery({
    queryKey: ['symbols', 'option-levels-history', key, timeframe, range],
    queryFn: () => get<SymbolOptionLevelsHistory>(`/symbols/${enc(key!)}/option-levels/history?timeframe=${timeframe}&range=${range}`),
    enabled: !!key && enabled,
    placeholderData: keepPreviousData,
    retry: 0,
    staleTime: 10 * 60_000,
  })

/** McClellan's Timing Models placed on the chart's calendar (forecasts change biweekly). */
export const useSymbolTiming = (key: string | null, timeframe: string, range: string, enabled: boolean) =>
  useQuery({
    queryKey: ['symbols', 'timing', key, timeframe, range],
    queryFn: () => get<SymbolTiming>(`/symbols/${enc(key!)}/timing?timeframe=${timeframe}&range=${range}`),
    enabled: !!key && enabled,
    placeholderData: keepPreviousData,
    retry: 0,
    staleTime: 10 * 60_000,
  })

export const useTimingBoard = () =>
  useQuery({ queryKey: ['timing', 'mcclellan'], queryFn: () => get<TimingBoard>('/timing/mcclellan'), staleTime: 10 * 60_000 })

/** One query per indicator: adding one fetches only that one. */
export const useIndicatorSeries = (key: string | null, timeframe: string, range: string, specs: string[]) =>
  useQueries({
    queries: specs.map((spec) => ({
      queryKey: ['symbols', 'indicator', key, timeframe, range, spec],
      queryFn: () =>
        get<IndicatorSeries>(`/symbols/${enc(key!)}/indicator?spec=${enc(spec)}&timeframe=${timeframe}&range=${range}`),
      enabled: !!key,
      retry: 0,
      staleTime: 5 * 60_000,
      // Follows the chart: the indicator reaches the same last bar.
      refetchInterval: LIVE,
    })),
  })

const WATCHLIST = ['symbols', 'watchlist'] as const

export const useWatchlist = () =>
  useQuery({ queryKey: WATCHLIST, queryFn: () => get<Watchlist>('/symbols/watchlist'), refetchInterval: LIVE })

/** Replaces the whole ordered list; the list is updated before the core answers
 *  (order and membership only: quotes come back with the answer). */
export function useSaveWatchlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (keys: string[]) => put<Watchlist>('/symbols/watchlist', { keys }),
    onMutate: async (keys) => {
      await qc.cancelQueries({ queryKey: WATCHLIST })
      const prev = qc.getQueryData<Watchlist>(WATCHLIST)
      if (prev) {
        const byKey = new Map(prev.items.map((i) => [i.key, i]))
        qc.setQueryData<Watchlist>(WATCHLIST, {
          ...prev,
          items: keys.map((k) => byKey.get(k)).filter((i): i is NonNullable<typeof i> => !!i),
        })
      }
      return { prev }
    },
    onError: (_e, _k, ctx) => ctx?.prev && qc.setQueryData(WATCHLIST, ctx.prev),
    onSuccess: (data) => qc.setQueryData(WATCHLIST, data),
  })
}

// ---------------------------------------------------------------- relative strength

export const useRsUniverses = () =>
  useQuery({ queryKey: ['rs', 'universes'], queryFn: () => get<RsUniverse[]>('/rs/universes') })

export const useRsBoard = (universe: string, asOf: string | null, delta: number) =>
  useQuery({
    queryKey: ['rs', 'board', universe, asOf, delta],
    queryFn: () => get<RsBoard>(`/rs/${universe}/board?delta=${delta}${asOf ? `&as_of=${asOf}` : ''}`),
    placeholderData: keepPreviousData,
    retry: 0,
  })

export const useRsHeatmap = (universe: string, scope: RsScope, sector: string | null, lens: string, weeks: number, asOf: string | null) =>
  useQuery({
    queryKey: ['rs', 'heatmap', universe, scope, sector, lens, weeks, asOf],
    queryFn: () =>
      get<RsHeatmap>(
        `/rs/${universe}/heatmap?scope=${scope}&lens=${lens}&weeks=${weeks}${sector ? `&sector=${enc(sector)}` : ''}${asOf ? `&as_of=${asOf}` : ''}`,
      ),
    placeholderData: keepPreviousData,
    retry: 0,
  })

export type RsGroupRef = { universe: string; scope: RsScope; code: string }

const asOfQ = (asOf: string | null) => (asOf ? `&as_of=${asOf}` : '')

const groupHistory = (g: RsGroupRef, range: string, asOf: string | null) => ({
  queryKey: ['rs', 'group', g.universe, g.scope, g.code, range, asOf],
  queryFn: () => get<RsGroupSeries>(`/rs/${g.universe}/groups/${g.scope}/${enc(g.code)}/history?range=${range}${asOfQ(asOf)}`),
  retry: 0,
})

export const useRsGroupHistory = (g: RsGroupRef | null, range: string, asOf: string | null) =>
  useQuery({ ...groupHistory(g ?? { universe: '', scope: 'sector', code: '' }, range, asOf), enabled: !!g, placeholderData: keepPreviousData })

export const useRsGroupHistories = (groups: RsGroupRef[], range: string, asOf: string | null) =>
  useQueries({ queries: groups.map((g) => groupHistory(g, range, asOf)) })

const memberHistory = (key: string, universe: string | null, range: string, asOf: string | null) => ({
  queryKey: ['rs', 'member', key, universe, range, asOf],
  queryFn: () =>
    get<RsMemberSeries>(`/rs/members/${enc(key)}/history?range=${range}${universe ? `&universe=${universe}` : ''}${asOfQ(asOf)}`),
  retry: 0,
})

export const useRsMemberHistory = (key: string | null, universe: string | null, range: string, asOf: string | null) =>
  useQuery({ ...memberHistory(key ?? '', universe, range, asOf), enabled: !!key, placeholderData: keepPreviousData })

export const useRsMemberHistories = (members: { key: string; universe: string }[], range: string, asOf: string | null) =>
  useQueries({ queries: members.map((m) => memberHistory(m.key, m.universe, range, asOf)) })

// ---------------------------------------------------------------- admin (panel del sistema)
/** Sin reintentos: un 404 aquí significa que el panel no está activado (SYNOPSIS_ADMIN=1). */
const ADMIN = { retry: 0, staleTime: 0 } as const

export const useAdminSystem = () =>
  useQuery({ queryKey: ['admin', 'system'], queryFn: () => get<AdminSystem>('/admin/system'), refetchInterval: 15_000, ...ADMIN })

export const useAdminDatabase = (enabled = true) =>
  useQuery({ queryKey: ['admin', 'database'], queryFn: () => get<AdminDatabase>('/admin/database'), refetchInterval: 60_000, enabled, ...ADMIN })

/** Cada 5 s mientras hay cargas en curso; cada 20 s si no. */
export const useAdminPipelines = (enabled = true) =>
  useQuery({
    queryKey: ['admin', 'pipelines'],
    queryFn: () => get<AdminPipelines>('/admin/pipelines'),
    refetchInterval: (q) => (q.state.data?.running ? 5_000 : 20_000),
    enabled,
    ...ADMIN,
  })

export const useAdminSources = (enabled = true) =>
  useQuery({ queryKey: ['admin', 'sources'], queryFn: () => get<AdminSources>('/admin/sources'), refetchInterval: 30_000, enabled, ...ADMIN })

export const useAdminRun = (dagId: string | null, runId: string | null) =>
  useQuery({
    queryKey: ['admin', 'run', dagId, runId],
    queryFn: () => get<AdminRunDetail>(`/admin/pipelines/${enc(dagId!)}/runs/${enc(runId!)}`),
    enabled: !!dagId && !!runId,
    refetchInterval: (q) => (['queued', 'running'].includes(q.state.data?.run.state ?? '') ? 3_000 : false),
    ...ADMIN,
  })

export const useAdminTaskLog = (dagId: string | null, runId: string | null, taskId: string | null, tryNumber: number, live: boolean) =>
  useQuery({
    queryKey: ['admin', 'log', dagId, runId, taskId, tryNumber],
    queryFn: () =>
      get<AdminTaskLog>(`/admin/pipelines/${enc(dagId!)}/runs/${enc(runId!)}/tasks/${enc(taskId!)}/log?try_number=${Math.max(tryNumber, 1)}`),
    enabled: !!dagId && !!runId && !!taskId,
    refetchInterval: live ? 3_000 : false,
    ...ADMIN,
  })

export const useServiceLogs = (name: string | null, tail = 300) =>
  useQuery({
    queryKey: ['admin', 'service-logs', name, tail],
    queryFn: () => get<AdminLog>(`/admin/services/${enc(name!)}/logs?tail=${tail}`),
    enabled: !!name,
    refetchInterval: 10_000,
    ...ADMIN,
  })

function useAdminMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSettled: () => qc.invalidateQueries({ queryKey: ['admin'] }) })
}

export const useServiceAction = () =>
  useAdminMutation(({ name, action }: { name: string; action: ServiceAction }) =>
    post<AdminService>(`/admin/services/${enc(name)}/${action}`, {}),
  )

export const useTriggerPipeline = () => useAdminMutation((dagId: string) => post<AdminRun>(`/admin/pipelines/${enc(dagId)}/trigger`, {}))

export const usePausePipeline = () =>
  useAdminMutation(({ dagId, paused }: { dagId: string; paused: boolean }) =>
    post<void>(`/admin/pipelines/${enc(dagId)}/pause`, { paused }),
  )

export const useMontoyaCredential = () =>
  useAdminMutation((value: string | null) =>
    value == null ? del('/admin/sources/montoya/credential') : put<void>('/admin/sources/montoya/credential', { value }),
  )
