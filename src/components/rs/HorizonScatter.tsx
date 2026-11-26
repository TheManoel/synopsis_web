import { useMemo, useState } from 'react'
import { fmtNum } from '../../lib/format'
import { pctDot } from '../../lib/rs'
import { HeatLegend } from './parts'
import type { RsMember } from '../../lib/types'
import { useWidth } from '../charts/useSize'

const M = { top: 12, right: 14, bottom: 34, left: 40 }

/**
 * Every member of the universe placed by two horizons of the same ranking:
 * x = the long lens, y = a short one. The members of the current level are
 * drawn in colour, the rest of the universe stays as faint context. Purely
 * descriptive: the corners are named for what they are, not for what to do.
 */
export function HorizonScatter({
  members,
  inScope,
  xLens,
  yLens,
  xLabel,
  yLabel,
  leader,
  laggard,
  selected,
  onOpen,
  height = 340,
}: {
  members: RsMember[]
  inScope: Set<string> | null
  xLens: string
  yLens: string
  xLabel: string
  yLabel: string
  leader: number
  laggard: number
  selected: string | null
  onOpen: (m: RsMember) => void
  height?: number
}) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<RsMember | null>(null)
  const iw = Math.max(0, w - M.left - M.right)
  const ih = height - M.top - M.bottom
  const x = (v: number) => M.left + (v / 100) * iw
  const y = (v: number) => M.top + (1 - v / 100) * ih

  const pts = useMemo(
    () => members.filter((m) => m.percentile[xLens] != null && m.percentile[yLens] != null),
    [members, xLens, yLens],
  )
  // Context first, the current level on top, the selected member last.
  const ordered = useMemo(() => {
    const out = [...pts]
    out.sort((a, b) => Number(inScope?.has(a.key) ?? true) - Number(inScope?.has(b.key) ?? true))
    const i = out.findIndex((m) => m.key === selected)
    if (i >= 0) out.push(out.splice(i, 1)[0])
    return out
  }, [pts, inScope, selected])

  const corner = (text: string, cx: number, cy: number, anchor: 'start' | 'end') => (
    <text x={cx} y={cy} textAnchor={anchor} fontSize={10} fill="var(--ink-2)" stroke="var(--surface)" strokeWidth={3} paintOrder="stroke" pointerEvents="none">
      {text}
    </text>
  )

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label={`Percentil ${xLabel} frente a percentil ${yLabel} de cada valor`}>
          <g fontSize={10} fill="var(--ink-3)">
            {[0, 20, 50, 80, 100].map((t) => (
              <g key={t}>
                <line x1={x(t)} x2={x(t)} y1={M.top} y2={M.top + ih} stroke="var(--grid)" />
                <line x1={M.left} x2={M.left + iw} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
                <text x={x(t)} y={M.top + ih + 14} textAnchor="middle" className="num">{t}</text>
                <text x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="num">{t}</text>
              </g>
            ))}
            <text x={M.left + iw / 2} y={height - 4} textAnchor="middle" fill="var(--ink-2)">Percentil {xLabel} →</text>
            <text transform={`translate(11 ${M.top + ih / 2}) rotate(-90)`} textAnchor="middle" fill="var(--ink-2)">Percentil {yLabel} →</text>
          </g>
          {/* Leader / laggard cuts on both horizons. */}
          <g stroke="var(--axis)" strokeDasharray="3 3">
            <line x1={x(leader)} x2={x(leader)} y1={M.top} y2={M.top + ih} />
            <line x1={x(laggard)} x2={x(laggard)} y1={M.top} y2={M.top + ih} />
            <line x1={M.left} x2={M.left + iw} y1={y(leader)} y2={y(leader)} />
            <line x1={M.left} x2={M.left + iw} y1={y(laggard)} y2={y(laggard)} />
          </g>
          {ordered.map((m) => {
            const scoped = inScope ? inScope.has(m.key) : true
            const sel = m.key === selected
            const cx = x(m.percentile[xLens]!)
            const cy = y(m.percentile[yLens]!)
            return (
              <g key={m.key} onMouseEnter={() => setHover(m)} onClick={() => onOpen(m)} className="cursor-pointer">
                <circle cx={cx} cy={cy} r={8} fill="transparent" />
                <circle
                  cx={cx}
                  cy={cy}
                  r={sel ? 5.5 : scoped ? 3.5 : 2.2}
                  // Colour = where the point sits on both horizons at once (mean of the two
                  // percentiles): green "strong on both", red "weak on both", grey when mixed.
                  fill={scoped ? pctDot((m.percentile[xLens]! + m.percentile[yLens]!) / 2) : 'var(--ink-3)'}
                  fillOpacity={scoped ? 0.95 : 0.22}
                  stroke={sel ? 'var(--ink)' : scoped ? 'var(--surface)' : 'none'}
                  strokeWidth={sel ? 2 : 1}
                />
                {sel && (
                  <text x={cx + 8} y={cy - 6} fontSize={11} fontWeight={600} fill="var(--ink)">
                    {m.ticker}
                  </text>
                )}
              </g>
            )
          })}
          {corner('Fuerte en ambos', M.left + iw - 4, M.top + 11, 'end')}
          {corner(`Fuerte ${xLabel} · flojo ${yLabel}`, M.left + iw - 4, M.top + ih - 5, 'end')}
          {corner(`Flojo ${xLabel} · fuerte ${yLabel}`, M.left + 4, M.top + 11, 'start')}
          {corner('Flojo en ambos', M.left + 4, M.top + ih - 5, 'start')}
        </svg>
      )}
      {hover && (
        <div
          className="pointer-events-none absolute z-20 whitespace-nowrap rounded-lg border border-line-strong bg-surface-3 px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            left: Math.min(x(hover.percentile[xLens]!) + 10, Math.max(0, w - 200)),
            top: Math.max(0, y(hover.percentile[yLens]!) - 52),
          }}
        >
          <div className="font-medium text-ink">
            {hover.ticker} <span className="font-normal text-ink-3">{hover.name}</span>
          </div>
          <div className="num text-ink-2">
            {xLabel} {fmtNum(hover.percentile[xLens], 0)} · {yLabel} {fmtNum(hover.percentile[yLens], 0)}
          </div>
        </div>
      )}
      <div className="mt-1 flex justify-end">
        <HeatLegend label={`Color: media de ${xLabel} y ${yLabel}`} />
      </div>
    </div>
  )
}
