import clsx from 'clsx'
import { ArrowDown, ArrowUp, ChevronRight, LoaderCircle, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DASH, fmtDate, fmtNum, fmtPct } from '../../lib/format'
import type { Band, UniverseBacktest, UniverseBacktestJob, UniverseGroup, UniversePortfolioSummary, UniverseSymbol } from '../../lib/types'
import { TimeChart, type PaneSpec, type Pt } from '../charts/TimeChart'
import { Card, InfoTip, Pill, Segmented, Warnings } from '../ui'
import { Row, Signed } from './BacktestResults'

/** The result of a strategy backtested on a universe: one portfolio of N slots
 *  over every member's trades. Every figure is the core's; the bands are the
 *  p10–p90 across the draws of the crowded days. */

const pct1 = (v: number | null | undefined) => fmtPct(v, 1)
const num2 = (v: number | null | undefined) => fmtNum(v, 2)
const int = (v: number | null | undefined) => fmtNum(v, 0)
const share = (v: number | null | undefined) => (v == null ? DASH : `${fmtNum(v, 0)}%`)

/** A band read at its median, with its p10–p90 when the draws disagreed. */
function BandText({ b, fmt, wide }: { b: Band; fmt: (v: number | null) => string; wide?: boolean }) {
  const spread = b.p10 != null && b.p90 != null && b.p10 !== b.p90
  return (
    <>
      {fmt(b.p50)}
      {spread && (
        <span className={clsx('ml-1.5 font-normal text-ink-3', wide ? 'text-xs' : 'text-[11px]')} title="Banda p10–p90 entre sorteos">
          {fmt(b.p10)} … {fmt(b.p90)}
        </span>
      )}
    </>
  )
}

const METRICS: { key: keyof UniversePortfolioSummary & ('cagr_pct' | 'total_return_pct' | 'max_drawdown_pct' | 'sharpe' | 'exposure_pct'); label: string; fmt: (v: number | null) => string; hint: string }[] = [
  { key: 'cagr_pct', label: 'Rentabilidad anual (CAGR)', fmt: pct1, hint: 'Tasa anual compuesta de la cartera entre el primer y el último día.' },
  { key: 'total_return_pct', label: 'Rentabilidad total', fmt: (v) => fmtPct(v, 0), hint: 'Del primer al último día, neta de costes.' },
  { key: 'max_drawdown_pct', label: 'Caída máxima', fmt: pct1, hint: 'La mayor caída del patrimonio desde un máximo previo.' },
  { key: 'sharpe', label: 'Sharpe', fmt: num2, hint: 'Media / desviación de la rentabilidad diaria, anualizada (√252), sin tipo libre de riesgo.' },
  { key: 'exposure_pct', label: 'Capital invertido', fmt: share, hint: 'Porcentaje medio del patrimonio en posiciones abiertas.' },
]

function Comparison({ r }: { r: UniverseBacktest }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {METRICS.map((m) => (
        <div key={m.key} className="card px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs text-ink-3">
            {m.label}
            <InfoTip text={m.hint} />
          </div>
          <div className="num mt-1 text-[22px] font-semibold tracking-tight">{m.fmt(r.strategy[m.key].p50)}</div>
          <div className="num text-[11px] text-ink-3" title="Banda p10–p90 entre sorteos">
            {r.draws_run > 1 ? `${m.fmt(r.strategy[m.key].p10)} … ${m.fmt(r.strategy[m.key].p90)}` : 'sin sorteo'}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
            <span className="h-[3px] w-3 rounded-full bg-ink-3" aria-hidden />
            <span className="num">{r.benchmark ? m.fmt(m.key === 'exposure_pct' ? 100 : r.benchmark[m.key]) : DASH}</span>
            <span title={r.benchmark_label ?? ''}>Ref.</span>
          </div>
        </div>
      ))}
    </div>
  )
}

const column = (dates: string[], values: (number | null)[]): Pt[] => dates.map((time, i) => ({ time, value: values[i] }))

type Scale = 'log' | 'linear'
const SCALES: { value: Scale; label: string }[] = [
  { value: 'log', label: 'Log' },
  { value: 'linear', label: 'Lineal' },
]

function EquityCard({ r }: { r: UniverseBacktest }) {
  const [scale, setScale] = useState<Scale>('log')
  const banded = r.draws_run > 1
  const panes = useMemo<PaneSpec[]>(() => {
    const s = r.series
    const f1 = (v: number) => fmtNum(v, 1)
    return [
      {
        logScale: scale === 'log',
        stretch: 2.2,
        series: [
          ...(banded
            ? [
                { type: 'line' as const, id: 'p90', label: 'p90', data: column(s.dates, s.equity_p90), color: 'var(--s1)', width: 1 as const, dashed: true, format: f1 },
                { type: 'line' as const, id: 'p10', label: 'p10', data: column(s.dates, s.equity_p10), color: 'var(--s1)', width: 1 as const, dashed: true, format: f1 },
              ]
            : []),
          { type: 'line', id: 'eq', label: banded ? 'Cartera (mediana)' : 'Cartera', data: column(s.dates, s.equity_p50), color: 'var(--s1)', format: f1 },
          { type: 'line', id: 'bh', label: r.benchmark_label ?? 'Referencia', data: column(s.dates, s.benchmark_equity), color: 'var(--ink-3)', width: 1, format: f1 },
        ],
      },
      {
        stretch: 1,
        levels: [{ value: 0 }],
        series: [
          { type: 'line', id: 'dd', label: 'Caída', data: column(s.dates, s.drawdown_p50), color: 'var(--s1)', width: 1, format: pct1 },
          { type: 'line', id: 'dd_bh', label: 'Caída ref.', data: column(s.dates, s.benchmark_drawdown), color: 'var(--ink-3)', width: 1, format: pct1 },
        ],
      },
      {
        stretch: 0.8,
        series: [
          { type: 'line', id: 'pos', label: 'Posiciones abiertas', data: column(s.dates, s.positions), color: 'var(--s2)', width: 1, step: true, format: (v) => fmtNum(v, 0) },
        ],
      },
    ]
  }, [r, scale, banded])
  return (
    <Card
      title="Curva de la cartera"
      subtitle={
        banded
          ? `Base 100 el primer día, neta de costes: mediana de ${r.draws_run} sorteos y, discontinuas, sus p10 y p90. Debajo, la caída y las posiciones abiertas (de ${r.slots}).`
          : `Base 100 el primer día, neta de costes. Debajo, la caída y las posiciones abiertas (de ${r.slots}).`
      }
      actions={<Segmented size="sm" label="Escala" value={scale} options={SCALES} onChange={setScale} />}
    >
      <TimeChart panes={panes} height={500} />
    </Card>
  )
}

function PortfolioCard({ r }: { r: UniverseBacktest }) {
  const s = r.strategy
  const c = r.coverage
  return (
    <Card title="Cartera y cobertura" subtitle={`${r.slots} huecos · ${r.contended ? `${r.draws_run} sorteos en los días con más señales que huecos` : 'ningún día con más señales que huecos: sin sorteo'}`}>
      <div className="text-[13px]">
        <Row label="Operaciones tomadas" value={<BandText b={s.trades_taken} fmt={int} />} hint="Las que encontraron hueco libre." />
        <Row label="Sin hueco" value={<BandText b={s.skipped_no_slot} fmt={int} />} hint="Señales de valores en liquidez cuando la cartera estaba llena: se pierden enteras." />
        <Row label="Valor ya en cartera" value={<BandText b={s.skipped_held} fmt={int} />} hint="Señales de un valor que la cartera ya tenía (una posición por valor)." />
        <Row label="Abiertas al final" value={<BandText b={s.open_at_end} fmt={int} />} />
        <Row
          label="Valores"
          value={`${int(c.traded)} con operaciones de ${int(c.listed)}`}
          hint={`Miembros en algún momento del periodo: ${c.listed}. Evaluados: ${c.evaluated}. Sin sesiones en el periodo: ${c.no_bars}. Sin histórico para el calentamiento: ${c.not_warm}.`}
        />
        <Row
          label="Señales de entrada"
          value={int(c.entry_signals)}
          hint={`Sesiones en que se cumplió la regla de entrada siendo miembro. ${c.not_member_signals} más fuera de la membresía (ignoradas).`}
        />
      </div>
    </Card>
  )
}

function TradeStatsCard({ r }: { r: UniverseBacktest }) {
  const s = r.trade_stats
  return (
    <Card title="Operaciones de todos los valores" subtitle={`${int(s.n_trades)} operaciones, cada valor de una en una; no solo las que tomó la cartera. Netas.`}>
      <div className="text-[13px]">
        <Row label="Ganadoras" value={s.win_rate_pct == null ? DASH : `${fmtNum(s.win_rate_pct, 0)}% (${int(s.n_wins)})`} />
        <Row label="Factor de beneficio" value={num2(s.profit_factor)} hint="Suma de ganancias / suma de pérdidas, en % por operación." />
        <Row label="Media por operación" value={pct1(s.mean_return_pct)} />
        <Row label="Mediana por operación" value={pct1(s.median_return_pct)} />
        <Row label="Ganancia / pérdida media" value={`${pct1(s.avg_win_pct)} / ${pct1(s.avg_loss_pct)}`} />
        <Row label="Duración mediana" value={s.bars_held_median == null ? DASH : `${fmtNum(s.bars_held_median, 0)} sesiones`} hint="De la señal a la salida." />
        <Row label="MFE / MAE medianos" value={`${pct1(s.mfe_median_pct)} / ${pct1(s.mae_median_pct)}`} hint="Lo mejor y lo peor que llegó a ir cada operación, en precio." />
      </div>
    </Card>
  )
}

function YearsCard({ r }: { r: UniverseBacktest }) {
  const rows = [...r.years].reverse()
  return (
    <Card title="Año a año" subtitle="Mediana entre sorteos. El primer y el último año pueden ser parciales." bodyClassName="p-0">
      <div className="scroll-thin max-h-[372px] overflow-auto">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 bg-surface">
            <tr className="text-[11px] text-ink-3">
              <th className="px-4 py-2 text-left font-medium">Año</th>
              <th className="px-2 py-2 text-right font-medium">Cartera</th>
              <th className="px-2 py-2 text-right font-medium">Ref.</th>
              <th className="px-2 py-2 text-right font-medium" title="Cartera menos referencia">Exceso</th>
              <th className="px-4 py-2 text-right font-medium" title="Caída máxima de la cartera dentro del año">Caída máx.</th>
            </tr>
          </thead>
          <tbody className="num">
            {rows.map((y) => (
              <tr key={y.year} className="border-t border-line">
                <td className="px-4 py-1.5 text-ink-2">{y.year}</td>
                <td className="px-2 py-1.5 text-right" title={`p10 ${pct1(y.return_pct.p10)} · p90 ${pct1(y.return_pct.p90)}`}>
                  <Signed v={y.return_pct.p50} />
                </td>
                <td className="px-2 py-1.5 text-right text-ink-2">{pct1(y.benchmark_pct)}</td>
                <td className="px-2 py-1.5 text-right"><Signed v={y.excess_pct.p50} /></td>
                <td className="px-4 py-1.5 text-right text-ink-2">{pct1(y.max_drawdown_pct.p50)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

type GroupScope = 'sectors' | 'industries'
const GROUP_SCOPES: { value: GroupScope; label: string }[] = [
  { value: 'sectors', label: 'Sectores' },
  { value: 'industries', label: 'Industrias' },
]

function GroupsCard({ r }: { r: UniverseBacktest }) {
  const [scope, setScope] = useState<GroupScope>('sectors')
  const rows: UniverseGroup[] = r[scope]
  return (
    <Card
      title="Por grupo"
      subtitle="Todas las operaciones de sus valores, de una en una por valor (no solo las de la cartera). Clasificación actual de cada valor."
      actions={<Segmented size="sm" label="Grupo" value={scope} options={GROUP_SCOPES} onChange={setScope} />}
      bodyClassName="p-0"
    >
      <div className="scroll-thin max-h-[420px] overflow-auto">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead className="sticky top-0 bg-surface">
            <tr className="text-[11px] text-ink-3">
              <th className="px-4 py-2 text-left font-medium">{scope === 'sectors' ? 'Sector' : 'Industria'}</th>
              <th className="px-2 py-2 text-right font-medium" title="Con operaciones / miembros en el periodo">Valores</th>
              <th className="px-2 py-2 text-right font-medium">Operaciones</th>
              <th className="px-2 py-2 text-right font-medium">Ganadoras</th>
              <th className="px-2 py-2 text-right font-medium">Media</th>
              <th className="px-2 py-2 text-right font-medium">Mediana</th>
              <th className="px-4 py-2 text-right font-medium" title="Suma de ganancias / suma de pérdidas">F. beneficio</th>
            </tr>
          </thead>
          <tbody className="num">
            {rows.map((g) => (
              <tr key={g.code} className="border-t border-line">
                <td className="px-4 py-1.5 text-ink">{g.name}</td>
                <td className="px-2 py-1.5 text-right text-ink-2">{g.n_traded} / {g.n_members}</td>
                <td className="px-2 py-1.5 text-right text-ink-2">{int(g.stats.n_trades)}</td>
                <td className="px-2 py-1.5 text-right text-ink-2">{share(g.stats.win_rate_pct)}</td>
                <td className="px-2 py-1.5 text-right"><Signed v={g.stats.mean_return_pct} /></td>
                <td className="px-2 py-1.5 text-right"><Signed v={g.stats.median_return_pct} /></td>
                <td className="px-4 py-1.5 text-right text-ink-2">{num2(g.stats.profit_factor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

type SortKey = 'ticker' | 'trades' | 'win' | 'mean' | 'compounded' | 'pf'
const SORTS: Record<SortKey, (s: UniverseSymbol) => number | string | null> = {
  ticker: (s) => s.ticker,
  trades: (s) => s.stats.n_trades,
  win: (s) => s.stats.win_rate_pct,
  mean: (s) => s.stats.mean_return_pct,
  compounded: (s) => s.compounded_return_pct,
  pf: (s) => s.stats.profit_factor,
}
const PAGE = 200
const STATUS: Record<UniverseSymbol['status'], string> = { ok: '', no_bars: 'sin sesiones', not_warm: 'sin calentamiento' }

function SymbolsCard({ r, onOpen }: { r: UniverseBacktest; onOpen: (s: UniverseSymbol) => void }) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'compounded', desc: true })
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pick = SORTS[sort.key]
    const filtered = q
      ? r.symbols.filter((s) => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.sector.toLowerCase().includes(q) || s.industry.toLowerCase().includes(q))
      : r.symbols
    return [...filtered].sort((a, b) => {
      const x = pick(a)
      const y = pick(b)
      if (x == null && y == null) return 0
      if (x == null) return 1 // the empty ones last, whatever the order
      if (y == null) return -1
      const c = x < y ? -1 : x > y ? 1 : 0
      return sort.desc ? -c : c
    })
  }, [r.symbols, sort, query])
  const head = (key: SortKey, label: string, title?: string, align: 'left' | 'right' = 'right') => (
    <th className={clsx('px-2 py-2 font-medium', align === 'left' ? 'text-left' : 'text-right')} title={title}>
      <button
        type="button"
        onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== 'ticker' }))}
        className={clsx('inline-flex items-center gap-0.5 hover:text-ink', sort.key === key && 'text-ink')}
      >
        {label}
        {sort.key === key && (sort.desc ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
      </button>
    </th>
  )
  return (
    <Card
      title="Por valor"
      subtitle="Cada valor operado solo, con todo el capital y de una en una: su propio backtest. Pulsa una fila para abrirlo con su gráfico."
      actions={
        <label className="relative">
          <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            className="h-7 w-48 rounded-lg border border-line bg-surface-2 pl-7 pr-2 text-xs text-ink outline-none focus:border-accent"
            placeholder="Buscar valor, sector…"
            aria-label="Buscar valor"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setLimit(PAGE)
            }}
          />
        </label>
      }
      bodyClassName="p-0"
    >
      <div className="scroll-thin max-h-[560px] overflow-auto">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead className="sticky top-0 bg-surface">
            <tr className="text-[11px] text-ink-3">
              <th className="w-0 py-2 pl-4" aria-hidden />
              {head('ticker', 'Valor', undefined, 'left')}
              <th className="px-2 py-2 text-left font-medium">Sector · industria</th>
              {head('trades', 'Oper.', 'Operaciones del valor, de una en una')}
              {head('win', 'Ganadoras')}
              {head('mean', 'Media')}
              {head('pf', 'F. benef.', 'Factor de beneficio: suma de ganancias / suma de pérdidas')}
              {head('compounded', 'Acumulada', 'Las operaciones del valor encadenadas: su backtest de un activo, neto')}
              <th className="w-0 py-2 pr-3" aria-hidden />
            </tr>
          </thead>
          <tbody className="num">
            {rows.slice(0, limit).map((s) => (
              <tr key={s.key} onClick={() => onOpen(s)} className="group cursor-pointer border-t border-line hover:bg-surface-2">
                <td className="py-1.5 pl-4" />
                <td className="max-w-[200px] px-2 py-1.5">
                  <div className="flex items-baseline gap-1.5 whitespace-nowrap" title={s.name}>
                    <span className="font-medium text-ink">{s.ticker}</span>
                    <span className="truncate text-xs text-ink-3">{s.name}</span>
                    {STATUS[s.status] && <Pill tone="neutral">{STATUS[s.status]}</Pill>}
                  </div>
                </td>
                <td className="max-w-[170px] truncate px-2 py-1.5 text-xs text-ink-3" title={`${s.sector} · ${s.industry}`}>
                  {s.sector} · {s.industry}
                </td>
                <td className="px-2 py-1.5 text-right text-ink-2" title={s.not_member_signals ? `${s.not_member_signals} señales fuera de la membresía (ignoradas)` : undefined}>
                  {int(s.stats.n_trades)}
                </td>
                <td className="px-2 py-1.5 text-right text-ink-2">{share(s.stats.win_rate_pct)}</td>
                <td className="px-2 py-1.5 text-right"><Signed v={s.stats.mean_return_pct} /></td>
                <td className="px-2 py-1.5 text-right text-ink-2">{num2(s.stats.profit_factor)}</td>
                <td className="px-2 py-1.5 text-right font-medium"><Signed v={s.compounded_return_pct} /></td>
                <td className="py-1.5 pr-3 text-right text-ink-3 opacity-0 group-hover:opacity-100">
                  <ChevronRight size={14} aria-hidden />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > limit && (
          <div className="border-t border-line px-4 py-2.5 text-center">
            <button type="button" onClick={() => setLimit((l) => l + PAGE * 5)} className="text-xs font-medium text-ink-2 hover:text-ink">
              Mostrar más ({fmtNum(rows.length - limit, 0)} restantes)
            </button>
          </div>
        )}
        {rows.length === 0 && <p className="px-4 py-3 text-sm text-ink-3">Ningún valor coincide.</p>}
      </div>
    </Card>
  )
}

export function UniverseBacktestResults({ r, stale, onOpenSymbol }: { r: UniverseBacktest; stale: boolean; onOpenSymbol: (s: UniverseSymbol) => void }) {
  return (
    <div className={clsx('min-w-0 space-y-4', stale && 'is-stale')}>
      <div className="card px-4 py-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-[15px] font-semibold text-ink">
            {r.strategy_label} <span className="text-ink-3">·</span> {r.universe_label}
            {r.selection_label && <span className="text-ink-2"> · {r.selection_label}</span>}
          </h2>
          <span className="num text-xs text-ink-3">
            {fmtDate(r.start)} – {fmtDate(r.end)} · {fmtNum(r.coverage.listed, 0)} valores · {fmtNum(r.elapsed_s, 0)} s
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-2">
          <span><span className="text-ink-3">Entrada:</span> {r.entry_text}</span>
          <span><span className="text-ink-3">Salida:</span> {r.exit_text}</span>
          <span><span className="text-ink-3">Cartera:</span> <span className="num">{r.slots}</span> huecos, 1/{r.slots} cada uno</span>
          <span><span className="text-ink-3">Costes:</span> <span className="num">{fmtNum(r.cost_bps, 1)}</span> pb por lado</span>
          <span><span className="text-ink-3">Ref.:</span> {r.benchmark_label ?? DASH}</span>
        </div>
      </div>
      <Warnings items={r.warnings} />
      <Comparison r={r} />
      <EquityCard r={r} />
      <div className="grid gap-4 lg:grid-cols-2">
        <PortfolioCard r={r} />
        <TradeStatsCard r={r} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <YearsCard r={r} />
        <GroupsCard r={r} />
      </div>
      <SymbolsCard r={r} onOpen={onOpenSymbol} />
      <Card title="Cómo se mide">
        <ul className="space-y-1.5 text-xs leading-relaxed text-ink-2">
          {r.conventions.map((c) => (
            <li key={c}>· {c}</li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

/** A queued or running job: where it is, how far, and a way to stop it. */
export function UniverseJobProgress({
  job,
  onCancel,
  cancelling,
}: {
  job: Pick<UniverseBacktestJob, 'state' | 'stage' | 'done' | 'total' | 'queue_position' | 'elapsed_s'>
  onCancel: () => void
  cancelling: boolean
}) {
  const pct = job.total ? Math.round((100 * job.done) / job.total) : null
  return (
    <div className="card px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] text-ink">
          <LoaderCircle size={15} className="animate-spin text-accent" aria-hidden />
          {job.state === 'queued' ? `En cola${job.queue_position ? ` (${job.queue_position} por delante)` : ''}` : job.stage}
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={cancelling}
          className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium text-ink-3 transition-colors hover:text-down disabled:opacity-60"
        >
          <X size={13} /> Cancelar
        </button>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={pct ?? undefined} aria-valuemin={0} aria-valuemax={100}>
        <div className={clsx('h-full rounded-full bg-accent transition-[width]', pct == null && 'w-1/4 animate-pulse')} style={pct == null ? undefined : { width: `${pct}%` }} />
      </div>
      <div className="num mt-2 flex justify-between text-[11px] text-ink-3">
        <span>{job.total ? `${fmtNum(job.done, 0)} de ${fmtNum(job.total, 0)} valores` : ' '}</span>
        <span>{fmtNum(job.elapsed_s, 0)} s</span>
      </div>
    </div>
  )
}
