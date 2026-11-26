import { ExternalLink, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useIndicatorSeries, useRsGroupHistories, useRsGroupHistory, useRsMemberHistories, useRsMemberHistory } from '../../lib/api'
import { fmtNum, fmtSigned } from '../../lib/format'
import { clearCompare, toggleCompare, useCompare } from '../../lib/rsCompare'
import { seriesColor } from '../../lib/theme'
import type { RsLensRef, RsMember, RsScope } from '../../lib/types'
import { TimeChart, type PaneSpec, type Pt } from '../charts/TimeChart'
import { Delta, ErrorState, Segmented, Skeleton, Warnings } from '../ui'
import { fmtFromHigh, fmtPp, RS_RANGES as RANGES } from '../../lib/rs'
import { PctCell, PinButton } from './parts'

/** Lens identity in a chart: fixed series slots (12M, 3M, 1M = s1, s2, s3). */
const lensColor = (lenses: RsLensRef[], key: string) => seriesColor(Math.max(0, lenses.findIndex((l) => l.key === key)))

const pts = (dates: string[], values: (number | null)[] | undefined): Pt[] =>
  dates.map((time, i) => ({ time, value: values?.[i] ?? null }))

const pctFmt = (v: number) => fmtNum(v, 1)
const pcFmt = (v: number) => `${fmtNum(v, 0)}%`
const ddFmt = (v: number) => `${fmtNum(v, 1)}%`

function sampledNote(sampling: string | undefined) {
  return sampling === 'weekly' ? 'Una barra por semana (la última guardada de cada semana).' : null
}

// ---------------------------------------------------------------- group history

export function GroupHistory({
  universe,
  scope,
  code,
  lens,
  lenses,
  range,
  asOf,
}: {
  universe: string
  scope: RsScope
  code: string
  lens: string
  lenses: RsLensRef[]
  range: string
  /** The bar the page is looking at: the series ends there. */
  asOf: string | null
}) {
  const q = useRsGroupHistory({ universe, scope, code }, range, asOf)
  const d = q.data
  const lensLabel = lenses.find((l) => l.key === lens)?.label ?? lens

  const panes = useMemo<PaneSpec[]>(() => {
    if (!d) return []
    return [
      {
        title: 'Percentil medio de sus valores en el universo',
        stretch: 3,
        levels: [{ value: 50, label: '50' }],
        series: lenses.map((l) => ({
          type: 'line' as const,
          id: `mean-${l.key}`,
          label: `RS ${l.label}`,
          color: lensColor(lenses, l.key),
          width: (l.key === lens ? 2 : 1) as 1 | 2,
          data: pts(d.dates, d.mean_percentile[l.key]),
          format: pctFmt,
        })),
      },
      {
        title: `Participación ${lensLabel}: % de líderes (≥ ${d.leader_percentile}) y de rezagados (≤ ${d.laggard_percentile})`,
        stretch: 2,
        series: [
          { type: 'line', id: 'leaders', label: 'Líderes', color: 'var(--up)', data: pts(d.dates, d.pct_leaders[lens]), format: pcFmt },
          { type: 'line', id: 'laggards', label: 'Rezagados', color: 'var(--down)', data: pts(d.dates, d.pct_laggards[lens]), format: pcFmt },
        ],
      },
    ]
  }, [d, lenses, lens, lensLabel])

  if (q.error) return <ErrorState error={q.error} />
  if (!d) return <Skeleton className="h-[380px]" />
  const notes = [sampledNote(d.sampling), ...d.warnings].filter(Boolean) as string[]
  return (
    <div className={q.isPlaceholderData ? 'is-stale' : undefined}>
      <TimeChart panes={panes} height={380} rangeKey={`${universe}-${scope}-${code}-${range}-${asOf}`} />
      <Warnings items={notes} className="mt-3" />
    </div>
  )
}

// ---------------------------------------------------------------- member detail

const REFS = [
  { value: 'index', label: 'Índice' },
  { value: 'sector', label: 'ETF sector' },
  { value: 'industry', label: 'ETF industria' },
]

export function MemberDetail({
  memberKey,
  universe,
  row,
  groupSizes,
  lens,
  lenses,
  deltaLabel,
  range,
  asOf,
  onRange,
  onOpenGroup,
  onClose,
}: {
  memberKey: string
  universe: string
  /** The member's row in the board at the bar shown (absent if not a member). */
  row: RsMember | null
  /** Members of its sector and industry in the board (small groups jump in steps). */
  groupSizes?: { sector: number | null; industry: number | null }
  lens: string
  lenses: RsLensRef[]
  deltaLabel: string
  range: string
  /** The bar the page is looking at (null = the last one): the series end there. */
  asOf: string | null
  onRange: (r: string) => void
  onOpenGroup: (scope: RsScope, code: string, sector?: string | null) => void
  onClose: () => void
}) {
  const [ref, setRef] = useState('index')
  const q = useRsMemberHistory(memberKey, universe, range, asOf)
  const d = q.data
  const tf = range === '1y' || range === '2y' ? 'd' : 'w'
  // The price-based RS line (from Símbolos) always ends today: shown only in the current view.
  const [rsLine] = useIndicatorSeries(asOf ? null : memberKey, tf, range, [`rs_line:${ref},50`])
  const lensLabel = lenses.find((l) => l.key === lens)?.label ?? lens

  const panes = useMemo<PaneSpec[]>(() => {
    const out: PaneSpec[] = []
    if (d && d.dates.length) {
      out.push({
        title: 'Percentil en el universo',
        stretch: 3,
        levels: [{ value: 50, label: '50' }],
        series: lenses.map((l) => ({
          type: 'line' as const,
          id: `pct-${l.key}`,
          label: `RS ${l.label}`,
          color: lensColor(lenses, l.key),
          width: (l.key === lens ? 2 : 1) as 1 | 2,
          data: pts(d.dates, d.percentile[l.key]),
          format: pctFmt,
        })),
      })
      out.push({
        title: `Percentil ${lensLabel} dentro de su grupo`,
        stretch: 2,
        levels: [{ value: 50 }],
        series: [
          { type: 'line', id: 'w-sector', label: 'En su sector', color: seriesColor(3), data: pts(d.dates, d.within_sector[lens]), format: pctFmt },
          { type: 'line', id: 'w-industry', label: 'En su industria', color: seriesColor(4), data: pts(d.dates, d.within_industry[lens]), format: pctFmt },
        ],
      })
    }
    const s = asOf ? undefined : rsLine.data
    if (s) {
      out.push({
        title: `${s.label} (base 100 al inicio)`,
        stretch: 2,
        levels: [{ value: 100 }],
        series: s.lines.map((ln, i) => ({
          type: 'line' as const,
          id: `rs-${ln.key}`,
          label: ln.label,
          color: i === 0 ? 'var(--ink-2)' : 'var(--ink-3)',
          dashed: ln.style === 'dashed',
          width: 1 as const,
          data: pts(s.dates, ln.values),
          format: (v: number) => fmtNum(v, 2),
        })),
      })
    }
    if (d && d.dates.length) {
      out.push({
        title: 'Distancia al máximo de 52 semanas',
        stretch: 2,
        levels: [{ value: 0 }],
        series: [
          { type: 'line', id: 'dd-price', label: 'Precio', color: seriesColor(6), width: 1, data: pts(d.dates, d.price_from_high), format: ddFmt },
          { type: 'line', id: 'dd-rs', label: 'Línea RS', color: seriesColor(0), width: 1, data: pts(d.dates, d.rs_line_from_high), format: ddFmt },
        ],
      })
    }
    return out
  }, [d, rsLine.data, asOf, lenses, lens, lensLabel])

  const title = d ? d.ticker : memberKey.split('@')[0]
  const warnings = asOf
    ? [...(d?.warnings ?? []), 'Viendo una fecha pasada: la línea RS frente al índice, que sale del precio, solo se dibuja en la vista actual.']
    : [...(d?.warnings ?? []), ...(rsLine.data?.warnings ?? []), ...(rsLine.error ? [`Línea RS: ${(rsLine.error as Error).message}`] : [])]
  const small = (n: number | null | undefined, what: string) =>
    n != null && n < 5
      ? n <= 1
        ? `Es el único valor de su ${what}: su percentil dentro de ella no compara con nadie (sale 50).`
        : `Su ${what} tiene ${n} valores: el percentil dentro de ella va a saltos (con 2, solo 0 o 100).`
      : null
  const notes = [
    sampledNote(d?.sampling),
    small(groupSizes?.industry, 'industria'),
    small(groupSizes?.sector, 'sector'),
    ...warnings,
  ].filter(Boolean) as string[]

  return (
    <section className="card">
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 pt-3.5">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h3 className="text-[17px] font-semibold text-ink">{title}</h3>
            <span className="truncate text-sm text-ink-2">{d?.name}</span>
          </div>
          {d?.sector_code && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
              <button className="hover:text-ink hover:underline" onClick={() => onOpenGroup('sector', d.sector_code!)}>
                {d.sector_name}
              </button>
              {d.industry_code && (
                <>
                  <span aria-hidden>›</span>
                  <button className="hover:text-ink hover:underline" onClick={() => onOpenGroup('industry', d.industry_code!, d.sector_code)}>
                    {d.industry_name}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PinButton item={{ universe, kind: 'member', code: memberKey, label: title }} />
          <Link
            to={`/simbolos/${encodeURIComponent(memberKey)}`}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-ink-3 hover:bg-surface-2 hover:text-ink-2"
          >
            Abrir en Símbolos <ExternalLink size={12} />
          </Link>
          <button onClick={onClose} aria-label="Cerrar el detalle" className="rounded-lg p-1 text-ink-3 hover:bg-surface-2 hover:text-ink-2">
            <X size={15} />
          </button>
        </div>
      </header>

      {row && (
        <div className="scroll-thin mt-3 overflow-x-auto px-4">
          <table className="w-full min-w-[620px] text-[12px]">
            <thead>
              <tr className="text-[11px] text-ink-3">
                <th className="py-1 text-left font-medium">Horizonte</th>
                <th className="px-2 py-1 text-right font-medium">Percentil</th>
                <th className="px-2 py-1 text-right font-medium">Δ {deltaLabel}</th>
                <th className="px-2 py-1 text-right font-medium">En su sector</th>
                <th className="px-2 py-1 text-right font-medium">En su industria</th>
                <th className="px-2 py-1 text-right font-medium">Rentabilidad</th>
                <th className="py-1 pl-2 text-right font-medium">Exceso vs índice</th>
              </tr>
            </thead>
            <tbody>
              {lenses.map((l) => (
                <tr key={l.key} className="border-t border-line">
                  <td className="py-1.5 font-medium text-ink" title={l.description}>{l.label}</td>
                  <td className="px-2 py-1 text-right"><PctCell value={row.percentile[l.key]} /></td>
                  <td className="px-2 py-1 text-right"><Delta value={row.delta[l.key]} text={fmtSigned(row.delta[l.key], 0)} className="text-xs" /></td>
                  <td className="px-2 py-1 text-right"><PctCell value={row.within_sector[l.key]} /></td>
                  <td className="px-2 py-1 text-right"><PctCell value={row.within_industry[l.key]} /></td>
                  <td className="num px-2 py-1 text-right text-ink-2">{fmtSigned(row.ret[l.key], 1, '%')}</td>
                  <td className="num py-1 pl-2 text-right text-ink-2">{fmtPp(row.excess[l.key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-ink-3">
            Precio {fmtFromHigh(row.price_from_high)} de su máximo de 52 semanas · línea RS {fmtFromHigh(row.rs_line_from_high)} del suyo.
          </p>
        </div>
      )}

      <div className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {asOf ? <span /> : <Segmented size="sm" label="Referencia de la línea RS" value={ref} options={REFS} onChange={setRef} />}
          <Segmented size="sm" label="Rango" value={range} options={RANGES} onChange={onRange} />
        </div>
        {q.error ? (
          <ErrorState error={q.error} />
        ) : !d && q.isLoading ? (
          <Skeleton className="h-[520px]" />
        ) : panes.length ? (
          <div className={q.isPlaceholderData ? 'is-stale' : undefined}>
            <TimeChart panes={panes} height={d?.dates.length ? 560 : 260} rangeKey={`${memberKey}-${range}-${asOf}`} />
          </div>
        ) : null}
        <Warnings items={notes} className="mt-3" />
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- comparison

export function ComparePanel({ lens, lenses, labels, asOf }: { lens: string; lenses: RsLensRef[]; labels: Record<string, string>; asOf: string | null }) {
  const items = useCompare()
  const [range, setRange] = useState('2y')
  const groups = items.filter((i) => i.kind !== 'member')
  const members = items.filter((i) => i.kind === 'member')
  const gq = useRsGroupHistories(groups.map((g) => ({ universe: g.universe, scope: g.kind as RsScope, code: g.code })), range, asOf)
  const mq = useRsMemberHistories(members.map((m) => ({ key: m.code, universe: m.universe })), range, asOf)
  const lensLabel = lenses.find((l) => l.key === lens)?.label ?? lens
  const multiUniverse = new Set(items.map((i) => i.universe)).size > 1

  const gData = gq.map((q) => q.data)
  const mData = mq.map((q) => q.data)
  const panes: PaneSpec[] = (() => {
    const series: PaneSpec['series'] = []
    groups.forEach((g, i) => {
      const d = gData[i]
      if (d) series.push({ type: 'line', id: `g-${g.universe}-${g.code}`, label: multiUniverse ? `${g.label} · ${labels[g.universe] ?? g.universe}` : g.label, color: seriesColor(g.slot), data: pts(d.dates, d.mean_percentile[lens]), format: pctFmt })
    })
    members.forEach((m, i) => {
      const d = mData[i]
      if (d && d.dates.length) series.push({ type: 'line', id: `m-${m.universe}-${m.code}`, label: multiUniverse ? `${m.label} · ${labels[m.universe] ?? m.universe}` : m.label, color: seriesColor(m.slot), data: pts(d.dates, d.percentile[lens]), format: pctFmt })
    })
    return series.length ? [{ title: `Percentil ${lensLabel} en su universo (grupos: media de sus valores)`, levels: [{ value: 50 }], series }] : []
  })()
  // TimeChart rebuilds when `panes` changes identity: keep it stable while the data is.
  const panesKey = `${lens}|${multiUniverse}|${items.map((i) => `${i.universe}:${i.code}:${i.slot}`).join(',')}|${[...gData, ...mData].map((d) => (d ? d.dates.at(-1) ?? '-' : '…')).join(',')}|${range}|${asOf}`
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stablePanes = useMemo(() => panes, [panesKey])

  const errors = [...gq, ...mq].filter((q) => q.error).map((q) => (q.error as Error).message)
  const loading = [...gq, ...mq].some((q) => q.isLoading)

  if (!items.length)
    return (
      <p className="text-xs text-ink-3">
        Fija valores, sectores o industrias con el botón de chincheta de cualquier tabla para ver su percentil a lo largo del tiempo en un mismo gráfico (hasta 8).
      </p>
    )

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <ul className="flex flex-wrap gap-1.5">
          {items.map((i) => (
            <li key={`${i.universe}-${i.kind}-${i.code}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 py-0.5 pl-2 pr-1 text-xs text-ink-2">
              <span className="h-2 w-2 rounded-full" style={{ background: seriesColor(i.slot) }} aria-hidden />
              <span className="font-medium text-ink">{i.label}</span>
              <span className="text-[10px] text-ink-3">
                {i.kind === 'member' ? 'valor' : i.kind === 'sector' ? 'sector' : 'industria'}
                {multiUniverse && ` · ${labels[i.universe] ?? i.universe}`}
              </span>
              <button onClick={() => toggleCompare(i)} aria-label={`Quitar ${i.label}`} className="rounded-full p-0.5 text-ink-3 hover:bg-surface-3 hover:text-ink-2">
                <X size={11} />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <Segmented size="sm" label="Rango" value={range} options={RANGES} onChange={setRange} />
          <button onClick={clearCompare} className="text-xs text-ink-3 hover:text-ink-2">Vaciar</button>
        </div>
      </div>
      {stablePanes.length ? <TimeChart panes={stablePanes} height={320} rangeKey={`compare-${range}-${asOf}`} /> : loading ? <Skeleton className="h-[320px]" /> : null}
      <Warnings
        items={[
          ...errors,
          ...(multiUniverse ? ['Percentiles de universos distintos: cada uno se mide contra su propio índice y sus propios miembros.'] : []),
        ]}
        className="mt-3"
      />
    </div>
  )
}
