import clsx from 'clsx'
import { CandlestickChart, Search } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { fmtDate, fmtPct, fmtSigned } from '../../lib/format'
import type { RsLensRef, RsMember, RsShortHorizon } from '../../lib/types'
import { Delta, Segmented } from '../ui'
import { fmtFromHigh, fmtPp, sortBy, type Sort } from '../../lib/rs'
import { PctCell, PinButton, SortTh } from './parts'
import { PricePreview } from './PricePreview'

type Key = 'name' | `pct:${string}` | `short:${string}` | 'delta' | 'within' | 'excess' | 'dd' | 'ddrs'
type Band = 'all' | 'leaders' | 'laggards'
const PAGE = 50

/**
 * The members of the current level, ranked against the whole universe. The
 * three horizons side by side are the reading: a strong 12M with a weak 1M, or
 * the reverse, is the information, not noise. The distances below the 52-week
 * high of the price and of the RS line separate an intact leader from one that
 * leads the ranking for what it did months ago. The 1W/2W returns (and their
 * excess over the index, in the tooltip) say what the member did lately; each
 * row can unfold a price preview right below it.
 */
export function MemberTable({
  universe,
  members,
  lenses,
  lens,
  shortHorizons,
  benchmark,
  pastBar,
  deltaLabel,
  within,
  industryName,
  showIndustry,
  leader,
  laggard,
  selected,
  onOpen,
  onOpenIndustry,
}: {
  universe: string
  members: RsMember[]
  lenses: RsLensRef[]
  lens: string
  shortHorizons: RsShortHorizon[]
  benchmark: string | null
  /** The board's bar when it is not the latest (marked on the preview). */
  pastBar: string | null
  deltaLabel: string
  within: 'sector' | 'industry'
  industryName: (code: string | null) => string
  showIndustry: boolean
  leader: number
  laggard: number
  selected: string | null
  onOpen: (m: RsMember) => void
  onOpenIndustry: (code: string) => void
}) {
  const [sort, setSort] = useState<Sort<Key>>({ key: `pct:${lens}`, dir: 'desc' })
  const [band, setBand] = useState<Band>('all')
  const [text, setText] = useState('')
  const [all, setAll] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase()
    return members.filter((m) => {
      const p = m.percentile[lens]
      if (band === 'leaders' && !(p != null && p >= leader)) return false
      if (band === 'laggards' && !(p != null && p <= laggard)) return false
      return !q || m.ticker.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
    })
  }, [members, lens, band, text, leader, laggard])

  const rows = useMemo(() => {
    const w = within === 'industry' ? 'within_industry' : 'within_sector'
    const get = (m: RsMember) => {
      if (sort.key.startsWith('pct:')) return m.percentile[sort.key.slice(4)]
      if (sort.key.startsWith('short:')) return m.short_ret?.[sort.key.slice(6)]
      switch (sort.key) {
        case 'name': return m.ticker
        case 'delta': return m.delta[lens]
        case 'within': return m[w][lens]
        case 'excess': return m.excess[lens]
        case 'dd': return m.price_from_high
        case 'ddrs': return m.rs_line_from_high
      }
      return null
    }
    return sortBy(filtered, get, sort.dir)
  }, [filtered, sort, lens, within])

  const shown = all ? rows : rows.slice(0, PAGE)
  const lensLabel = lenses.find((l) => l.key === lens)?.label ?? lens
  const bench = benchmark ?? 'el índice'
  const columns = 9 + (showIndustry ? 1 : 0) + lenses.length + shortHorizons.length

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
        <label className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs text-ink-3">
          <Search size={13} aria-hidden />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Filtrar por ticker o nombre"
            className="w-44 bg-transparent text-ink outline-none placeholder:text-ink-3"
          />
        </label>
        <Segmented
          size="sm"
          label="Filtrar por percentil"
          value={band}
          onChange={setBand}
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'leaders', label: `Líderes ≥ ${leader}`, hint: `Percentil ${lensLabel} ≥ ${leader}` },
            { value: 'laggards', label: `Rezagados ≤ ${laggard}`, hint: `Percentil ${lensLabel} ≤ ${laggard}` },
          ]}
        />
        <span className="text-[11px] text-ink-3">{filtered.length} de {members.length} valores</span>
      </div>
      <div className="scroll-thin max-h-[640px] overflow-auto">
        <table className="w-full min-w-[1120px] text-[13px]">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="text-[11px] text-ink-3">
              <th className="w-10 py-2 pl-4 text-right font-medium">#</th>
              <SortTh k="name" sort={sort} onSort={setSort} align="left">Valor</SortTh>
              {showIndustry && <th className="px-2 py-2 text-left font-medium">Industria</th>}
              {lenses.map((l) => (
                <SortTh key={l.key} k={`pct:${l.key}`} sort={sort} onSort={setSort} title={`Percentil en el universo · ${l.description}`}>
                  <span className={clsx(l.key === lens && 'text-ink')}>RS {l.label}</span>
                </SortTh>
              ))}
              <SortTh k="delta" sort={sort} onSort={setSort} title={`Cambio del percentil ${lensLabel} en ${deltaLabel}`}>Δ {deltaLabel}</SortTh>
              <SortTh
                k="within"
                sort={sort}
                onSort={setSort}
                title={`Percentil ${lensLabel} solo entre los valores de su ${within === 'industry' ? 'industria' : 'sector'}: refina, no sustituye al del universo`}
              >
                En su {within === 'industry' ? 'industria' : 'sector'}
              </SortTh>
              <SortTh k="excess" sort={sort} onSort={setSort} title={`Rentabilidad ${lensLabel} menos la del índice, en puntos porcentuales`}>Exceso {lensLabel}</SortTh>
              {shortHorizons.map((h) => (
                <SortTh
                  key={h.key}
                  k={`short:${h.key}`}
                  sort={sort}
                  onSort={setSort}
                  title={
                    `Rentabilidad de las últimas ${h.bars} sesiones` +
                    (h.start ? ` (desde el cierre del ${fmtDate(h.start)})` : '') +
                    (h.benchmark_return != null ? `; ${bench}: ${fmtPct(h.benchmark_return, 1)}` : '') +
                    '. El exceso sobre el índice, al pasar el cursor por la cifra.'
                  }
                >
                  Rent. {h.key}
                </SortTh>
              ))}
              <SortTh k="dd" sort={sort} onSort={setSort} title="Distancia del precio a su máximo de 52 semanas">Precio vs máx.</SortTh>
              <SortTh k="ddrs" sort={sort} onSort={setSort} title="Distancia de la línea de fuerza relativa (precio / índice) a su máximo de 52 semanas: si sigue batiendo al índice">
                Línea RS vs máx.
              </SortTh>
              <th className="w-8" aria-label="Vista previa del precio" />
              <th className="w-8 pr-3" aria-label="Comparar" />
            </tr>
          </thead>
          <tbody>
            {shown.map((m, i) => (
              <Fragment key={m.key}>
              <tr
                onClick={() => onOpen(m)}
                className={clsx('cursor-pointer border-t border-line hover:bg-surface-2', m.key === selected && 'bg-accent-soft')}
              >
                <td className="num py-2 pl-4 text-right text-[11px] text-ink-3">{i + 1}</td>
                <td className="px-2 py-2">
                  <div className="flex max-w-[260px] items-baseline gap-2">
                    <span className="font-semibold text-ink">{m.ticker}</span>
                    <span className="truncate text-[11px] text-ink-3" title={m.name}>{m.name}</span>
                  </div>
                </td>
                {showIndustry && (
                  <td className="max-w-[210px] truncate px-2 py-2 text-xs text-ink-2" title={m.industry_code ? industryName(m.industry_code) : undefined}>
                    {m.industry_code ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpenIndustry(m.industry_code!)
                        }}
                        className="truncate hover:text-ink hover:underline"
                      >
                        {industryName(m.industry_code)}
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                )}
                {lenses.map((l) => (
                  <td key={l.key} className="px-2 py-1.5 text-right">
                    <PctCell value={m.percentile[l.key]} />
                  </td>
                ))}
                <td className="px-2 py-2 text-right">
                  <Delta value={m.delta[lens]} text={fmtSigned(m.delta[lens], 0)} className="text-xs" />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <PctCell value={(within === 'industry' ? m.within_industry : m.within_sector)[lens]} />
                </td>
                <td className="num whitespace-nowrap px-2 py-2 text-right text-ink-2">{fmtPp(m.excess[lens])}</td>
                {shortHorizons.map((h) => {
                  const r = m.short_ret?.[h.key]
                  const x = m.short_excess?.[h.key]
                  return (
                    <td key={h.key} className="whitespace-nowrap px-2 py-2 text-right" title={x != null ? `Exceso sobre ${bench}: ${fmtPp(x)}` : 'Sin cierre en la ventana: ver avisos'}>
                      <Delta value={r} text={fmtPct(r, 1)} className="text-xs" />
                    </td>
                  )
                })}
                <td className="num px-2 py-2 text-right text-ink-2">{fmtFromHigh(m.price_from_high)}</td>
                <td className="num px-2 py-2 text-right text-ink-2">{fmtFromHigh(m.rs_line_from_high)}</td>
                <td className="py-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setPreview((p) => (p === m.key ? null : m.key))
                    }}
                    title={preview === m.key ? 'Ocultar el gráfico' : 'Ver el gráfico de precio debajo de la fila'}
                    aria-label={preview === m.key ? `Ocultar el gráfico de ${m.ticker}` : `Ver el gráfico de ${m.ticker}`}
                    aria-expanded={preview === m.key}
                    className={clsx(
                      'inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors',
                      preview === m.key ? 'bg-accent-soft text-accent' : 'text-ink-3 hover:bg-surface-3 hover:text-ink-2',
                    )}
                  >
                    <CandlestickChart size={13} />
                  </button>
                </td>
                <td className="py-2 pr-3">
                  <PinButton item={{ universe, kind: 'member', code: m.key, label: m.ticker }} />
                </td>
              </tr>
              {preview === m.key && (
                <tr>
                  <td colSpan={columns} className="p-0">
                    <PricePreview symbolKey={m.key} label={`${m.ticker} · ${m.name}`} barDate={pastBar} />
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > PAGE && (
        <div className="px-4 pt-3">
          <button onClick={() => setAll((v) => !v)} className="text-xs font-medium text-accent hover:underline">
            {all ? `Mostrar los ${PAGE} primeros` : `Mostrar los ${rows.length}`}
          </button>
        </div>
      )}
    </div>
  )
}
