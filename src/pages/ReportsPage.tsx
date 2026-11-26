import { Link } from 'react-router'
import { Card, ErrorState, InfoTip, PageHeader, Pill, Skeleton, Warnings } from '../components/ui'
import { tint } from '../components/symbols/timingOverlay'
import { useTimingBoard } from '../lib/api'
import { DASH, fmtDate } from '../lib/format'
import { symbolPath } from '../lib/symbolNav'
import type { TimingBoard, TimingScore, TimingSignal } from '../lib/types'

const KIND: Record<TimingSignal['direction'], string> = { top: 'Techo', bottom: 'Suelo', volatility: 'Volatilidad' }
const STATE: Record<TimingSignal['state'], string> = {
  upcoming: 'Pendiente',
  awaiting: 'Pasada, sin anotar aún',
  hit: 'Llegó',
  inverted: 'Llegó invertida',
  missed: 'No se produjo',
  forming: 'En formación',
  unparsed: 'Texto libre',
  unrecorded: 'Sin fecha real',
}
const VERDICT: Record<string, { label: string; tone: 'up' | 'warn' | 'neutral' }> = {
  hit: { label: '±2', tone: 'up' },
  near: { label: '±5', tone: 'warn' },
  none: { label: 'sin giro', tone: 'neutral' },
  pending: { label: 'pendiente', tone: 'neutral' },
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : DASH)

function ScoreRow({ l }: { l: TimingScore }) {
  const hit = l.checked ? (l.hits / l.checked) * 100 : null
  const beat = hit != null && l.base_hit_pct != null ? hit - l.base_hit_pct : null
  return (
    <tr className="border-t border-line">
      <td className="py-1.5 pr-3 text-ink">
        {l.block_label}
        {l.subset === 'strong' && (
          <>
            {' '}
            <Pill tone="accent">fuertes</Pill>
          </>
        )}
      </td>
      <td className="pr-3 text-ink-3">{l.on_label}</td>
      <td className="num pr-3 text-right">{l.checked}</td>
      <td className="num pr-3 text-right">
        {pct(l.hits, l.checked)} <span className="text-ink-3">({l.hits})</span>
      </td>
      <td className="num pr-3 text-right text-ink-3">{l.base_hit_pct == null ? DASH : `${Math.round(l.base_hit_pct)} %`}</td>
      <td className={`num pr-3 text-right ${beat == null ? '' : beat > 5 ? 'text-up' : beat < -5 ? 'text-down' : 'text-ink-2'}`}>
        {beat == null ? DASH : `${beat > 0 ? '+' : ''}${Math.round(beat)} pp`}
      </td>
      <td className="num pr-3 text-right">{pct(l.nears, l.checked)}</td>
      <td className="num text-right text-ink-3">{l.base_near_pct == null ? DASH : `${Math.round(l.base_near_pct)} %`}</td>
    </tr>
  )
}

function Scorecard({ board }: { board: TimingBoard }) {
  if (!board.scorecard.length) return null
  const { near, close } = board.scorecard[0]
  return (
    <Card
      title="Cotejo con nuestros precios"
      subtitle={`Cada previsión ya pasada de todos los informes cargados, buscando un giro de cierre de su sentido (pivote: el cierre más bajo o más alto de 3 sesiones a cada lado) a ±${near} y ±${close} sesiones de su fecha. La base es lo que «acertaría» una sesión cualquiera del mismo periodo: solo aporta lo que la supera.`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-ink-3">
            <tr className="text-left">
              <th className="py-1 pr-3 font-medium">Bloque</th>
              <th className="pr-3 font-medium">Cotejado en</th>
              <th className="pr-3 text-right font-medium">Previsiones</th>
              <th className="pr-3 text-right font-medium">Giro a ±{near}</th>
              <th className="pr-3 text-right font-medium">Base ±{near}</th>
              <th className="pr-3 text-right font-medium">
                Frente a la base <InfoTip text="Puntos porcentuales por encima (verde) o por debajo (rojo) de una sesión cualquiera." />
              </th>
              <th className="pr-3 text-right font-medium">Giro a ±{close}</th>
              <th className="text-right font-medium">Base ±{close}</th>
            </tr>
          </thead>
          <tbody>
            {board.scorecard.map((l) => (
              <ScoreRow key={`${l.block}${l.subset}`} l={l} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-ink-3">
        Las del BC (implícitas) cuentan con un giro de cualquier sentido. Con pocas previsiones el porcentaje es poco fiable: mira la columna «Previsiones».
      </p>
    </Card>
  )
}

function BlockTable({ label, note, rows }: { label: string; note: string; rows: TimingSignal[] }) {
  return (
    <Card title={label} subtitle={note}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-ink-3">
            <tr className="text-left">
              <th className="py-1 pr-3 font-medium">Previsto</th>
              <th className="pr-3 font-medium">Giro</th>
              <th className="pr-3 font-medium">Oscilador</th>
              <th className="pr-3 font-medium">Según el autor</th>
              <th className="font-medium">En nuestros precios</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const v = s.check ? VERDICT[s.check.verdict] : null
              return (
                <tr key={`${s.source}${s.predicted_from}${s.direction}`} className="border-t border-line align-top">
                  <td className="num whitespace-nowrap py-1.5 pr-3 text-ink">
                    {s.predicted_raw}
                    {s.cluster && <span className="ml-1 text-ink-3">{s.cluster}</span>}
                    {s.strong && (
                      <>
                        {' '}
                        <Pill tone="accent">fuerte</Pill>
                      </>
                    )}
                  </td>
                  <td className="whitespace-nowrap pr-3">
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: tint(s) }} aria-hidden />
                    {KIND[s.direction]}
                    {s.implied ? ' implícito' : ''}
                  </td>
                  <td className="pr-3 text-ink-2">{s.source ?? 'BC'}</td>
                  <td className="pr-3 text-ink-2">
                    {STATE[s.state]}
                    {s.actual_date && <span className="num text-ink-3"> · {fmtDate(s.actual_date)}</span>}
                  </td>
                  <td className="text-ink-2">
                    {v && s.check ? (
                      <span title={s.check.text}>
                        <Pill tone={v.tone}>{v.label}</Pill>{' '}
                        <span className="text-ink-3">{s.check.text.replace(`En ${s.check.on_label}: `, '')}</span>
                      </span>
                    ) : (
                      <span className="text-ink-3">{s.upcoming ? 'aún no ha llegado' : DASH}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/** External analysts' reports, as they publish them, checked against our prices. */
export function ReportsPage() {
  const q = useTimingBoard()
  const b = q.data
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Informes externos"
        title="Timing Models · McClellan Market Report"
        subtitle={
          b?.report
            ? `Fechas de giro previstas por sus modelos propietarios, tal como las publica (Synopsis no las calcula). Informe #${b.report.report_no} del ${fmtDate(b.report.published_on)}${b.report.next_report_on ? `; el siguiente, ${fmtDate(b.report.next_report_on)}` : ''}.`
            : 'Fechas de giro previstas por sus modelos propietarios, tal como las publica.'
        }
      >
        <Link to={symbolPath('^SPX@CBOE')} className="text-xs text-accent hover:underline">
          Verlas sobre el gráfico (botón «McClellan» en Símbolos)
        </Link>
      </PageHeader>
      {q.error && <ErrorState error={q.error} />}
      {!b && q.isLoading && <Skeleton className="h-[480px]" />}
      {b && (
        <>
          <Warnings items={b.warnings} />
          <Scorecard board={b} />
          <div className="grid gap-5 xl:grid-cols-2">
            {b.blocks.map((blk) => {
              const rows = b.signals.filter((s) => s.block === blk.code)
              return rows.length ? <BlockTable key={blk.code} label={blk.label} note={blk.note} rows={rows} /> : null
            })}
          </div>
        </>
      )}
    </div>
  )
}
