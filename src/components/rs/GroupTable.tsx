import clsx from 'clsx'
import { useState } from 'react'
import { fmtNum, fmtSigned } from '../../lib/format'
import type { RsGroup, RsLensRef } from '../../lib/types'
import { Delta } from '../ui'
import { fmtPp, sortBy, type Sort } from '../../lib/rs'
import { ParticipationBar, PctCell, PinButton, SortTh } from './parts'

type Key = 'name' | 'n' | `mean:${string}` | 'net' | 'delta' | 'beating' | 'excess'

/**
 * The groups of the current level (sectors of a universe, industries of a
 * sector): where each sits in the universe ranking under every horizon, and
 * how broadly its members carry that strength.
 */
export function GroupTable({
  universe,
  groups,
  lenses,
  lens,
  deltaLabel,
  leader,
  laggard,
  onOpen,
}: {
  universe: string
  groups: RsGroup[]
  lenses: RsLensRef[]
  lens: string
  deltaLabel: string
  leader: number
  laggard: number
  onOpen: (g: RsGroup) => void
}) {
  const [sort, setSort] = useState<Sort<Key>>({ key: `mean:${lens}`, dir: 'desc' })
  const get = (g: RsGroup) => {
    const l = g.lenses[lens]
    if (sort.key.startsWith('mean:')) return g.lenses[sort.key.slice(5)]?.mean_percentile
    switch (sort.key) {
      case 'name': return g.name
      case 'n': return g.n_members
      case 'net': return l?.net_participation
      case 'delta': return l?.mean_delta
      case 'beating': return l?.pct_beating
      case 'excess': return l?.median_excess
    }
    return null
  }
  const rows = sortBy(groups, get, sort.dir)
  const lensLabel = lenses.find((l) => l.key === lens)?.label ?? lens

  return (
    <div className="scroll-thin overflow-x-auto">
      <table className="w-full min-w-[920px] text-[13px]">
        <thead>
          <tr className="text-[11px] text-ink-3">
            <SortTh k="name" sort={sort} onSort={setSort} align="left" className="pl-4">Grupo</SortTh>
            <SortTh k="n" sort={sort} onSort={setSort} title="Valores con percentil en esta barra">Valores</SortTh>
            {lenses.map((l) => (
              <SortTh key={l.key} k={`mean:${l.key}`} sort={sort} onSort={setSort} title={`Percentil medio de sus valores en el universo · ${l.description}`}>
                <span className={clsx(l.key === lens && 'text-ink')}>RS {l.label}</span>
              </SortTh>
            ))}
            <th className="px-3 py-2 text-center font-medium" title={`Líderes: percentil ≥ ${leader}; rezagados: ≤ ${laggard} (${lensLabel})`}>
              <span className="inline-flex items-center gap-3">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-down" />rezagados</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-up" />líderes</span>
              </span>
            </th>
            <SortTh k="net" sort={sort} onSort={setSort} title="Líderes menos rezagados, en puntos porcentuales">Neto</SortTh>
            <SortTh k="delta" sort={sort} onSort={setSort} title={`Cambio medio del percentil de sus valores en ${deltaLabel}`}>Δ {deltaLabel}</SortTh>
            <SortTh k="beating" sort={sort} onSort={setSort} title={`Porcentaje de sus valores con rentabilidad ${lensLabel} mejor que la del índice`}>Baten al índice</SortTh>
            <SortTh k="excess" sort={sort} onSort={setSort} title={`Exceso mediano sobre el índice a ${lensLabel}, en puntos porcentuales (mediana: un valor extremo no la mueve)`} className="pr-2">Exceso mediano</SortTh>
            <th className="w-8 pr-3" aria-label="Comparar" />
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => {
            const l = g.lenses[lens]
            return (
              <tr key={g.code} onClick={() => onOpen(g)} className="cursor-pointer border-t border-line hover:bg-surface-2">
                <td className="py-2 pl-4 pr-2 font-medium text-ink">{g.name}</td>
                <td
                  className={clsx('num px-2 py-2 text-right', g.n_members < 5 ? 'text-warn' : 'text-ink-2')}
                  title={g.n_members < 5 ? 'Menos de 5 valores: sus porcentajes se mueven a saltos' : undefined}
                >
                  {g.n_members}
                </td>
                {lenses.map((ln) => (
                  <td key={ln.key} className="px-2 py-1.5 text-right">
                    <PctCell value={g.lenses[ln.key]?.mean_percentile} />
                  </td>
                ))}
                <td className="px-3 py-2">{l ? <ParticipationBar leaders={l.pct_leaders} laggards={l.pct_laggards} /> : null}</td>
                <td className="num px-2 py-2 text-right text-ink">{fmtSigned(l?.net_participation, 0, ' pp')}</td>
                <td className="px-2 py-2 text-right">
                  <Delta value={l?.mean_delta} text={fmtSigned(l?.mean_delta, 1)} className="text-xs" />
                </td>
                <td className="num px-2 py-2 text-right text-ink-2">{l?.pct_beating == null ? '—' : `${fmtNum(l.pct_beating, 0)}%`}</td>
                <td className="num px-2 py-2 text-right text-ink-2">{fmtPp(l?.median_excess)}</td>
                <td className="py-2 pr-3">
                  <PinButton item={{ universe, kind: g.scope, code: g.code, label: g.name }} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
