import clsx from 'clsx'
import { Microscope } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { DASH, fmtDate, fmtLevel, fmtNum, fmtPct } from '../../lib/format'
import { seriesColor } from '../../lib/theme'
import type { Backtest, Overlay, PerformanceSummary, Scale as SeriesScale } from '../../lib/types'
import { TimeChart, type Marker, type PaneSpec, type Pt, type SeriesSpec, type ZoneLayer } from '../charts/TimeChart'
import { Card, InfoTip, Pill, Segmented, Warnings } from '../ui'

/** The result of a backtest, as the Strategy Lab and the Symbols page show it. */

const pct1 = (v: number | null | undefined) => fmtPct(v, 1)
const num2 = (v: number | null | undefined) => fmtNum(v, 2)

const METRICS: { key: keyof PerformanceSummary; label: string; fmt: (v: number | null) => string; hint: string }[] = [
  { key: 'cagr_pct', label: 'Rentabilidad anual (CAGR)', fmt: pct1, hint: 'Tasa anual compuesta entre el primer y el último día del periodo.' },
  { key: 'total_return_pct', label: 'Rentabilidad total', fmt: (v) => fmtPct(v, 0), hint: 'Del primer al último día, neta de costes.' },
  { key: 'max_drawdown_pct', label: 'Caída máxima', fmt: pct1, hint: 'La mayor caída del capital desde un máximo previo.' },
  { key: 'sharpe', label: 'Sharpe', fmt: num2, hint: 'Media / desviación de la rentabilidad diaria, anualizada (√252), sin tipo libre de riesgo. Cuenta los días en liquidez.' },
  { key: 'exposure_pct', label: 'Tiempo invertido', fmt: (v) => (v == null ? DASH : `${fmtNum(v, 0)}%`), hint: 'Porcentaje medio del capital en el mercado.' },
]

function Comparison({ r }: { r: Backtest }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {METRICS.map((m) => (
        <div key={m.key} className="card px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs text-ink-3">
            {m.label}
            <InfoTip text={m.hint} />
          </div>
          <div className="num mt-1 text-[22px] font-semibold tracking-tight">{m.fmt(r.strategy[m.key])}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
            <span className="h-[3px] w-3 rounded-full bg-ink-3" aria-hidden />
            <span className="num">{r.benchmark ? m.fmt(r.benchmark[m.key]) : DASH}</span>
            <span title={r.benchmark_label}>C&amp;M</span>
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

function EquityCard({ r }: { r: Backtest }) {
  const [scale, setScale] = useState<Scale>('log')
  const panes = useMemo<PaneSpec[]>(() => {
    const s = r.series
    return [
      {
        logScale: scale === 'log',
        stretch: 2.2,
        series: [
          { type: 'line', id: 'eq', label: r.strategy_label, data: column(s.dates, s.equity), color: 'var(--s1)', format: (v) => fmtNum(v, 1) },
          { type: 'line', id: 'bh', label: 'Comprar y mantener', data: column(s.dates, s.benchmark_equity), color: 'var(--ink-3)', width: 1, format: (v) => fmtNum(v, 1) },
        ],
      },
      {
        stretch: 1,
        levels: [{ value: 0 }],
        series: [
          { type: 'line', id: 'dd', label: 'Caída', data: column(s.dates, s.drawdown), color: 'var(--s1)', width: 1, format: pct1 },
          { type: 'line', id: 'dd_bh', label: 'Caída C&M', data: column(s.dates, s.benchmark_drawdown), color: 'var(--ink-3)', width: 1, format: pct1 },
        ],
      },
    ]
  }, [r, scale])
  return (
    <Card
      title="Curva de capital"
      subtitle="Base 100 el primer día, neta de costes. Abajo, la caída desde el máximo previo."
      actions={<Segmented size="sm" label="Escala" value={scale} options={SCALES} onChange={setScale} />}
    >
      <TimeChart panes={panes} height={420} />
    </Card>
  )
}

/** Series off the price scale go to a pane of their own, one per scale. */
const SCALE_PANES: { scale: SeriesScale; title: string; fmt: (v: number) => string }[] = [
  { scale: 'points', title: 'Oscilador (0–100)', fmt: (v) => fmtNum(v, 1) },
  { scale: 'percent', title: 'Porcentaje', fmt: (v) => fmtPct(v, 1) },
]

function PriceCard({ r }: { r: Backtest }) {
  const [scale, setScale] = useState<Scale>('log')
  const panes = useMemo<PaneSpec[]>(() => {
    const s = r.series
    const long = r.side === 'long'
    const markers: Marker[] = r.trades
      .flatMap((t): Marker[] => [
        { time: t.entry_date, position: long ? 'belowBar' : 'aboveBar', shape: long ? 'arrowUp' : 'arrowDown', color: 'var(--up)' },
        ...(t.outcome === 'open'
          ? []
          : [{ time: t.exit_date, position: long ? 'aboveBar' : 'belowBar', shape: long ? 'arrowDown' : 'arrowUp', color: 'var(--down)' } as Marker]),
      ])
      .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0))
    // The colour follows the series: its place in the rules, as in the editor.
    const order = new Map(r.rules.series.map((x, i) => [x.id, i]))
    const color = (o: Overlay) => seriesColor(order.get(o.id) ?? 0)
    // A ceiling/floor is drawn as its zones: its line only gives the legend its value.
    const line = (o: Overlay, fmt: (v: number) => string): SeriesSpec => ({
      type: 'line',
      id: o.id,
      label: o.label,
      data: column(s.dates, o.values),
      color: color(o),
      width: 1,
      hidden: o.shape === 'zones',
      format: fmt,
    })
    const candles = s.dates.flatMap((time, i) => {
      const [open, high, low, close] = [s.open[i], s.high[i], s.low[i], s.price[i]]
      return open == null || high == null || low == null || close == null ? [] : [{ time, open, high, low, close }]
    })
    const onPrice = s.overlays.filter((o) => o.scale === 'price')
    const zones: ZoneLayer[] = onPrice
      .filter((o) => o.shape === 'zones')
      .map((o) => ({
        id: o.id,
        label: o.label,
        color: color(o),
        boxes: o.zones.map((z) => ({
          from: z.first_point, start: z.start, to: z.end,
          lower: z.lower, upper: z.upper,
          points: z.points.map((t) => ({ time: t.date, value: t.price })),
          text: z.text,
        })),
      }))
    return [
      {
        logScale: scale === 'log',
        stretch: 2.4,
        zones,
        series: [
          { type: 'candles', id: 'px', label: r.instrument_label, data: candles, markers, format: (v) => fmtLevel(v) },
          ...onPrice.map((o) => line(o, (v) => fmtLevel(v))),
        ],
      },
      ...SCALE_PANES.flatMap((p) => {
        const own = s.overlays.filter((o) => o.scale === p.scale)
        return own.length ? [{ title: p.title, stretch: 1, levels: p.scale === 'percent' ? [{ value: 0 }] : [], series: own.map((o) => line(o, p.fmt)) }] : []
      }),
    ]
  }, [r, scale])
  return (
    <Card
      title="Precio y operaciones"
      subtitle={
        <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1"><span className="text-up">▲</span> entrada</span>
          <span className="inline-flex items-center gap-1"><span className="text-down">▼</span> salida</span>
          {r.series.overlays.some((o) => o.shape === 'zones') && (
            <span>Techo/suelo: centroide ± tolerancia; discontinuo desde su primer punto, sólido desde que es el nivel (marca vertical); los puntos son los máximos (mínimos) que lo forman.</span>
          )}
          <span>Ejecuciones en la sesión en que se llenan, no en la de la señal.</span>
        </span>
      }
      actions={<Segmented size="sm" label="Escala" value={scale} options={SCALES} onChange={setScale} />}
    >
      <TimeChart panes={panes} height={380 + (panes.length - 1) * 130} />
    </Card>
  )
}

export function Row({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-line py-1.5 first:border-t-0">
      <span className="flex items-center gap-1.5 text-ink-2">
        {label}
        {hint && <InfoTip text={hint} />}
      </span>
      <span className="num font-medium text-ink">{value}</span>
    </div>
  )
}

function TradeStatsCard({ r }: { r: Backtest }) {
  const s = r.trade_stats
  return (
    <Card title="Operaciones" subtitle={`${s.n_trades} operaciones${s.n_open ? `, ${s.n_open} abierta al final` : ''}. Rentabilidades netas.`}>
      <div className="text-[13px]">
        <Row label="Ganadoras" value={s.win_rate_pct == null ? DASH : `${fmtNum(s.win_rate_pct, 0)}% (${s.n_wins})`} hint="Operaciones con rentabilidad neta positiva; la abierta cuenta a su marca." />
        <Row label="Factor de beneficio" value={num2(s.profit_factor)} hint="Suma de ganancias / suma de pérdidas, en % por operación." />
        <Row label="Media por operación" value={pct1(s.mean_return_pct)} />
        <Row label="Mediana por operación" value={pct1(s.median_return_pct)} />
        <Row label="Ganancia media" value={pct1(s.avg_win_pct)} />
        <Row label="Pérdida media" value={pct1(s.avg_loss_pct)} />
        <Row label="Duración mediana" value={s.bars_held_median == null ? DASH : `${fmtNum(s.bars_held_median, 0)} sesiones`} hint="De la señal a la salida." />
        <Row label="MFE / MAE medianos" value={`${pct1(s.mfe_median_pct)} / ${pct1(s.mae_median_pct)}`} hint="Lo mejor y lo peor que llegó a ir cada operación, en precio." />
        <Row
          label="Señales de entrada"
          value={`${r.entry_signals}`}
          hint={`Sesiones en que se cumplió la regla de entrada. ${r.skipped_in_position} con la posición ya abierta (ignoradas)${r.unfilled_signals ? `, ${r.unfilled_signals} pendiente` : ''}.`}
        />
      </div>
    </Card>
  )
}

export function Signed({ v }: { v: number | null }) {
  return <span className={clsx(v != null && v > 0 && 'text-up', v != null && v < 0 && 'text-down')}>{pct1(v)}</span>
}

function YearsCard({ r }: { r: Backtest }) {
  const rows = [...r.years].reverse()
  return (
    <Card title="Año a año" subtitle="El primer y el último año pueden ser parciales." bodyClassName="p-0">
      <div className="scroll-thin max-h-[372px] overflow-auto">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 bg-surface">
            <tr className="text-[11px] text-ink-3">
              <th className="px-4 py-2 text-left font-medium">Año</th>
              <th className="px-2 py-2 text-right font-medium">Estrategia</th>
              <th className="px-2 py-2 text-right font-medium">C&amp;M</th>
              <th className="px-2 py-2 text-right font-medium" title="Estrategia menos comprar y mantener">Exceso</th>
              <th className="px-4 py-2 text-right font-medium" title="Caída máxima de la estrategia dentro del año">Caída máx.</th>
            </tr>
          </thead>
          <tbody className="num">
            {rows.map((y) => (
              <tr key={y.year} className="border-t border-line">
                <td className="px-4 py-1.5 text-ink-2">{y.year}</td>
                <td className="px-2 py-1.5 text-right"><Signed v={y.return_pct} /></td>
                <td className="px-2 py-1.5 text-right text-ink-2">{pct1(y.benchmark_pct)}</td>
                <td className="px-2 py-1.5 text-right"><Signed v={y.excess_pct} /></td>
                <td className="px-4 py-1.5 text-right text-ink-2">{pct1(y.max_drawdown_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/** Asks why the strategy stayed out between two dates (ISO). */
export type AnalyzeWindow = (start: string, end: string) => void

function TradesTable({ r, onAnalyze }: { r: Backtest; onAnalyze?: AnalyzeWindow }) {
  // Flat before each trade: from the previous exit (or the period's start) to its signal.
  const rows = r.trades.map((t, i) => ({ ...t, n: i + 1, flatFrom: i === 0 ? r.start : r.trades[i - 1].exit_date })).reverse()
  return (
    <Card title="Detalle de operaciones" subtitle="La más reciente primero. Precios de ejecución; rentabilidad neta de costes." bodyClassName="p-0">
      {rows.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-ink-3">Sin operaciones en el periodo.</p>
      ) : (
        <div className="scroll-thin max-h-[480px] overflow-auto">
          <table className="w-full min-w-[880px] text-[13px]">
            <thead className="sticky top-0 bg-surface">
              <tr className="text-[11px] text-ink-3">
                <th className="px-4 py-2 text-left font-medium">#</th>
                <th className="px-2 py-2 text-left font-medium">Entrada</th>
                <th className="px-2 py-2 text-right font-medium">Precio</th>
                <th className="px-2 py-2 text-left font-medium">Salida</th>
                <th className="px-2 py-2 text-right font-medium">Precio</th>
                <th className="px-2 py-2 text-right font-medium" title="Sesiones de la señal a la salida">Sesiones</th>
                <th className="px-2 py-2 text-right font-medium">Rentabilidad</th>
                <th className="px-2 py-2 text-right font-medium" title="Lo mejor que llegó a ir (precio)">MFE</th>
                <th className="px-4 py-2 text-right font-medium" title="Lo peor que llegó a ir (precio)">MAE</th>
                {onAnalyze && <th className="py-2 pr-3" aria-label="Analizar" />}
              </tr>
            </thead>
            <tbody className="num">
              {rows.map((t) => (
                <tr key={t.signal_date} className="border-t border-line">
                  <td className="px-4 py-1.5 text-ink-3">{t.n}</td>
                  <td className="px-2 py-1.5 text-ink-2" title={`Señal: ${fmtDate(t.signal_date)}`}>{fmtDate(t.entry_date)}</td>
                  <td className="px-2 py-1.5 text-right text-ink-2">{fmtLevel(t.entry_price)}</td>
                  <td className="px-2 py-1.5 text-ink-2">
                    {t.outcome === 'open' ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Pill tone="accent" title={`Sigue abierta: marcada al cierre del ${fmtDate(t.exit_date)}`}>Abierta</Pill>
                      </span>
                    ) : (
                      fmtDate(t.exit_date)
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right text-ink-2">{fmtLevel(t.exit_price)}</td>
                  <td className="px-2 py-1.5 text-right text-ink-2">{t.bars_held}</td>
                  <td className="px-2 py-1.5 text-right font-medium" title={`Bruta ${pct1(t.gross_return_pct)}`}>
                    <Signed v={t.return_pct} />
                  </td>
                  <td className="px-2 py-1.5 text-right text-ink-2">{pct1(t.mfe_pct)}</td>
                  <td className="px-4 py-1.5 text-right text-ink-2">{pct1(t.mae_pct)}</td>
                  {onAnalyze && (
                    <td className="py-1 pr-3 text-right">
                      <button
                        type="button"
                        onClick={() => onAnalyze(t.flatFrom, t.signal_date)}
                        title={`¿Por qué no entró antes? Analiza las reglas del ${fmtDate(t.flatFrom)} al ${fmtDate(t.signal_date)} (fuera de mercado hasta esta señal)`}
                        className="inline-flex items-center rounded-md p-1 text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
                      >
                        <Microscope size={14} />
                        <span className="sr-only">Analizar el tramo anterior</span>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

export function BacktestResults({
  r,
  stale,
  afterPrice,
  onAnalyze,
}: {
  r: Backtest
  stale: boolean
  /** Shown under the price chart (the analysis of a window). */
  afterPrice?: ReactNode
  onAnalyze?: AnalyzeWindow
}) {
  return (
    <div className={clsx('min-w-0 space-y-4', stale && 'is-stale')}>
      <div className="card px-4 py-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-[15px] font-semibold text-ink">
            {r.strategy_label} <span className="text-ink-3">·</span> {r.instrument_label}
          </h2>
          <span className="num text-xs text-ink-3">
            {fmtDate(r.start)} – {fmtDate(r.end)} · {fmtNum(r.sessions, 0)} sesiones
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-2">
          <span><span className="text-ink-3">Entrada:</span> {r.entry_text}</span>
          <span><span className="text-ink-3">Salida:</span> {r.exit_text}</span>
          <span><span className="text-ink-3">Costes:</span> <span className="num">{fmtNum(r.cost_bps, 1)}</span> pb por lado</span>
          <span><span className="text-ink-3">C&amp;M:</span> comprar y mantener {r.instrument_label}</span>
        </div>
      </div>
      <Warnings items={r.warnings} />
      <Comparison r={r} />
      <EquityCard r={r} />
      <PriceCard r={r} />
      {afterPrice}
      <div className="grid gap-4 lg:grid-cols-2">
        <TradeStatsCard r={r} />
        <YearsCard r={r} />
      </div>
      <TradesTable r={r} onAnalyze={onAnalyze} />
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
