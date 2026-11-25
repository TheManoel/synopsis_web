import clsx from 'clsx'
import { AlertTriangle, Star } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { SymbolChart } from '../components/symbols/SymbolChart'
import { SymbolSearch } from '../components/symbols/SymbolSearch'
import { WatchlistPanel } from '../components/symbols/Watchlist'
import { Card, Delta, ErrorState, InfoTip, Pill, Skeleton, Warnings } from '../components/ui'
import { useIndicatorCatalog, useSaveWatchlist, useSymbolProfile, useWatchlist } from '../lib/api'
import {
  assetTypeLabel,
  DASH,
  fmtChange,
  fmtDate,
  fmtInUnit,
  fmtLevel,
  fmtNum,
  fmtPct,
  fmtShortDate,
} from '../lib/format'
import { symbolPath } from '../lib/symbolNav'
import type { EarningsRow, RelativeTable, RsRank, StageInfo, SymbolProfile, TechnicalReading } from '../lib/types'

const LAST_KEY = 'synopsis.symbols.last'
const FALLBACK = '^SPX@CBOE'
const HORIZON_LABEL: Record<string, string> = { '1D': '1D', '1W': '1S', '1M': '1M', '3M': '3M', '6M': '6M', '1Y': '1A', YTD: 'En el año' }

/** `/simbolos` without a symbol: the last one seen, else the watchlist's first. */
export function SymbolsIndex() {
  const watch = useWatchlist()
  let last: string | null = null
  try {
    last = localStorage.getItem(LAST_KEY)
  } catch {
    /* no storage */
  }
  if (last) return <Navigate to={symbolPath(last)} replace />
  if (watch.isLoading) return <Skeleton className="h-[480px]" />
  return <Navigate to={symbolPath(watch.data?.items[0]?.key ?? FALLBACK)} replace />
}

export function SymbolsPage() {
  const { key = FALLBACK } = useParams()
  const navigate = useNavigate()
  const watch = useWatchlist()
  const save = useSaveWatchlist()
  const catalog = useIndicatorCatalog()
  const profile = useSymbolProfile(key)
  const watchedKeys = useMemo(() => watch.data?.items.map((i) => i.key) ?? [], [watch.data])
  const watched = useMemo(() => new Set(watchedKeys), [watchedKeys])

  useEffect(() => {
    if (profile.data)
      try {
        localStorage.setItem(LAST_KEY, key)
      } catch {
        /* no storage */
      }
  }, [profile.data, key])

  const toggleWatch = () =>
    save.mutate(watched.has(key) ? watchedKeys.filter((k) => k !== key) : [...watchedKeys, key])

  return (
    <div className="grid gap-6 lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto scroll-thin">
        <div className="mb-4">
          <SymbolSearch watched={watched} onPick={(h) => navigate(symbolPath(h.key))} />
          <p className="px-1 pt-1.5 text-[10px] text-ink-3">
            También desde cualquier página con <kbd className="rounded border border-line px-1">Ctrl</kbd>+<kbd className="rounded border border-line px-1">K</kbd>
          </p>
        </div>
        <WatchlistPanel activeKey={key} />
      </aside>

      <div className="min-w-0 space-y-5">
        {profile.error && <ErrorState error={profile.error} />}
        {profile.isLoading && <Skeleton className="h-[120px]" />}
        {profile.data && <Header p={profile.data} watched={watched.has(key)} onToggle={toggleWatch} />}
        {catalog.data ? <SymbolChart symbolKey={key} catalog={catalog.data} /> : <Skeleton className="h-[640px]" />}
        {catalog.error && <ErrorState error={catalog.error} />}
        {profile.data && (
          <>
            <div className="grid gap-5 xl:grid-cols-2">
              <RelativeCard p={profile.data} />
              <StageCard stage={profile.data.stage} />
            </div>
            <ReferencesCard p={profile.data} />
            <div className="grid gap-5 xl:grid-cols-2">
              <TechnicalsCard items={profile.data.technicals} />
              {profile.data.earnings ? <EarningsCard e={profile.data.earnings} currency={profile.data.currency} /> : <ProfileFacts p={profile.data} />}
            </div>
          </>
        )}
        {profile.isLoading && <Skeleton className="h-[320px]" />}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ header

function Header({ p, watched, onToggle }: { p: SymbolProfile; watched: boolean; onToggle: () => void }) {
  const r = p.reading
  const d1 = r.changes.find((c) => c.horizon === '1D')
  const meta = [p.exchange, assetTypeLabel(p.asset_type), p.currency, p.country].filter(Boolean)
  return (
    <section className="card px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[24px] font-semibold tracking-tight text-ink">{p.ticker}</h1>
            <button
              onClick={onToggle}
              aria-pressed={watched}
              title={watched ? 'Quitar de la watchlist' : 'Añadir a la watchlist'}
              className={clsx('rounded-lg p-1.5 hover:bg-surface-2', watched ? 'text-warn' : 'text-ink-3 hover:text-ink-2')}
            >
              <Star size={18} className={watched ? 'fill-warn' : undefined} />
              <span className="sr-only">{watched ? 'Quitar de la watchlist' : 'Añadir a la watchlist'}</span>
            </button>
            {p.status && p.status !== 'ACTIVE' && <Pill tone="warn">{p.status === 'NOT_ACTIVE' ? 'No activo' : p.status}</Pill>}
          </div>
          <div className="text-sm text-ink-2">{p.name}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-3">
            <span>{meta.join(' · ')}</span>
            {p.sector && <Pill>{p.sector.name}</Pill>}
            {p.industry && <Pill>{p.industry.name}</Pill>}
            {p.universes.map((u) => (
              <Pill key={u.code} tone="accent" title={u.name}>
                {u.name.split(' — ')[0]}
              </Pill>
            ))}
            {p.successor && <span>Sucesor: {p.successor}</span>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[28px] font-semibold tracking-tight text-ink">{fmtLevel(r.last)}</div>
          <div className="flex items-center justify-end gap-2">
            <Delta value={d1?.value} text={fmtChange(d1, 'price')} className="text-sm" />
            <span className="text-[11px] text-ink-3">
              {r.session_in_progress ? 'sesión en curso' : `cierre ${fmtShortDate(r.as_of)}`}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-3 sm:grid-cols-4 xl:grid-cols-8">
        {r.changes
          .filter((c) => c.horizon !== '1D')
          .map((c) => (
            <div key={c.horizon}>
              <div className="text-[11px] text-ink-3">{HORIZON_LABEL[c.horizon] ?? c.horizon}</div>
              <Delta value={c.value} text={fmtChange(c, 'price')} className="text-[13px]" />
            </div>
          ))}
        <div>
          <div className="text-[11px] text-ink-3">Vol. 21 d</div>
          <div className="num text-[13px] font-medium text-ink">{r.realized_vol_21d == null ? DASH : `${fmtNum(r.realized_vol_21d, 1)}%`}</div>
        </div>
      </div>

      <div className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-3">
        <RangeBar r={r} />
        <div>
          <div className="text-[11px] text-ink-3">Frente a la media de 50 / 200</div>
          <div className="num mt-0.5 flex gap-3 text-[13px]">
            <Delta value={r.dist_sma50} text={fmtInUnit(r.dist_sma50, 'price')} />
            <Delta value={r.dist_sma200} text={fmtInUnit(r.dist_sma200, 'price')} />
          </div>
        </div>
        <div>
          <div className="text-[11px] text-ink-3">Tendencia (precio · media 50 · media 200)</div>
          <div className="mt-0.5">
            <Pill tone={r.trend === 'up' ? 'up' : r.trend === 'down' ? 'down' : 'neutral'}>
              {r.trend === 'up' ? 'Alcista: precio > 50 > 200' : r.trend === 'down' ? 'Bajista: precio < 50 < 200' : r.trend === 'mixed' ? 'Mixta' : 'Sin datos'}
            </Pill>
          </div>
        </div>
      </div>
      <Warnings items={[...p.warnings, ...r.warnings]} className="mt-3" />
    </section>
  )
}

function RangeBar({ r }: { r: SymbolProfile['reading'] }) {
  const pos = r.range_position
  return (
    <div>
      <div className="flex justify-between text-[11px] text-ink-3">
        <span>Rango 52 semanas</span>
        <span className="num">{fmtInUnit(r.from_high, 'price')} desde máx.</span>
      </div>
      <div className="relative mt-1.5 h-1.5 rounded-full bg-surface-3" aria-hidden>
        {pos != null && <span className="absolute top-1/2 h-3 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" style={{ left: `${pos * 100}%` }} />}
      </div>
      <div className="num mt-1 flex justify-between text-[11px] text-ink-3">
        <span>{fmtLevel(r.low_52w)}</span>
        <span>{fmtLevel(r.high_52w)}</span>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ relative strength

function PercentileBar({ value }: { value: number | null }) {
  return (
    <div className="relative h-1.5 w-full min-w-[70px] rounded-full bg-surface-3" aria-hidden>
      <span className="absolute top-[-3px] h-3 w-px" style={{ left: '20%', background: 'var(--axis)' }} />
      <span className="absolute top-[-3px] h-3 w-px" style={{ left: '80%', background: 'var(--axis)' }} />
      {value != null && (
        <span
          className={clsx('absolute top-1/2 h-3 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full', value >= 80 ? 'bg-up' : value <= 20 ? 'bg-down' : 'bg-ink')}
          style={{ left: `${value}%` }}
        />
      )}
    </div>
  )
}

function RsRankBlock({ rs }: { rs: RsRank }) {
  return (
    <div>
      <p className="text-[13px] leading-relaxed text-ink">{rs.reading}</p>
      <div className="scroll-thin mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[11px] text-ink-3">
              <th className="pb-1.5 font-medium">Horizonte</th>
              <th className="pb-1.5 font-medium">Percentil en el {rs.universe_label}</th>
              <th className="pb-1.5 text-right font-medium">Δ 1 mes</th>
              <th className="pb-1.5 text-right font-medium">En su sector</th>
              <th className="pb-1.5 text-right font-medium">En su industria</th>
              <th className="pb-1.5 text-right font-medium">Rent.</th>
              <th className="pb-1.5 text-right font-medium" title={`Exceso sobre ${rs.benchmark_label}`}>Exceso</th>
            </tr>
          </thead>
          <tbody className="num">
            {rs.lenses.map((l) => (
              <tr key={l.key} className="border-t border-line">
                <td className="py-1.5 text-ink-2">{l.label}</td>
                <td className="py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-7 font-semibold text-ink">{l.percentile == null ? DASH : fmtNum(l.percentile, 0)}</span>
                    <PercentileBar value={l.percentile} />
                  </div>
                </td>
                <td className="py-1.5 text-right">
                  <Delta value={l.change_1m} text={l.change_1m == null ? DASH : fmtNum(Math.abs(l.change_1m), 0)} className="justify-end" />
                </td>
                <td className="py-1.5 text-right text-ink-2">{l.within_sector == null ? DASH : fmtNum(l.within_sector, 0)}</td>
                <td className="py-1.5 text-right text-ink-2">{l.within_industry == null ? DASH : fmtNum(l.within_industry, 0)}</td>
                <td className="py-1.5 text-right"><Delta value={l.ret} text={fmtPct(l.ret, 1)} className="justify-end" /></td>
                <td className="py-1.5 text-right"><Delta value={l.excess} text={fmtPct(l.excess, 1)} className="justify-end" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-ink-3">
        <span>Precio desde su máx. 52 s: <span className="num text-ink-2">{fmtPct(rs.price_from_high, 1)}</span></span>
        <span>Línea RS desde su máx. 52 s: <span className="num text-ink-2">{fmtPct(rs.rs_line_from_high, 1)}</span></span>
        <span>Datos a {fmtDate(rs.as_of)}</span>
      </div>
      <Warnings items={rs.warnings} className="mt-2" />
    </div>
  )
}

function RelativeTableBlock({ t }: { t: RelativeTable }) {
  return (
    <div>
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-right text-[11px] text-ink-3">
              <th className="pb-1.5 text-left font-medium">Serie</th>
              {t.horizons.map((h) => (
                <th key={h} className="pb-1.5 font-medium">{h === 'YTD' ? 'Año' : h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="num">
            <tr className="border-t border-line">
              <td className="py-1.5 font-medium text-ink">{t.asset.label}</td>
              {t.asset.moves.map((m) => (
                <td key={m.horizon} className="py-1.5 text-right"><Delta value={m.ret} text={fmtPct(m.ret, 1)} className="justify-end" /></td>
              ))}
            </tr>
            {t.references.map((row) => (
              <tr key={row.key} className="border-t border-line align-top">
                <td className="py-1.5 pr-2 text-ink-2">
                  <div className="max-w-[320px] truncate" title={row.label}>{row.label}</div>
                  <div className="text-[10px] text-ink-3">{row.role === 'index' ? 'índice' : row.role} · relativa</div>
                </td>
                {row.moves.map((m) => (
                  <td key={m.horizon} className="py-1.5 text-right">
                    <div className="text-ink-3">{fmtPct(m.ret, 1)}</div>
                    <Delta value={m.relative} text={fmtPct(m.relative, 1)} className="justify-end" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-ink-3">{t.note}</p>
    </div>
  )
}

function RelativeCard({ p }: { p: SymbolProfile }) {
  return (
    <Card
      title="Fuerza relativa en su universo"
      subtitle="Percentil de momento frente a todos los miembros del índice"
      actions={<InfoTip text="El percentil (estilo IBD) ordena el momento del activo frente a todos los miembros de su universo: 80 = más fuerte que el 80 %. «12M ponderado» pesa doble el último trimestre. Añade «Percentil RS en su universo» al gráfico para ver su historia." />}
    >
      {p.rs_rank ? (
        <RsRankBlock rs={p.rs_rank} />
      ) : (
        <p className="text-xs leading-relaxed text-ink-3">
          Sin percentil de universo: solo se guarda para los miembros actuales del S&amp;P 500 y del STOXX 600. La
          comparación con sus referencias está debajo, y en el gráfico puedes añadir la línea de fuerza relativa o la RS
          de Mansfield.
        </p>
      )}
    </Card>
  )
}

function ReferencesCard({ p }: { p: SymbolProfile }) {
  return (
    <Card
      title="Frente a sus referencias"
      subtitle="Rentabilidad del activo, de su índice, de su sector y de su industria (ETF de referencia), y de la línea de fuerza relativa contra cada uno"
    >
      {p.relative ? (
        <RelativeTableBlock t={p.relative} />
      ) : (
        <p className="text-xs text-ink-3">
          Sin referencias de comparación para este activo (índices, divisas, futuros o mercados fuera de EE. UU. y Europa).
        </p>
      )}
    </Card>
  )
}

// ------------------------------------------------------------------ stage

const STAGE_TONE: Record<string, { color: string; tone: 'up' | 'down' | 'warn' | 'accent' | 'neutral' }> = {
  '1a': { color: 'var(--ink-3)', tone: 'neutral' },
  '1b': { color: 'var(--accent)', tone: 'accent' },
  '2': { color: 'var(--up)', tone: 'up' },
  '3': { color: 'var(--warn)', tone: 'warn' },
  '4': { color: 'var(--down)', tone: 'down' },
}

function StageStrip({ segments }: { segments: StageInfo['segments'] }) {
  if (!segments.length) return null
  const t = (iso: string) => new Date(`${iso}T12:00:00`).getTime()
  const t0 = t(segments[0].start)
  const t1 = t(segments[segments.length - 1].end)
  const span = Math.max(1, t1 - t0)
  const years: number[] = []
  for (let y = new Date(t0).getFullYear() + 1; y <= new Date(t1).getFullYear(); y++) years.push(y)
  return (
    <div>
      <div className="relative h-7 overflow-hidden rounded-md">
        {segments.map((s) => {
          const left = ((t(s.start) - t0) / span) * 100
          const width = Math.max(0.4, ((t(s.end) - t(s.start)) / span) * 100)
          return (
            <div
              key={s.start}
              title={`${s.label}: ${fmtDate(s.start)} – ${fmtDate(s.end)}`}
              className="absolute inset-y-0 flex items-center justify-center border-r border-surface text-[10px] font-semibold text-canvas"
              style={{ left: `${left}%`, width: `${width}%`, background: STAGE_TONE[s.stage]?.color }}
            >
              {width > 4 ? s.stage : ''}
            </div>
          )
        })}
      </div>
      <div className="relative mt-1 h-3 text-[10px] text-ink-3">
        {years.map((y) => (
          <span key={y} className="num absolute -translate-x-1/2" style={{ left: `${((new Date(`${y}-01-01T12:00:00`).getTime() - t0) / span) * 100}%` }}>
            {y}
          </span>
        ))}
      </div>
    </div>
  )
}

function StageCard({ stage }: { stage: StageInfo | null }) {
  if (!stage)
    return (
      <Card title="Etapa del ciclo">
        <p className="text-xs text-ink-3">Sin clasificación: hace falta más de un año de historia diaria.</p>
      </Card>
    )
  const tone = STAGE_TONE[stage.stage]
  return (
    <Card title="Etapa del ciclo" subtitle="Clasificación de Minervini (etapas 1 a 4)" actions={<InfoTip text={stage.note} />}>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={tone?.tone}>{stage.label}</Pill>
        <span className="text-xs text-ink-3">desde {fmtDate(stage.since)}</span>
        {stage.base_count > 0 && (
          <span className="text-xs text-ink-3">· base {stage.base_count}{stage.base_note ? ` (${stage.base_note})` : ''}</span>
        )}
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{stage.meaning}</p>
      {stage.contested && stage.leader_label && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-warn-soft px-2.5 py-1.5 text-xs text-ink-2">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-warn" aria-hidden />
          <span>
            En disputa: las reglas puntúan más alto «{stage.leader_label}»; la etapa mostrada se mantiene hasta que el cambio se confirme.
          </span>
        </div>
      )}
      <div className="mt-4 space-y-1.5">
        {stage.scores.map((s) => (
          <div key={s.stage} className="flex items-center gap-2 text-[11px]">
            <span className={clsx('w-[150px] shrink-0 truncate', s.stage === stage.stage ? 'font-semibold text-ink' : 'text-ink-3')} title={s.label}>
              {s.label}
            </span>
            <div className="h-1.5 flex-1 rounded-full bg-surface-3">
              <div className="h-1.5 rounded-full" style={{ width: `${s.score * 100}%`, background: STAGE_TONE[s.stage]?.color }} />
            </div>
            <span className="num w-9 text-right text-ink-2">{fmtNum(s.score * 100, 0)}%</span>
          </div>
        ))}
        <p className="pt-0.5 text-[10px] text-ink-3">Acuerdo con las reglas de cada etapa en la última sesión.</p>
      </div>
      <div className="mt-4">
        <div className="mb-1.5 text-[11px] text-ink-3">Etapas de los últimos años</div>
        <StageStrip segments={stage.segments} />
      </div>
    </Card>
  )
}

// ------------------------------------------------------------------ technicals & earnings

const TONE_PILL: Record<TechnicalReading['tone'], 'up' | 'down' | 'warn' | 'neutral'> = { up: 'up', down: 'down', warn: 'warn', neutral: 'neutral' }

function fmtReading(t: TechnicalReading) {
  if (t.value == null) return DASH
  if (t.unit === 'percent') return `${fmtNum(t.value, 2)}%`
  if (t.code === 'pct_b') return fmtNum(t.value, 2)
  if (t.code === 'rel_volume') return `${fmtNum(t.value, 2)}×`
  // MACD is in price units: a 10 € stock needs more decimals than a 7.000-point index.
  return fmtNum(t.value, t.unit === 'oscillator' ? 1 : Math.abs(t.value) < 1 ? 3 : 2)
}

function TechnicalsCard({ items }: { items: TechnicalReading[] }) {
  return (
    <Card title="Lectura técnica" subtitle="Última sesión diaria, umbrales de manual (no son señales validadas)">
      <ul className="divide-y divide-line">
        {items.map((t) => (
          <li key={t.code} className="flex items-center gap-3 py-2">
            <span className="w-[130px] shrink-0 text-xs text-ink-2">{t.label}</span>
            <span className="num w-[64px] shrink-0 text-right text-[13px] font-semibold text-ink">{fmtReading(t)}</span>
            <span className="min-w-0 flex-1 text-xs text-ink-2">{t.text}</span>
            <span className="hidden sm:block">
              <Pill tone={TONE_PILL[t.tone]}>{t.tone === 'up' ? 'Alcista' : t.tone === 'down' ? 'Bajista' : t.tone === 'warn' ? 'Extremo' : 'Neutral'}</Pill>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function EarningsCard({ e, currency }: { e: NonNullable<SymbolProfile['earnings']>; currency: string | null }) {
  return (
    <Card
      title="Resultados"
      subtitle={e.next_date ? `Próxima publicación prevista: ${fmtDate(e.next_date)}` : 'Beneficio por acción publicado'}
    >
      {e.last.length === 0 ? (
        <p className="text-xs text-ink-3">Sin publicaciones registradas.</p>
      ) : (
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-right text-[11px] text-ink-3">
                <th className="pb-1.5 text-left font-medium">Publicación</th>
                <th className="pb-1.5 font-medium">BPA{currency ? ` (${currency})` : ''}</th>
                <th className="pb-1.5 font-medium">Estimado</th>
                <th className="pb-1.5 font-medium">Sorpresa</th>
                <th className="pb-1.5 font-medium">Interanual</th>
              </tr>
            </thead>
            <tbody className="num">
              {e.last.map((r: EarningsRow) => (
                <tr key={r.date} className="border-t border-line text-right">
                  <td className="py-1.5 text-left text-ink-2">{fmtDate(r.date)}</td>
                  <td className="py-1.5 font-medium text-ink">{fmtNum(r.eps, 2)}</td>
                  <td className="py-1.5 text-ink-3">{fmtNum(r.estimate, 2)}</td>
                  <td className="py-1.5"><Delta value={r.surprise_pct} text={fmtPct(r.surprise_pct, 1)} className="justify-end" /></td>
                  <td className="py-1.5"><Delta value={r.yoy_pct} text={fmtPct(r.yoy_pct, 0)} className="justify-end" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Warnings items={e.warnings} className="mt-2" />
    </Card>
  )
}

function ProfileFacts({ p }: { p: SymbolProfile }) {
  const rows: [string, string][] = [
    ['Mercado', p.exchange],
    ['Tipo', assetTypeLabel(p.asset_type) || DASH],
    ['Divisa', p.currency ?? DASH],
    ['País', p.country ?? DASH],
    ['Referencias', p.references.map((r) => r.label).join(' · ') || DASH],
  ]
  return (
    <Card title="Ficha">
      <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-3">{k}</dt>
            <dd className="text-ink-2">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
