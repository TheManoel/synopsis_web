import clsx from 'clsx'
import { FlaskConical, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useExpiryDetail, useOptionsSummary, useVolContext } from '../lib/api'
import {
  DASH,
  fmtCompact,
  fmtDate,
  fmtIv,
  fmtLevel,
  fmtNum,
  fmtPct,
  fmtShortDate,
  fmtSigned,
  fmtTime,
  fmtUsdCompact,
} from '../lib/format'
import type { Basis, ExpiryDetail, OptionsSummary, TermPoint, VolContext } from '../lib/types'
import { TimeChart, type PaneSpec } from '../components/charts/TimeChart'
import { Legend, LinePlot, StrikeBars, type RefLine } from '../components/charts/xy'
import { Card, ErrorState, InfoTip, PageHeader, Pill, Segmented, Skeleton, Stat, Warnings } from '../components/ui'

const CALL = 'var(--s1)'
const PUT = 'var(--s2)'

const BASIS: { value: Basis; label: string; hint: string }[] = [
  { value: 'auto', label: 'Auto', hint: 'Interés abierto si el proveedor lo informa; si no, volumen (se avisa)' },
  { value: 'open_interest', label: 'Interés abierto', hint: 'Contratos abiertos al cierre anterior' },
  { value: 'volume', label: 'Volumen', hint: 'Contratos negociados en la sesión' },
]
const HORIZONS = [
  { value: 7, label: '≤ 7d' },
  { value: 30, label: '≤ 30d' },
  { value: 45, label: '≤ 45d' },
  { value: 90, label: '≤ 90d' },
  { value: 400, label: 'Todo' },
]
const basisLabel = (b: string) => (b === 'open_interest' ? 'interés abierto' : 'volumen')
const strikeFmt = (v: number) => fmtNum(v, 0)

// ---------------------------------------------------------------- key levels

function KeyLevels({ s, vix }: { s: OptionsSummary; vix: number | null }) {
  const p = s.positioning
  const spot = s.meta.spot
  const dist = (lvl: number | null) => (lvl == null ? undefined : `${fmtPct((lvl / spot - 1) * 100, 1)} vs spot`)
  const longGamma = p.total_gex > 0
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-8">
      <Stat label="Spot S&P 500" value={fmtNum(spot, 2)} sub={s.meta.spot_time ? fmtTime(s.meta.spot_time) : undefined} />
      <Stat
        label="Gamma cero"
        value={p.zero_gamma == null ? DASH : fmtNum(p.zero_gamma, 0)}
        sub={dist(p.zero_gamma) ?? 'Sin cruce en ±10%'}
        hint="Nivel del subyacente donde la gamma agregada de los dealers cambia de signo. Por encima, tienden a amortiguar los movimientos; por debajo, a amplificarlos."
      />
      <Stat label="Muro de calls" value={p.call_wall == null ? DASH : fmtNum(p.call_wall, 0)} sub={dist(p.call_wall)} hint="Strike con mayor gamma positiva de calls: suele actuar como resistencia." />
      <Stat label="Muro de puts" value={p.put_wall == null ? DASH : fmtNum(p.put_wall, 0)} sub={dist(p.put_wall)} hint="Strike con mayor gamma negativa de puts: suele actuar como soporte." />
      <Stat label="Max pain" value={p.max_pain == null ? DASH : fmtNum(p.max_pain, 0)} sub={dist(p.max_pain)} hint="Precio de liquidación que minimiza el valor intrínseco pagado a los compradores de opciones." />
      <Stat
        label="GEX neto"
        value={fmtUsdCompact(p.total_gex)}
        emphasis={longGamma ? 'up' : 'down'}
        sub={longGamma ? 'Dealers largos de gamma' : 'Dealers cortos de gamma'}
        hint="Exposición gamma agregada de los dealers en dólares por movimiento del 1% del subyacente."
      />
      <Stat label="Put / Call" value={p.pcr_weight == null ? DASH : fmtNum(p.pcr_weight, 2)} sub={`por ${basisLabel(p.basis)}`} />
      <Stat
        label="IV ATM 30d"
        value={fmtIv(s.atm_iv_30d)}
        sub={vix == null ? undefined : `VIX ${fmtNum(vix, 2)}`}
        hint="Volatilidad implícita at-the-money interpolada a 30 días en varianza total. El VIX es mayor porque incorpora el skew (toda la sonrisa)."
      />
    </div>
  )
}

// ---------------------------------------------------------------- gamma

function GexByStrike({ s }: { s: OptionsSummary }) {
  const p = s.positioning
  const refX: RefLine[] = [{ value: s.meta.spot, label: 'Spot', color: 'var(--ink-2)' }]
  if (p.zero_gamma != null) refX.push({ value: p.zero_gamma, label: 'Gamma 0', color: 'var(--warn)' })
  const data = p.strikes.map((e) => ({ x: e.strike, up: e.call_gex, down: e.put_gex, net: e.net_gex }))
  return (
    <Card
      title="Exposición gamma por strike"
      subtitle={`Dólares por 1% de movimiento · ${p.expiries.length} vencimientos ≤ ${p.max_days} días · ponderado por ${basisLabel(p.basis)}`}
      actions={<Legend items={[{ color: CALL, label: 'Calls (+)' }, { color: PUT, label: 'Puts (−)' }]} />}
    >
      {data.length ? (
        <StrikeBars
          data={data}
          height={320}
          upColor={CALL}
          downColor={PUT}
          upLabel="GEX calls"
          downLabel="GEX puts"
          netLabel="Neto"
          xFormat={strikeFmt}
          yFormat={fmtUsdCompact}
          refX={refX}
        />
      ) : (
        <p className="text-sm text-ink-3">Sin posiciones con peso en el horizonte elegido.</p>
      )}
    </Card>
  )
}

function GammaProfile({ s }: { s: OptionsSummary }) {
  const p = s.positioning
  const points = p.spot_grid.map((x, i) => [x, p.gamma_curve[i]] as [number, number])
  const refX: RefLine[] = [{ value: s.meta.spot, label: 'Spot', color: 'var(--ink-2)' }]
  if (p.zero_gamma != null) refX.push({ value: p.zero_gamma, label: 'Gamma 0', color: 'var(--warn)' })
  return (
    <Card title="Perfil de gamma" subtitle="GEX total si el subyacente estuviera en otro nivel (±10%)">
      <LinePlot
        height={320}
        series={[{ id: 'g', label: 'GEX total', color: 'var(--accent)', points }]}
        xFormat={strikeFmt}
        yFormat={fmtUsdCompact}
        refX={refX}
        refY={[{ value: 0, label: '' }]}
        tooltipTitle={(x) => `S&P 500 en ${fmtNum(x, 0)} (${fmtPct((x / s.meta.spot - 1) * 100, 1)})`}
      />
    </Card>
  )
}

// ---------------------------------------------------------------- term structure

function TermStructure({ term, onPick, selected }: { term: TermPoint[]; onPick: (e: string) => void; selected: string | null }) {
  const pts = (f: (t: TermPoint) => number | null) =>
    term.filter((t) => f(t) != null).map((t) => [t.days, f(t)! * 100] as [number, number])
  const series = [
    { id: 'atm', label: 'ATM', color: 'var(--s1)', points: pts((t) => t.atm_iv), dots: true },
    { id: 'p25', label: 'Put 25Δ', color: 'var(--s2)', points: pts((t) => t.put25_iv) },
    { id: 'c25', label: 'Call 25Δ', color: 'var(--s3)', points: pts((t) => t.call25_iv) },
  ]
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card
        title="Estructura temporal de la volatilidad"
        subtitle="IV por días a vencimiento"
        actions={<Legend items={series.map((s) => ({ color: s.color, label: s.label }))} />}
      >
        <LinePlot
          height={300}
          series={series}
          xFormat={(v) => `${fmtNum(v, 0)}d`}
          yFormat={(v) => `${fmtNum(v, 1)}%`}
          tooltipTitle={(d) => {
            const t = term.reduce((a, b) => (Math.abs(b.days - d) < Math.abs(a.days - d) ? b : a))
            return `${fmtDate(t.expiry)} · ${fmtNum(t.days, 1)} días`
          }}
        />
      </Card>
      <Card title="Movimiento esperado por vencimiento" subtitle="±1σ implícito por la IV ATM · el straddle ATM como contraste" bodyClassName="p-0">
        <div className="scroll-thin max-h-[340px] overflow-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-surface text-[11px] text-ink-3">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Vencimiento</th>
                <th className="px-2 py-2 text-right font-medium">Días</th>
                <th className="px-2 py-2 text-right font-medium">IV ATM</th>
                <th className="px-2 py-2 text-right font-medium">±1σ</th>
                <th className="px-2 py-2 text-right font-medium">Straddle</th>
                <th className="px-4 py-2 text-right font-medium" title="Risk reversal 25Δ: IV call 25Δ − IV put 25Δ">RR 25Δ</th>
              </tr>
            </thead>
            <tbody>
              {term.map((t) => (
                <tr
                  key={t.expiry}
                  onClick={() => onPick(t.expiry)}
                  className={clsx('cursor-pointer border-t border-line', selected === t.expiry ? 'bg-accent-soft' : 'hover:bg-surface-2')}
                >
                  <td className="px-4 py-1.5 text-ink">
                    {fmtDate(t.expiry)}
                    {t.warnings.length > 0 && (
                      <span className="ml-1.5">
                        <Pill tone="warn" title={t.warnings.join(' · ')}>aviso</Pill>
                      </span>
                    )}
                  </td>
                  <td className="num px-2 py-1.5 text-right text-ink-2">{fmtNum(t.days, 1)}</td>
                  <td className="num px-2 py-1.5 text-right">{fmtIv(t.atm_iv)}</td>
                  <td className="num px-2 py-1.5 text-right">
                    {t.expected_move == null ? DASH : `±${fmtNum(t.expected_move, 0)}`}
                    <span className="ml-1 text-ink-3">{t.expected_move_pct == null ? '' : `${fmtNum(t.expected_move_pct, 2)}%`}</span>
                  </td>
                  <td className="num px-2 py-1.5 text-right text-ink-2">{t.straddle == null ? DASH : fmtNum(t.straddle, 1)}</td>
                  <td className="num px-4 py-1.5 text-right text-ink-2">{t.rr25 == null ? DASH : fmtSigned(t.rr25 * 100, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------- one expiry

function ExpiryChips({ term, value, onChange }: { term: TermPoint[]; value: string | null; onChange: (e: string) => void }) {
  return (
    <div className="scroll-thin flex gap-1.5 overflow-x-auto pb-1">
      {term.map((t) => (
        <button
          key={t.expiry}
          onClick={() => onChange(t.expiry)}
          className={clsx(
            'shrink-0 rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition-colors',
            value === t.expiry ? 'border-accent/50 bg-accent-soft text-ink' : 'border-line bg-surface-2 text-ink-2 hover:text-ink',
          )}
        >
          <div className="font-medium">{fmtShortDate(t.expiry)}</div>
          <div className="num text-ink-3">{t.days < 1 ? '0DTE' : `${Math.round(t.days)}d`}</div>
        </button>
      ))}
    </div>
  )
}

function ExpiryView({ d }: { d: ExpiryDetail }) {
  const spot = d.meta.spot
  const F = d.term.forward
  const smile = d.rows.filter((r) => r.iv != null).map((r) => [r.strike, r.iv! * 100] as [number, number])
  const provider = d.rows
    .map((r) => {
      const side = r.strike >= F ? r.call : r.put
      return side?.provider_iv && side.provider_iv > 0.01 ? ([r.strike, side.provider_iv * 100] as [number, number]) : null
    })
    .filter(Boolean) as [number, number][]
  const weight = (q: { open_interest: number | null; volume: number | null } | null) =>
    q ? (d.basis === 'open_interest' ? (q.open_interest ?? 0) : (q.volume ?? 0)) : 0
  const bars = d.rows.map((r) => ({ x: r.strike, up: weight(r.call), down: -weight(r.put) }))
  const refX: RefLine[] = [{ value: spot, label: 'Spot', color: 'var(--ink-2)' }]
  if (d.max_pain != null) refX.push({ value: d.max_pain, label: 'Max pain', color: 'var(--warn)' })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Forward" value={fmtNum(F, 1)} sub={d.term.forward_method === 'parity' ? 'Paridad put-call' : d.term.forward_method === 'parity_unit_discount' ? 'Paridad put-call (D=1)' : 'Aproximado (ver avisos)'} />
        <Stat label="IV ATM" value={fmtIv(d.term.atm_iv)} />
        <Stat label="Movimiento ±1σ" value={d.term.expected_move == null ? DASH : `±${fmtNum(d.term.expected_move, 0)}`} sub={d.term.expected_move_pct == null ? undefined : `${fmtNum(d.term.expected_move_pct, 2)}% del spot`} />
        <Stat label="Skew RR 25Δ" value={d.term.rr25 == null ? DASH : `${fmtSigned(d.term.rr25 * 100, 1)} pts`} hint="IV call 25Δ − IV put 25Δ. Negativo: las puts cotizan más caras (demanda de cobertura)." />
        <Stat label="Max pain" value={d.max_pain == null ? DASH : fmtNum(d.max_pain, 0)} sub={`por ${basisLabel(d.basis)}`} />
        <Stat
          label="Put / Call"
          value={d.pcr_weight == null ? DASH : fmtNum(d.pcr_weight, 2)}
          sub={d.pcr_volume == null ? undefined : `Volumen ${fmtNum(d.pcr_volume, 2)}`}
        />
      </div>
      <Warnings items={d.warnings} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card
          title="Sonrisa de volatilidad"
          subtitle="IV propia (Black-76 sobre el mid OTM) frente a la que publica Yahoo"
          actions={<Legend items={[{ color: 'var(--s1)', label: 'IV propia' }, { color: 'var(--ink-3)', label: 'IV Yahoo' }]} />}
        >
          <LinePlot
            height={300}
            series={[
              { id: 'y', label: 'IV Yahoo', color: 'var(--ink-3)', points: provider, dots: true, faint: true },
              { id: 'iv', label: 'IV propia', color: 'var(--s1)', points: smile },
            ]}
            xFormat={strikeFmt}
            yFormat={(v) => `${fmtNum(v, 1)}%`}
            refX={[{ value: F, label: 'Forward', color: 'var(--ink-2)' }]}
            tooltipTitle={(k) => `Strike ${fmtNum(k, 0)} · ${fmtPct((k / spot - 1) * 100, 1)}`}
          />
        </Card>
        <Card
          title={`Posicionamiento por strike · ${basisLabel(d.basis)}`}
          subtitle="Calls hacia arriba, puts hacia abajo"
          actions={<Legend items={[{ color: CALL, label: 'Calls' }, { color: PUT, label: 'Puts' }]} />}
        >
          <StrikeBars
            data={bars}
            height={300}
            upColor={CALL}
            downColor={PUT}
            upLabel="Calls"
            downLabel="Puts"
            xFormat={strikeFmt}
            yFormat={(v) => fmtCompact(Math.abs(v))}
            refX={refX}
          />
        </Card>
      </div>
      <ChainTable d={d} />
    </div>
  )
}

function ChainTable({ d }: { d: ExpiryDetail }) {
  const F = d.term.forward
  const near = useMemo(() => {
    const idx = d.rows.reduce((best, r, i) => (Math.abs(r.strike - F) < Math.abs(d.rows[best].strike - F) ? i : best), 0)
    return d.rows.slice(Math.max(0, idx - 14), idx + 15)
  }, [d, F])
  const cell = (v: number | null | undefined, dec = 2) => (v == null ? DASH : fmtNum(v, dec))
  return (
    <Card title="Cadena alrededor del forward" subtitle="29 strikes centrados en el forward · sombreadas las opciones dentro de dinero" bodyClassName="p-0">
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[860px] text-[12px]">
          <thead className="text-[11px] text-ink-3">
            <tr className="border-b border-line">
              <th colSpan={5} className="py-2 text-center font-semibold" style={{ color: CALL }}>CALLS</th>
              <th className="px-3 py-2 text-center font-medium">Strike</th>
              <th colSpan={5} className="py-2 text-center font-semibold" style={{ color: PUT }}>PUTS</th>
            </tr>
            <tr>
              {['Vol.', 'Int. ab.', 'Δ', 'Bid', 'Ask'].map((h) => (
                <th key={`c${h}`} className="px-2 py-1.5 text-right font-medium">{h}</th>
              ))}
              <th className="px-3 py-1.5 text-center font-medium">IV</th>
              {['Bid', 'Ask', 'Δ', 'Int. ab.', 'Vol.'].map((h) => (
                <th key={`p${h}`} className="px-2 py-1.5 text-right font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {near.map((r) => {
              const callItm = r.strike < F
              const atm = Math.abs(r.strike - F) === Math.min(...near.map((x) => Math.abs(x.strike - F)))
              return (
                <tr key={r.strike} className={clsx('border-t border-line', atm && 'outline outline-1 -outline-offset-1 outline-accent/40')}>
                  {[r.call?.volume, r.call?.open_interest, r.call?.delta, r.call?.bid, r.call?.ask].map((v, i) => (
                    <td key={i} className={clsx('num px-2 py-1.5 text-right', callItm ? 'bg-surface-2 text-ink' : 'text-ink-2')}>
                      {cell(v, i < 2 ? 0 : 2)}
                    </td>
                  ))}
                  <td className="num px-3 py-1.5 text-center font-semibold text-ink">
                    {fmtNum(r.strike, 0)}
                    <div className="text-[10px] font-normal text-ink-3">{fmtIv(r.iv)}</div>
                  </td>
                  {[r.put?.bid, r.put?.ask, r.put?.delta, r.put?.open_interest, r.put?.volume].map((v, i) => (
                    <td key={i} className={clsx('num px-2 py-1.5 text-right', !callItm ? 'bg-surface-2 text-ink' : 'text-ink-2')}>
                      {cell(v, i > 2 ? 0 : 2)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------- vol context

function VolContextView({ v }: { v: VolContext }) {
  const pts = (key: string) => v.dates.map((t, i) => ({ time: t, value: v.series[key]?.[i] ?? null }))
  const panes = useMemo<PaneSpec[]>(
    () => [
      {
        stretch: 1.4,
        series: [
          { type: 'line', id: 'vix', label: 'VIX', color: 'var(--s1)', data: pts('vix'), format: (x) => fmtNum(x, 2) },
          { type: 'line', id: 'rv', label: 'Vol. realizada 21d S&P 500', color: 'var(--s2)', data: pts('realized_vol_21d'), format: (x) => fmtNum(x, 2) },
        ],
      },
      {
        levels: [{ value: 1, label: '1,0' }],
        series: [{ type: 'line', id: 'tr', label: 'VIX / VIX3M', color: 'var(--s7)', data: pts('term_ratio'), format: (x) => fmtNum(x, 3) }],
      },
    ],
    [v], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const inverted = (v.term_ratio ?? 0) > 1
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div className="grid grid-cols-2 content-start gap-3">
        {v.readings.map((r) => (
          <div key={r.code} className="card px-4 py-3">
            <div className="text-xs text-ink-3">{r.label}</div>
            <div className="mt-1 text-[22px] font-semibold tracking-tight">{r.value == null ? DASH : fmtNum(r.value, 2)}</div>
            <div className="mt-2 h-1.5 rounded-full bg-surface-3" title="Percentil del último año">
              <div className="h-full rounded-full bg-accent" style={{ width: `${r.percentile_1y ?? 0}%` }} />
            </div>
            <div className="num mt-1 flex justify-between text-[11px] text-ink-3">
              <span>Percentil 1A {r.percentile_1y == null ? DASH : fmtNum(r.percentile_1y, 0)}</span>
              <span>{r.change_5d == null ? '' : `${fmtSigned(r.change_5d, 2)} 5d`}</span>
            </div>
          </div>
        ))}
        <div className="card col-span-2 grid grid-cols-2 gap-3 px-4 py-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-ink-3">
              VIX / VIX3M <InfoTip text="Por encima de 1 la curva del VIX está invertida: el mercado paga más por protección inmediata que a 3 meses." />
            </div>
            <div className="mt-1 text-lg font-semibold">{v.term_ratio == null ? DASH : fmtNum(v.term_ratio, 3)}</div>
            <Pill tone={inverted ? 'down' : 'up'}>{inverted ? 'Curva invertida' : 'Curva normal'}</Pill>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs text-ink-3">
              Prima de varianza <InfoTip text="VIX menos la volatilidad realizada a 21 sesiones del S&P 500. Negativa: lo realizado supera a lo implícito." />
            </div>
            <div className="mt-1 text-lg font-semibold">{v.variance_premium == null ? DASH : `${fmtSigned(v.variance_premium, 1)} pts`}</div>
            <div className="text-[11px] text-ink-3">RV21 {v.realized_vol_21d == null ? DASH : fmtNum(v.realized_vol_21d, 1)}</div>
          </div>
        </div>
      </div>
      <Card title="Volatilidad implícita frente a realizada" subtitle={`Cierres diarios hasta ${fmtDate(v.as_of)}`}>
        <TimeChart panes={panes} height={380} />
        <Warnings items={v.warnings} className="mt-3" />
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------- page

export function OptionsPage() {
  const [basis, setBasis] = useState<Basis>('auto')
  const [maxDays, setMaxDays] = useState(45)
  const [nonce, setNonce] = useState(0)
  const [picked, setExpiry] = useState<string | null>(null)
  const q = useOptionsSummary(basis, maxDays, nonce)
  const vol = useVolContext(252)
  const term = useMemo(() => q.data?.term ?? [], [q.data])
  // Default: the first expiry with at least two days left (0DTE smiles are noisy).
  const expiry =
    picked && term.some((t) => t.expiry === picked) ? picked : (term.find((t) => t.days >= 2) ?? term[0])?.expiry ?? null
  const detail = useExpiryDetail(expiry, basis, nonce)
  const vix = vol.data?.readings.find((r) => r.code === 'vix')?.value ?? null

  const meta = q.data?.meta
  const warnings = [...(meta?.warnings ?? []), ...(q.data?.positioning.warnings ?? [])]

  return (
    <div>
      <PageHeader
        eyebrow="Opciones · prueba de concepto"
        title="S&P 500"
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            Posicionamiento, volatilidad implícita y riesgo de cola a partir de la cadena del SPX.
            <Pill tone="accent">
              <FlaskConical size={11} /> PoC
            </Pill>
          </span>
        }
      >
        {meta && (
          <span className="text-xs text-ink-3">
            {meta.contracts.toLocaleString('es-ES')} contratos · {meta.expiries.length} vencimientos · captura {fmtTime(meta.fetched_at)}
          </span>
        )}
        <button
          onClick={() => setNonce((n) => n + 1)}
          disabled={q.isFetching}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-2 hover:text-ink disabled:opacity-50"
        >
          <RefreshCw size={13} className={clsx(q.isFetching && 'animate-spin')} /> Actualizar cadena
        </button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-ink-3">
          Posicionamiento
          <Segmented label="Base de posicionamiento" value={basis} options={BASIS} onChange={setBasis} />
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-3">
          Horizonte
          <Segmented label="Horizonte de vencimientos" value={maxDays} options={HORIZONS} onChange={setMaxDays} />
        </div>
      </div>

      {q.error ? (
        <ErrorState error={q.error} />
      ) : !q.data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[92px]" />
            ))}
          </div>
          <Skeleton className="h-[380px]" />
          <p className="text-xs text-ink-3">Descargando la cadena del SPX (≈40 vencimientos)…</p>
        </div>
      ) : (
        <div className={clsx('space-y-6', q.isPlaceholderData && 'is-stale')}>
          <Warnings items={warnings} />
          <KeyLevels s={q.data} vix={vix} />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <GexByStrike s={q.data} />
            <GammaProfile s={q.data} />
          </div>

          <section>
            <h2 className="mb-3 text-[15px] font-semibold">Volatilidad implícita</h2>
            <TermStructure term={term} selected={expiry} onPick={setExpiry} />
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-[15px] font-semibold">
                Vencimiento {expiry ? fmtDate(expiry) : ''}
              </h2>
            </div>
            <ExpiryChips term={term} value={expiry} onChange={setExpiry} />
            <div className="mt-3">
              {detail.error ? (
                <ErrorState error={detail.error} />
              ) : !detail.data ? (
                <Skeleton className="h-[420px]" />
              ) : (
                <div className={clsx(detail.isPlaceholderData && 'is-stale')}>
                  <ExpiryView d={detail.data} />
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-[15px] font-semibold">Contexto de volatilidad</h2>
            {vol.error ? <ErrorState error={vol.error} /> : !vol.data ? <Skeleton className="h-[400px]" /> : <VolContextView v={vol.data} />}
          </section>

          <details className="card group px-4 py-3 text-xs text-ink-2">
            <summary className="cursor-pointer select-none font-medium text-ink">Metodología y supuestos</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {q.data.meta.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
              <li>
                Fuente: {q.data.meta.source}. Spot {fmtLevel(q.data.meta.spot)} a {fmtTime(q.data.meta.spot_time)}. Instantánea en memoria
                durante 5 minutos; no se guarda histórico de la cadena.
              </li>
            </ul>
          </details>
        </div>
      )}
    </div>
  )
}
