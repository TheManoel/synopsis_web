import clsx from 'clsx'
import { ArrowDown, ArrowUp, ChevronRight, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DASH, fmtDate, fmtLevel, fmtNum, fmtPct } from '../../lib/format'
import type { Scale, ScreenHit, UniverseScreen } from '../../lib/types'
import { Card, InfoTip, Pill, Warnings } from '../ui'
import { Signed } from './BacktestResults'

/** The screen of a universe: the members whose entry rule holds now. Every
 *  figure is the core's; the page only orders, filters and formats. */

const fmtScale = (v: number | null, scale: Scale) =>
  v == null ? DASH : scale === 'price' ? fmtLevel(v) : scale === 'percent' ? fmtPct(v, 1) : fmtNum(v, 1)

function since(h: ScreenHit): string {
  if (h.sessions_since === 0) return 'última sesión'
  return `hace ${h.sessions_since} ${h.sessions_since === 1 ? 'sesión' : 'sesiones'}`
}

type SortKey = 'signal' | 'ticker' | 'run' | 'change' | `v${number}`

export function UniverseScreenResults({ r, stale, onOpenSymbol }: { r: UniverseScreen; stale: boolean; onOpenSymbol: (h: ScreenHit) => void }) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'signal', desc: false })
  const [query, setQuery] = useState('')
  const [onlyNew, setOnlyNew] = useState(false)
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    let out = r.hits.filter((h) => !onlyNew || h.run_length === 1)
    if (q) out = out.filter((h) => [h.ticker, h.name, h.sector, h.industry].some((x) => x.toLowerCase().includes(q)))
    if (sort.key === 'signal') return sort.desc ? [...out].reverse() : out // the core's order: freshest, then the run just starting
    const pick = (h: ScreenHit): number | string | null =>
      sort.key === 'ticker' ? h.ticker : sort.key === 'run' ? h.run_length : sort.key === 'change' ? h.change_pct : h.values[Number(sort.key.slice(1))]
    return [...out].sort((a, b) => {
      const x = pick(a)
      const y = pick(b)
      if (x == null && y == null) return 0
      if (x == null) return 1
      if (y == null) return -1
      const c = x < y ? -1 : x > y ? 1 : 0
      return sort.desc ? -c : c
    })
  }, [r.hits, sort, query, onlyNew])
  const head = (key: SortKey, label: string, title?: string, align: 'left' | 'right' = 'right') => (
    <th className={clsx('whitespace-nowrap px-2 py-2 font-medium', align === 'left' ? 'text-left' : 'text-right')} title={title}>
      <button
        type="button"
        onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== 'ticker' && key !== 'signal' }))}
        className={clsx('inline-flex items-center gap-0.5 hover:text-ink', sort.key === key && 'text-ink')}
      >
        {label}
        {sort.key === key && (sort.desc ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
      </button>
    </th>
  )
  // The strategy's own close is the Cierre column already.
  const cols = r.series
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => {
      const def = r.rules.series.find((x) => x.id === s.id)
      return !(def?.kind === 'price' && def.params.field === 'close')
    })
  const c = r.coverage
  const fresh = r.hits.filter((h) => h.run_length === 1).length
  return (
    <div className={clsx('min-w-0 space-y-4', stale && 'is-stale')}>
      <div className="card px-4 py-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-[15px] font-semibold text-ink">
            {r.strategy_label} <span className="text-ink-3">·</span> {r.universe_label}
            {r.selection_label && <span className="text-ink-2"> · {r.selection_label}</span>}
          </h2>
          <span className="num text-xs text-ink-3">
            {r.as_of ? `Sesión del ${fmtDate(r.as_of)}` : DASH} · {fmtNum(c.listed, 0)} valores · {fmtNum(r.elapsed_s, 0)} s
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-2">
          <span><span className="text-ink-3">Entrada:</span> {r.entry_text}</span>
          <span><span className="text-ink-3">Salida:</span> {r.exit_text}</span>
          <span><span className="text-ink-3">Precios:</span> {r.live ? 'guardados + actual de Yahoo (diferido)' : 'guardados'}</span>
        </div>
      </div>
      <Warnings items={r.warnings} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Con señal', value: fmtNum(c.hits, 0), hint: r.lookback === 1 ? 'La regla de entrada se cumple en la última sesión.' : `La regla de entrada se cumplió en alguna de las últimas ${r.lookback} sesiones.` },
          { label: 'Señal nueva', value: fmtNum(fresh, 0), hint: 'Racha de 1: la regla no se cumplía la sesión anterior.' },
          { label: 'Valores leídos', value: `${fmtNum(c.evaluated, 0)} de ${fmtNum(c.listed, 0)}`, hint: `Miembros hoy: ${c.listed}. Datos parados: ${c.stale}. Sin histórico suficiente: ${c.not_warm}. Sin precios: ${c.no_bars}.` },
          { label: 'Con sesión provisional', value: fmtNum(c.provisional, 0), hint: 'Valores cuya última sesión es de Yahoo y aún no está en la base: con el mercado abierto, su señal puede cambiar al cierre.' },
        ].map((k) => (
          <div key={k.label} className="card px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs text-ink-3">
              {k.label}
              <InfoTip text={k.hint} />
            </div>
            <div className="num mt-1 text-[22px] font-semibold tracking-tight">{k.value}</div>
          </div>
        ))}
      </div>
      <Card
        title="Señales"
        subtitle="La más reciente primero y, dentro, las que acaban de empezar. Pulsa una fila para abrir su backtest con el gráfico."
        actions={
          <>
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-ink-2">
              <input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} className="accent-[var(--accent)]" />
              Solo nuevas
            </label>
            <label className="relative">
              <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
              <input
                className="h-7 w-44 rounded-lg border border-line bg-surface-2 pl-7 pr-2 text-xs text-ink outline-none focus:border-accent"
                placeholder="Buscar valor, sector…"
                aria-label="Buscar valor"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </>
        }
        bodyClassName="p-0"
      >
        {rows.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-ink-3">{r.hits.length ? 'Ninguna señal coincide con el filtro.' : 'Ningún valor da señal de entrada.'}</p>
        ) : (
          <div className="scroll-thin max-h-[640px] overflow-auto">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-surface">
                <tr className="text-[11px] text-ink-3">
                  <th className="w-0 py-2 pl-4" aria-hidden />
                  {head('ticker', 'Valor', undefined, 'left')}
                  {head('signal', 'Señal', 'Última sesión en que se cumplió la regla de entrada', 'left')}
                  {head('run', 'Racha', 'Sesiones seguidas cumpliéndose (1 = nueva)')}
                  <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Cierre</th>
                  {head('change', 'Día', 'Variación del último cierre sobre el anterior')}
                  {cols.map(({ s, i }) => (
                    <th key={s.id} className="px-2 py-2 text-right font-medium">
                      <button
                        type="button"
                        onClick={() => setSort((x) => ({ key: `v${i}`, desc: x.key === `v${i}` ? !x.desc : true }))}
                        className={clsx('inline-flex items-center gap-0.5 whitespace-nowrap hover:text-ink', sort.key === `v${i}` && 'text-ink')}
                        title={`${s.label}, en la última sesión`}
                      >
                        {s.label}
                        {sort.key === `v${i}` && (sort.desc ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
                      </button>
                    </th>
                  ))}
                  <th className="w-0 py-2 pr-3" aria-hidden />
                </tr>
              </thead>
              <tbody className="num">
                {rows.map((h) => (
                  <tr key={h.key} onClick={() => onOpenSymbol(h)} className="group cursor-pointer border-t border-line hover:bg-surface-2">
                    <td className="py-1.5 pl-4" />
                    <td className="max-w-[220px] px-2 py-1.5">
                      <div className="flex items-baseline gap-1.5 whitespace-nowrap" title={`${h.name} · ${h.sector} · ${h.industry}`}>
                        <span className="font-medium text-ink">{h.ticker}</span>
                        <span className="truncate text-xs text-ink-3">{h.name}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-ink-2" title={fmtDate(h.signal_date)}>
                      {since(h)}
                      {h.exit_now && (
                        <span className="ml-1.5" title="La regla de salida también se cumple en la última sesión">
                          <Pill tone="neutral">salida</Pill>
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {h.run_length === 1 ? <Pill tone="accent">nueva</Pill> : <span className="text-ink-2">{h.run_length}</span>}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right text-ink" title={`Sesión del ${fmtDate(h.last_date)}${h.provisional ? ' (provisional, de Yahoo)' : ''}`}>
                      {fmtLevel(h.last_close)}
                      {h.provisional && <span className="ml-1 text-[10px] text-warn">●</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <Signed v={h.change_pct} />
                    </td>
                    {cols.map(({ s, i }) => (
                      <td key={s.id} className="px-2 py-1.5 text-right text-ink-2">
                        {fmtScale(h.values[i], s.scale)}
                      </td>
                    ))}
                    <td className="py-1.5 pr-3 text-right text-ink-3 opacity-0 group-hover:opacity-100">
                      <ChevronRight size={14} aria-hidden />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card title="Cómo se lee">
        <ul className="space-y-1.5 text-xs leading-relaxed text-ink-2">
          {r.conventions.map((x) => (
            <li key={x}>· {x}</li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
