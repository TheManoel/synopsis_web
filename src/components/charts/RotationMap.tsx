import { useMemo, useState } from 'react'
import { fmtNum, fmtShortDate } from '../../lib/format'
import { QUADRANT_COLOR, QUADRANT_LABEL, QUADRANT_SOFT } from '../../lib/rotation'
import type { Quadrant, TrailPoint } from '../../lib/types'
import { useWidth } from './useSize'

export interface MapGroup {
  symbol: string
  label: string
  /** Visible trail, oldest first; the last point is the head. */
  points: TrailPoint[]
}

const M = { top: 14, right: 14, bottom: 36, left: 50 }
const LABEL_H = 14
const CHAR_W = 6.1

function niceStep(span: number, n: number) {
  const raw = span / n
  const mag = 10 ** Math.floor(Math.log10(raw))
  return [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw) ?? raw
}

function ticks(lo: number, hi: number, n: number) {
  const step = niceStep(hi - lo, n)
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6))
  return out
}

/**
 * Relative Rotation Graph: RS-Ratio (x) against RS-Momentum (y), centred on
 * (100, 100). Identity is carried by direct labels (there are more groups than
 * categorical hues); the head's colour encodes the quadrant, a state that is
 * also named in the tooltip and the table. Tails fade toward the past.
 */
export function RotationMap({
  groups,
  domainPoints,
  selected,
  onSelect,
  height = 500,
}: {
  groups: MapGroup[]
  /** Points the axes must fit (the caller passes the whole window while replaying, so the axes stay still). */
  domainPoints: { ratio: number; momentum: number }[]
  selected: string | null
  onSelect: (symbol: string) => void
  height?: number
}) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<string | null>(null)
  const h = height

  // Fit to the points shown, always keeping the (100, 100) centre in view.
  const { xd, yd } = useMemo(() => {
    const fit = (vs: number[]) => {
      const lo = Math.min(100, ...vs)
      const hi = Math.max(100, ...vs)
      const pad = Math.max(0.25, (hi - lo) * 0.08)
      return [lo - pad, hi + pad] as const
    }
    return { xd: fit(domainPoints.map((p) => p.ratio)), yd: fit(domainPoints.map((p) => p.momentum)) }
  }, [domainPoints])

  const pw = Math.max(1, w - M.left - M.right)
  const ph = h - M.top - M.bottom
  const x = (v: number) => M.left + ((v - xd[0]) / (xd[1] - xd[0])) * pw
  const y = (v: number) => M.top + (1 - (v - yd[0]) / (yd[1] - yd[0])) * ph
  const cx = x(100)
  const cy = y(100)

  const heads = groups
    .filter((g) => g.points.length > 0)
    .map((g) => {
      const p = g.points[g.points.length - 1]
      return { g, p, hx: x(p.ratio), hy: y(p.momentum) }
    })

  // Greedy label placement: right of the head, nudged down past collisions,
  // flipped to the left near the right edge.
  const labels = useMemo(() => {
    // Heads are obstacles too: a label must not sit on another group's dot.
    const placed: { x0: number; x1: number; y: number }[] = heads.map(({ hx, hy }) => ({ x0: hx - 6, x1: hx + 6, y: hy }))
    const out = new Map<string, { lx: number; ly: number; anchor: 'start' | 'end'; hx: number; hy: number }>()
    for (const { g, hx, hy } of [...heads].sort((a, b) => a.hy - b.hy)) {
      const tw = g.label.length * CHAR_W
      const right = hx + 9 + tw < w - M.right
      const x0 = right ? hx + 9 : hx - 9 - tw
      const x1 = x0 + tw
      let ly = hy
      for (let guard = 0; guard < 40; guard++) {
        const hit = placed.find((b) => b.x0 < x1 && x0 < b.x1 && Math.abs(b.y - ly) < LABEL_H)
        if (!hit) break
        ly = hit.y + LABEL_H
      }
      placed.push({ x0, x1, y: ly })
      out.set(g.symbol, { lx: right ? hx + 9 : hx - 9, ly, anchor: right ? 'start' : 'end', hx, hy })
    }
    return out
    // heads derive from groups + scales
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, w, xd, yd, h])

  const focus = hover ?? selected
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const mx = e.nativeEvent.offsetX
    const my = e.nativeEvent.offsetY
    let best: string | null = null
    let bd = 26 * 26
    for (const { g, hx, hy } of heads) {
      const d = (hx - mx) ** 2 + (hy - my) ** 2
      if (d < bd) {
        bd = d
        best = g.symbol
      }
    }
    setHover(best)
  }
  const hovered = heads.find((hd) => hd.g.symbol === hover)

  const quadRects: { q: Quadrant; x0: number; y0: number; x1: number; y1: number }[] = [
    { q: 'Leading', x0: cx, y0: M.top, x1: M.left + pw, y1: cy },
    { q: 'Weakening', x0: cx, y0: cy, x1: M.left + pw, y1: M.top + ph },
    { q: 'Lagging', x0: M.left, y0: cy, x1: cx, y1: M.top + ph },
    { q: 'Improving', x0: M.left, y0: M.top, x1: cx, y1: cy },
  ]

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height: h }}>
      {w > 0 && (
        <svg
          width={w}
          height={h}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          onClick={() => hover && onSelect(hover)}
          className={hover ? 'cursor-pointer' : undefined}
          role="img"
          aria-label="Gráfico de rotación relativa: RS-Ratio en el eje horizontal, RS-Momentum en el vertical"
        >
          {quadRects.map((r) => (
            <rect key={r.q} x={r.x0} y={r.y0} width={Math.max(0, r.x1 - r.x0)} height={Math.max(0, r.y1 - r.y0)} fill={QUADRANT_SOFT[r.q]} opacity={0.55} />
          ))}
          {/* corner names */}
          <g fontSize={10} fontWeight={600} letterSpacing="0.06em" fill="var(--ink-3)">
            <text x={M.left + pw - 8} y={M.top + 16} textAnchor="end">{QUADRANT_LABEL.Leading.toUpperCase()}</text>
            <text x={M.left + pw - 8} y={M.top + ph - 8} textAnchor="end">{QUADRANT_LABEL.Weakening.toUpperCase()}</text>
            <text x={M.left + 8} y={M.top + ph - 8}>{QUADRANT_LABEL.Lagging.toUpperCase()}</text>
            <text x={M.left + 8} y={M.top + 16}>{QUADRANT_LABEL.Improving.toUpperCase()}</text>
          </g>
          {/* grid + axes */}
          <g fontSize={10} fill="var(--ink-3)">
            {ticks(xd[0], xd[1], Math.max(3, Math.floor(pw / 90))).map((t) => (
              <g key={`x${t}`}>
                <line x1={x(t)} x2={x(t)} y1={M.top} y2={M.top + ph} stroke="var(--grid)" />
                <text x={x(t)} y={M.top + ph + 14} textAnchor="middle" className="num">{fmtNum(t, t % 1 ? 1 : 0)}</text>
              </g>
            ))}
            {ticks(yd[0], yd[1], Math.max(3, Math.floor(ph / 70))).map((t) => (
              <g key={`y${t}`}>
                <line x1={M.left} x2={M.left + pw} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
                <text x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="num">{fmtNum(t, t % 1 ? 1 : 0)}</text>
              </g>
            ))}
            <line x1={cx} x2={cx} y1={M.top} y2={M.top + ph} stroke="var(--axis)" />
            <line x1={M.left} x2={M.left + pw} y1={cy} y2={cy} stroke="var(--axis)" />
            <text x={M.left + pw} y={h - 4} textAnchor="end" fill="var(--ink-2)">RS-Ratio →</text>
            <text transform={`translate(12 ${M.top}) rotate(-90)`} textAnchor="end" fill="var(--ink-2)">RS-Momentum →</text>
          </g>

          {/* tails */}
          {heads.map(({ g }) => {
            const on = focus === g.symbol
            const dim = focus != null && !on
            const n = g.points.length
            return (
              <g key={`t${g.symbol}`} opacity={dim ? 0.28 : 1}>
                {g.points.slice(1).map((p, i) => {
                  const a = g.points[i]
                  return (
                    <line
                      key={p.date}
                      x1={x(a.ratio)} y1={y(a.momentum)} x2={x(p.ratio)} y2={y(p.momentum)}
                      stroke={on ? 'var(--ink)' : 'var(--ink-3)'}
                      strokeWidth={on ? 2 : 1.5}
                      strokeLinecap="round"
                      opacity={0.3 + 0.7 * ((i + 1) / Math.max(1, n - 1))}
                    />
                  )
                })}
                {g.points.slice(0, -1).map((p, i) => (
                  <circle key={p.date} cx={x(p.ratio)} cy={y(p.momentum)} r={on ? 2.25 : 1.75}
                    fill={on ? 'var(--ink)' : 'var(--ink-3)'} opacity={0.3 + 0.7 * (i / Math.max(1, n - 1))} />
                ))}
              </g>
            )
          })}

          {/* heads + direct labels */}
          {heads.map(({ g, p }) => {
            const on = focus === g.symbol
            const dim = focus != null && !on
            const l = labels.get(g.symbol)
            if (!l) return null
            const moved = Math.abs(l.ly - l.hy) > 3
            return (
              <g key={`h${g.symbol}`} opacity={dim ? 0.35 : 1}>
                {moved && <line x1={l.hx} y1={l.hy} x2={l.lx} y2={l.ly} stroke="var(--line-strong)" />}
                <circle cx={l.hx} cy={l.hy} r={on ? 6.5 : 5.5} fill={QUADRANT_COLOR[p.quadrant]} stroke="var(--surface)" strokeWidth={2} />
                <text
                  x={l.lx} y={l.ly} dy="0.32em" textAnchor={l.anchor}
                  fontSize={11} fontWeight={on ? 600 : 500}
                  fill={on ? 'var(--ink)' : 'var(--ink-2)'}
                  paintOrder="stroke" stroke="var(--surface)" strokeWidth={3} strokeLinejoin="round"
                >
                  {g.label}
                </text>
              </g>
            )
          })}
        </svg>
      )}
      {hovered && (
        <div
          className="pointer-events-none absolute z-10 min-w-[170px] rounded-lg border border-line-strong bg-surface-2 px-2.5 py-2 text-[11px] shadow-lg"
          style={{
            top: Math.min(hovered.hy + 12, h - 110),
            left: hovered.hx > w - 210 ? undefined : hovered.hx + 14,
            right: hovered.hx > w - 210 ? w - hovered.hx + 14 : undefined,
          }}
        >
          <div className="font-medium text-ink">{hovered.g.label}</div>
          <div className="mb-1 flex items-center gap-1.5 text-ink-2">
            <span className="h-2 w-2 rounded-full" style={{ background: QUADRANT_COLOR[hovered.p.quadrant] }} />
            {QUADRANT_LABEL[hovered.p.quadrant]} · {fmtShortDate(hovered.p.date)}
          </div>
          <div className="flex justify-between gap-4"><span className="text-ink-2">RS-Ratio</span><span className="num font-medium text-ink">{fmtNum(hovered.p.ratio, 2)}</span></div>
          <div className="flex justify-between gap-4"><span className="text-ink-2">RS-Momentum</span><span className="num font-medium text-ink">{fmtNum(hovered.p.momentum, 2)}</span></div>
        </div>
      )}
    </div>
  )
}
