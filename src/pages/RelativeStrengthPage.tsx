import clsx from 'clsx'
import { CalendarClock, ChevronRight, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { GroupTable } from '../components/rs/GroupTable'
import { Heatmap } from '../components/rs/Heatmap'
import { HorizonScatter } from '../components/rs/HorizonScatter'
import { MemberTable } from '../components/rs/MemberTable'
import { HeatLegend } from '../components/rs/parts'
import { ComparePanel, GroupHistory, MemberDetail } from '../components/rs/RsCharts'
import { fmtPp, RS_RANGES as RANGES } from '../lib/rs'
import { SymbolSearch } from '../components/symbols/SymbolSearch'
import { Card, ErrorState, InfoTip, PageHeader, Pill, Segmented, Skeleton, Stat, Warnings } from '../components/ui'
import { useRsBoard, useRsHeatmap, useRsUniverses } from '../lib/api'
import { fmtDate, fmtNum, fmtSigned } from '../lib/format'
import type { RsBoard, RsGroup, RsMember, RsScope } from '../lib/types'

const HEAT_WEEKS = [
  { value: 26, label: '6M' },
  { value: 52, label: '1A' },
  { value: 104, label: '2A' },
  { value: 260, label: '5A' },
]

/** Fallbacks until /rs/universes answers (the core is the source of these). */
const DEFAULT_DELTAS = [
  { bars: 5, label: '1S' },
  { bars: 21, label: '1M' },
  { bars: 63, label: '3M' },
]

function Breadcrumb({ items }: { items: { label: string; onClick?: () => void }[] }) {
  return (
    <nav aria-label="Nivel" className="flex flex-wrap items-center gap-1 text-sm">
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <ChevronRight size={14} className="text-ink-3" aria-hidden />}
          {it.onClick ? (
            <button onClick={it.onClick} className="rounded-md px-1.5 py-0.5 text-ink-2 hover:bg-surface-2 hover:text-ink">
              {it.label}
            </button>
          ) : (
            <span className="px-1.5 py-0.5 font-semibold text-ink">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

function UniverseStats({ board, lens, lensLabel }: { board: RsBoard; lens: string; lensLabel: string }) {
  const s = board.summary[lens]
  const top = (groups: RsGroup[]) =>
    [...groups].filter((g) => g.lenses[lens] && g.n_members >= 5).sort((a, b) => b.lenses[lens].net_participation - a.lenses[lens].net_participation)[0]
  const sec = top(board.sectors)
  const ind = top(board.industries)
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat
        label={`Baten al índice (${lensLabel})`}
        hint={`Porcentaje de valores con rentabilidad ${lensLabel} mejor que la del ${board.benchmark ?? 'índice'}. Por debajo del 50%, el índice lo sostienen unos pocos.`}
        value={s?.pct_beating == null ? '—' : `${fmtNum(s.pct_beating, 0)}%`}
        sub={s ? `Exceso mediano ${fmtPp(s.median_excess)} · rentabilidad mediana ${fmtSigned(s.median_return, 1, '%')}` : undefined}
      />
      <Stat
        label="Sector con más participación"
        hint="Mayor diferencia entre líderes y rezagados (sectores con 5 valores o más)"
        value={sec?.name ?? '—'}
        sub={sec ? `Neto ${fmtSigned(sec.lenses[lens].net_participation, 0, ' pp')} · ${fmtNum(sec.lenses[lens].pct_leaders, 0)}% líderes` : undefined}
      />
      <Stat
        label="Industria con más participación"
        hint="Mayor diferencia entre líderes y rezagados (industrias con 5 valores o más)"
        value={<span className="text-[18px]">{ind?.name ?? '—'}</span>}
        sub={ind ? `Neto ${fmtSigned(ind.lenses[lens].net_participation, 0, ' pp')} · ${ind.n_members} valores` : undefined}
      />
      <Stat
        label="Valores con percentil"
        hint="Miembros con historia suficiente para la lente: el percentil se calcula solo entre ellos"
        value={`${board.n_ranked[lens] ?? '—'} / ${board.n_members}`}
        sub={`Barra del ${fmtDate(board.bar_date)}`}
      />
    </div>
  )
}

function GroupStats({ group, lens, lensLabel, deltaLabel, benchmark }: { group: RsGroup; lens: string; lensLabel: string; deltaLabel: string; benchmark: string | null }) {
  const l = group.lenses[lens]
  if (!l) return null
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat
        label={`RS medio ${lensLabel}`}
        hint="Percentil medio de sus valores en el ranking del universo (50 = en la media)"
        value={fmtNum(l.mean_percentile, 0)}
        sub={`${fmtSigned(l.mean_delta, 1)} en ${deltaLabel}`}
      />
      <Stat
        label="Líderes / rezagados"
        value={`${fmtNum(l.pct_leaders, 0)}% / ${fmtNum(l.pct_laggards, 0)}%`}
        sub={`Neto ${fmtSigned(l.net_participation, 0, ' pp')}`}
      />
      <Stat
        label={`Baten al índice (${lensLabel})`}
        hint={`Valores con rentabilidad ${lensLabel} mejor que la del ${benchmark ?? 'índice'}`}
        value={l.pct_beating == null ? '—' : `${fmtNum(l.pct_beating, 0)}%`}
        sub={`Exceso mediano ${fmtPp(l.median_excess)}`}
      />
      <Stat
        label="Valores"
        value={group.n_members}
        sub={group.n_members < 5 ? 'Pocos valores: los porcentajes se mueven a saltos' : 'Con percentil en esta barra'}
        emphasis={group.n_members < 5 ? 'warn' : undefined}
      />
    </div>
  )
}

export function RelativeStrengthPage() {
  const [params, setParams] = useSearchParams()
  const universes = useRsUniverses()
  const u = params.get('u') ?? 'SPX500'
  const lens = params.get('lens') ?? 'rs_12m'
  const delta = Number(params.get('d') ?? 21)
  const asOf = params.get('date')
  const sector = params.get('sector')
  const industry = params.get('industry')
  const sym = params.get('sym')
  const range = params.get('range') ?? '2y'
  const [heatWeeks, setHeatWeeks] = useState(52)
  const [yLens, setYLens] = useState('rs_1m')
  const detailRef = useRef<HTMLDivElement>(null)

  const q = useRsBoard(u, asOf, delta)
  const board = q.data
  const meta = universes.data?.find((x) => x.code === u)
  const lenses = board?.lenses ?? meta?.lenses ?? []
  const lensLabel = lenses.find((l) => l.key === lens)?.label ?? lens
  const deltas = meta?.deltas ?? DEFAULT_DELTAS
  const deltaLabel = deltas.find((d) => d.bars === delta)?.label ?? `${delta} ses.`

  const update = (patch: Record<string, string | null>) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        for (const [k, v] of Object.entries(patch)) {
          if (v == null) n.delete(k)
          else n.set(k, v)
        }
        return n
      },
      { replace: true },
    )

  const sectorsBy = useMemo(() => new Map((board?.sectors ?? []).map((g) => [g.code, g])), [board])
  const industriesBy = useMemo(() => new Map((board?.industries ?? []).map((g) => [g.code, g])), [board])
  const industryGroup = industry ? industriesBy.get(industry) ?? null : null
  const sectorCode = sector ?? industryGroup?.sector_code ?? null
  const sectorGroup = sectorCode ? sectorsBy.get(sectorCode) ?? null : null
  const level: 'universe' | RsScope = industry ? 'industry' : sectorCode ? 'sector' : 'universe'
  const focus = level === 'industry' ? industryGroup : level === 'sector' ? sectorGroup : null

  const scopeMembers = useMemo(() => {
    const all = board?.members ?? []
    if (level === 'industry') return all.filter((m) => m.industry_code === industry)
    if (level === 'sector') return all.filter((m) => m.sector_code === sectorCode)
    return all
  }, [board, level, industry, sectorCode])
  const inScope = useMemo(() => (level === 'universe' ? null : new Set(scopeMembers.map((m) => m.key))), [level, scopeMembers])
  const children = level === 'universe' ? board?.sectors ?? [] : level === 'sector' ? (board?.industries ?? []).filter((g) => g.sector_code === sectorCode) : []
  const heat = useRsHeatmap(u, level === 'universe' ? 'sector' : 'industry', level === 'sector' ? sectorCode : null, lens, heatWeeks, asOf)
  const selectedRow = sym ? board?.members.find((m) => m.key === sym) ?? null : null

  useEffect(() => {
    if (sym) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [sym])

  const openMember = (m: RsMember | { key: string }) => update({ sym: m.key })
  const openGroup = (scope: RsScope, code: string, parent?: string | null) =>
    scope === 'sector' ? update({ sector: code, industry: null }) : update({ sector: parent ?? industriesBy.get(code)?.sector_code ?? sectorCode, industry: code })

  const universeLabel = board?.universe_label ?? meta?.label ?? u
  const crumbs = [
    { label: universeLabel, onClick: level !== 'universe' ? () => update({ sector: null, industry: null }) : undefined },
    ...(sectorCode ? [{ label: sectorGroup?.name ?? sectorCode, onClick: level === 'industry' ? () => update({ industry: null }) : undefined }] : []),
    ...(industry ? [{ label: industryGroup?.name ?? industry }] : []),
  ]
  const labels = Object.fromEntries((universes.data ?? []).map((x) => [x.code, x.label]))
  const lastBar = meta?.last_bar
  const viewingPast = !!board && !!lastBar && board.bar_date < lastBar

  return (
    <div>
      <PageHeader
        eyebrow="Análisis"
        title="Fuerza relativa"
        subtitle="Dónde está la fuerza (sectores, industrias y valores), cómo de ancha es y desde cuándo. Percentiles contra todo el índice, leídos del histórico guardado."
      >
        {board && (
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-3">
            {viewingPast ? <Pill tone="accent"><CalendarClock size={11} aria-hidden /> Viendo el {fmtDate(board.bar_date)}</Pill> : <>Barra del {fmtDate(board.bar_date)}</>}
            {!viewingPast && meta?.lag_sessions ? <Pill tone="warn">{meta.lag_sessions} sesiones sin rankear</Pill> : null}
          </span>
        )}
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented
          label="Índice"
          value={u}
          options={(universes.data ?? [{ code: 'SPX500', label: 'S&P 500' }, { code: 'EUROSTOXX600', label: 'STOXX 600' }]).map((x) => ({ value: x.code, label: x.label }))}
          onChange={(v) => update({ u: v, sym: null })}
        />
        <Segmented
          label="Horizonte"
          value={lens}
          options={lenses.map((l) => ({ value: l.key, label: l.label, hint: l.description }))}
          onChange={(v) => update({ lens: v === 'rs_12m' ? null : v })}
        />
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-3">
          Cambio
          <Segmented size="sm" label="Ventana del cambio" value={delta} options={deltas.map((d) => ({ value: d.bars, label: d.label, hint: `${d.bars} sesiones` }))} onChange={(v) => update({ d: v === 21 ? null : String(v) })} />
        </span>
        <label className="inline-flex items-center gap-1.5 rounded-[10px] border border-line bg-surface-2 px-2 py-1 text-xs text-ink-3">
          Fecha
          <input
            type="date"
            value={asOf ?? lastBar ?? ''}
            min={meta?.first_bar}
            max={lastBar}
            onChange={(e) => update({ date: e.target.value && e.target.value < (lastBar ?? '9999') ? e.target.value : null })}
            className="num bg-transparent text-ink outline-none [color-scheme:inherit]"
            aria-label="Fecha de la barra (viaja al pasado del histórico)"
          />
          {asOf && (
            <button onClick={() => update({ date: null })} className="rounded p-0.5 hover:text-ink-2" title="Volver a la última barra" aria-label="Volver a la última barra">
              <RotateCcw size={12} />
            </button>
          )}
        </label>
        <div className="relative ml-auto w-full sm:w-72">
          <SymbolSearch placeholder="Ver un valor concreto…" onPick={(h) => openMember({ key: h.key })} />
        </div>
      </div>

      {q.error ? (
        <ErrorState error={q.error} />
      ) : !board ? (
        <div className="space-y-4">
          <Skeleton className="h-[90px]" />
          <Skeleton className="h-[420px]" />
        </div>
      ) : (
        <div className={clsx('space-y-4', q.isPlaceholderData && 'is-stale')}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Breadcrumb items={crumbs} />
            <span className="text-[11px] text-ink-3">
              Líderes: percentil ≥ {board.leader_percentile} · rezagados: ≤ {board.laggard_percentile} · cambio frente al {fmtDate(board.delta_date)}
            </span>
          </div>
          <Warnings items={board.warnings} />

          {level === 'universe' ? (
            <UniverseStats board={board} lens={lens} lensLabel={lensLabel} />
          ) : focus ? (
            <GroupStats group={focus} lens={lens} lensLabel={lensLabel} deltaLabel={deltaLabel} benchmark={board.benchmark} />
          ) : (
            <Warnings items={[`Este grupo no tiene valores con percentil el ${fmtDate(board.bar_date)} en ${universeLabel}.`]} />
          )}

          {sym && (
            <div ref={detailRef} className="scroll-mt-4">
              <MemberDetail
                memberKey={sym}
                universe={u}
                row={selectedRow}
                groupSizes={{
                  sector: selectedRow?.sector_code ? sectorsBy.get(selectedRow.sector_code)?.n_members ?? null : null,
                  industry: selectedRow?.industry_code ? industriesBy.get(selectedRow.industry_code)?.n_members ?? null : null,
                }}
                lens={lens}
                lenses={lenses}
                deltaLabel={deltaLabel}
                range={range}
                asOf={asOf}
                onRange={(r) => update({ range: r === '2y' ? null : r })}
                onOpenGroup={openGroup}
                onClose={() => update({ sym: null })}
              />
            </div>
          )}

          {level !== 'universe' && focus && (
            <div className="grid gap-4 xl:grid-cols-12">
              <Card
                className="xl:col-span-7"
                title={`Historia de ${focus.name}`}
                subtitle="Percentil medio de sus valores en el universo y su participación, barra a barra del histórico"
                actions={<Segmented size="sm" label="Rango" value={range} options={RANGES} onChange={(r) => update({ range: r === '2y' ? null : r })} />}
              >
                <GroupHistory universe={u} scope={level} code={focus.code} lens={lens} lenses={lenses} range={range} asOf={asOf} />
              </Card>
              <Card
                className="xl:col-span-5"
                title={<span className="inline-flex items-center gap-1.5">Horizontes <InfoTip text="Cada punto es un valor del índice: a la derecha, fuerte a 12 meses; arriba, fuerte a corto. En color, los de este grupo. Líneas discontinuas: cortes de líder y rezagado." /></span>}
                subtitle={`${scopeMembers.length} valores de ${focus.name} sobre el resto del ${universeLabel}`}
                actions={<Segmented size="sm" label="Horizonte corto" value={yLens} options={lenses.filter((l) => l.key !== 'rs_12m').map((l) => ({ value: l.key, label: l.label }))} onChange={setYLens} />}
              >
                <HorizonScatter
                  members={board.members}
                  inScope={inScope}
                  xLens="rs_12m"
                  yLens={yLens}
                  xLabel={lenses.find((l) => l.key === 'rs_12m')?.label ?? '12M'}
                  yLabel={lenses.find((l) => l.key === yLens)?.label ?? yLens}
                  leader={board.leader_percentile}
                  laggard={board.laggard_percentile}
                  selected={sym}
                  onOpen={openMember}
                />
              </Card>
            </div>
          )}

          {children.length > 0 && (
            <Card
              title={level === 'universe' ? 'Sectores' : `Industrias de ${sectorGroup?.name ?? ''}`}
              subtitle={`Pulsa un grupo para entrar · horizonte activo ${lensLabel} (participación, cambio y exceso)`}
              bodyClassName="px-0 pb-2 pt-2"
            >
              <GroupTable
                universe={u}
                groups={children}
                lenses={lenses}
                lens={lens}
                deltaLabel={deltaLabel}
                leader={board.leader_percentile}
                laggard={board.laggard_percentile}
                onOpen={(g) => openGroup(g.scope, g.code, g.sector_code)}
              />
            </Card>
          )}

          {level !== 'industry' && (
            <div className={clsx('grid gap-4', level === 'universe' && 'xl:grid-cols-12')}>
              <Card
                className={level === 'universe' ? 'xl:col-span-7' : undefined}
                title={level === 'universe' ? 'Mapa de calor de los sectores' : `Mapa de calor de las industrias de ${sectorGroup?.name ?? ''}`}
                subtitle={`Percentil medio ${lensLabel} de cada grupo al cierre de cada semana`}
                actions={
                  <>
                    <HeatLegend />
                    <Segmented size="sm" label="Semanas" value={heatWeeks} options={HEAT_WEEKS} onChange={setHeatWeeks} />
                  </>
                }
              >
                {heat.error ? (
                  <ErrorState error={heat.error} />
                ) : !heat.data ? (
                  <Skeleton className="h-[260px]" />
                ) : (
                  <div className={heat.isPlaceholderData ? 'is-stale' : undefined}>
                    <Heatmap data={heat.data} onOpen={(code) => openGroup(level === 'universe' ? 'sector' : 'industry', code, sectorCode)} />
                    <Warnings items={heat.data.warnings.filter((w) => !board.warnings.includes(w))} className="mt-3" />
                  </div>
                )}
              </Card>
              {level === 'universe' && (
                <Card
                  className="xl:col-span-5"
                  title={<span className="inline-flex items-center gap-1.5">Horizontes <InfoTip text="Cada punto es un valor del índice: a la derecha, fuerte a 12 meses; arriba, fuerte a corto. Que discrepen es la lectura: un 12M fuerte con un 1M flojo es un líder que se está enfriando. Líneas discontinuas: cortes de líder y rezagado." /></span>}
                  subtitle={`${board.members.length} valores del ${universeLabel}`}
                  actions={<Segmented size="sm" label="Horizonte corto" value={yLens} options={lenses.filter((l) => l.key !== 'rs_12m').map((l) => ({ value: l.key, label: l.label }))} onChange={setYLens} />}
                >
                  <HorizonScatter
                    members={board.members}
                    inScope={null}
                    xLens="rs_12m"
                    yLens={yLens}
                    xLabel={lenses.find((l) => l.key === 'rs_12m')?.label ?? '12M'}
                    yLabel={lenses.find((l) => l.key === yLens)?.label ?? yLens}
                    leader={board.leader_percentile}
                    laggard={board.laggard_percentile}
                    selected={sym}
                    onOpen={openMember}
                  />
                </Card>
              )}
            </div>
          )}

          <Card
            title={level === 'universe' ? `Valores del ${universeLabel}` : `Valores de ${focus?.name ?? ''}`}
            subtitle={`Percentil contra todo el ${universeLabel}; «en su ${level === 'industry' ? 'industria' : 'sector'}» solo contra su grupo`}
            bodyClassName="px-0 pb-3 pt-2"
          >
            <MemberTable
              universe={u}
              members={scopeMembers}
              lenses={lenses}
              lens={lens}
              shortHorizons={board.short_horizons ?? []}
              benchmark={board.benchmark}
              pastBar={viewingPast ? board.bar_date : null}
              deltaLabel={deltaLabel}
              within={level === 'industry' ? 'industry' : 'sector'}
              industryName={(c) => (c ? industriesBy.get(c)?.name ?? c : '—')}
              showIndustry={level !== 'industry'}
              leader={board.leader_percentile}
              laggard={board.laggard_percentile}
              selected={sym}
              onOpen={openMember}
              onOpenIndustry={(c) => openGroup('industry', c)}
            />
          </Card>

          <Card title="Comparar" subtitle={`Percentil ${lensLabel} a lo largo del tiempo de los valores y grupos fijados`}>
            <ComparePanel lens={lens} lenses={lenses} labels={labels} asOf={asOf} />
          </Card>
        </div>
      )}
    </div>
  )
}
