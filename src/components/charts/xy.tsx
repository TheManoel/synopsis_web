import { useMemo, useState, type ReactNode } from 'react'
import { useWidth } from './useSize'

// ---------------------------------------------------------------- scales

function linear(d0: number, d1: number, r0: number, r1: number) {
  const span = d1 - d0 || 1
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0)
}

/** ~n "nice" ticks over [lo, hi]. */
function niceTicks(lo: number, hi: number, n = 5): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo === hi) return [lo]
  const raw = (hi - lo) / n
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toFixed(10))
  return out
}

const M = { top: 14, right: 16, bottom: 26, left: 56 }

export interface RefLine {
  value: number
  label: string
  color?: string
}

interface Frame {
  height: number
  xDomain: [number, number]
  yDomain: [number, number]
  xFormat: (v: number) => string
  yFormat: (v: number) => string
  refX?: RefLine[]
  refY?: RefLine[]
  xTicks?: number
}

function Axes({ w, h, x, y, f }: { w: number; h: number; x: (v: number) => number; y: (v: number) => number; f: Frame }) {
  const xt = niceTicks(f.xDomain[0], f.xDomain[1], f.xTicks ?? Math.max(3, Math.floor(w / 110)))
  const yt = niceTicks(f.yDomain[0], f.yDomain[1], Math.max(3, Math.floor(h / 55)))
  return (
    <g fontSize={10} fill="var(--ink-3)">
      {yt.map((t) => (
        <g key={`y${t}`}>
          <line x1={M.left} x2={w - M.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
          <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="num">
            {f.yFormat(t)}
          </text>
        </g>
      ))}
      {xt.map((t) => (
        <text key={`x${t}`} x={x(t)} y={h - 8} textAnchor="middle" className="num">
          {f.xFormat(t)}
        </text>
      ))}
      <line x1={M.left} x2={w - M.right} y1={h - M.bottom} y2={h - M.bottom} stroke="var(--axis)" />
    </g>
  )
}

function RefLines({ w, h, x, y, f }: { w: number; h: number; x: (v: number) => number; y: (v: number) => number; f: Frame }) {
  const inX = (v: number) => v >= f.xDomain[0] && v <= f.xDomain[1]
  const inY = (v: number) => v >= f.yDomain[0] && v <= f.yDomain[1]
  return (
    <g fontSize={10} fontWeight={600}>
      {(f.refY ?? []).filter((r) => inY(r.value)).map((r) => (
        <g key={`ry${r.label}`}>
          <line x1={M.left} x2={w - M.right} y1={y(r.value)} y2={y(r.value)} stroke={r.color ?? 'var(--axis)'} />
          {r.label && (
            <text x={w - M.right - 4} y={y(r.value) - 4} textAnchor="end" fill="var(--ink-2)">
              {r.label}
            </text>
          )}
        </g>
      ))}
      {(f.refX ?? []).filter((r) => inX(r.value)).map((r, i) => (
        <g key={`rx${r.label}`}>
          <line x1={x(r.value)} x2={x(r.value)} y1={M.top} y2={h - M.bottom} stroke={r.color ?? 'var(--axis)'} strokeWidth={1.25} />
          <text x={x(r.value) + 4} y={M.top + 10 + (i % 3) * 12} fill="var(--ink-2)">
            {r.label}
          </text>
        </g>
      ))}
    </g>
  )
}

function Tooltip({ left, top, width, children }: { left: number; top: number; width: number; children: ReactNode }) {
  const flip = left > width - 190
  return (
    <div
      className="pointer-events-none absolute z-10 min-w-[150px] rounded-lg border border-line-strong bg-surface-2 px-2.5 py-2 text-[11px] shadow-lg"
      style={{ top, left: flip ? undefined : left + 12, right: flip ? width - left + 12 : undefined }}
    >
      {children}
    </div>
  )
}

export const TipRow = ({ color, label, value }: { color?: string; label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="inline-flex items-center gap-1.5 text-ink-2">
      {color && <span className="h-2 w-2 rounded-sm" style={{ background: color }} />}
      {label}
    </span>
    <span className="num font-medium text-ink">{value}</span>
  </div>
)

// ---------------------------------------------------------------- lines

export interface XYSeries {
  id: string
  label: string
  color: string
  points: [number, number][]
  dots?: boolean
  faint?: boolean
}

export function LinePlot({
  series,
  tooltipTitle,
  ...frame
}: Omit<Frame, 'xDomain' | 'yDomain'> & {
  series: XYSeries[]
  xDomain?: [number, number]
  yDomain?: [number, number]
  tooltipTitle?: (x: number) => string
}) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const [hx, setHx] = useState<number | null>(null)
  const h = frame.height

  const { xDomain, yDomain } = useMemo(() => {
    const xs = series.flatMap((s) => s.points.map((p) => p[0]))
    const ys = series.flatMap((s) => s.points.map((p) => p[1]))
    const refYs = (frame.refY ?? []).map((r) => r.value)
    const y0 = Math.min(...ys, ...refYs)
    const y1 = Math.max(...ys, ...refYs)
    const pad = (y1 - y0) * 0.08 || Math.abs(y1) * 0.05 || 1
    return {
      xDomain: frame.xDomain ?? ([Math.min(...xs), Math.max(...xs)] as [number, number]),
      yDomain: frame.yDomain ?? ([y0 - pad, y1 + pad] as [number, number]),
    }
  }, [series, frame.xDomain, frame.yDomain, frame.refY])

  const f: Frame = { ...frame, xDomain, yDomain }
  const x = linear(xDomain[0], xDomain[1], M.left, Math.max(M.left + 1, w - M.right))
  const y = linear(yDomain[0], yDomain[1], h - M.bottom, M.top)
  const invX = (px: number) => xDomain[0] + ((px - M.left) / (w - M.left - M.right)) * (xDomain[1] - xDomain[0])

  const nearest = (s: XYSeries, at: number) => {
    let best: [number, number] | null = null
    for (const p of s.points) if (!best || Math.abs(p[0] - at) < Math.abs(best[0] - at)) best = p
    return best
  }
  const anchor = hx != null && series[0] ? nearest(series[0], hx) : null

  return (
    <div ref={ref} className="relative w-full" style={{ height: h }}>
      {w > 0 && (
        <svg
          width={w}
          height={h}
          onMouseMove={(e) => setHx(invX(e.nativeEvent.offsetX))}
          onMouseLeave={() => setHx(null)}
          role="img"
        >
          <Axes w={w} h={h} x={x} y={y} f={f} />
          <RefLines w={w} h={h} x={x} y={y} f={f} />
          {series.map((s) => {
            const pts = s.points.filter((p) => p[0] >= xDomain[0] && p[0] <= xDomain[1])
            const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('')
            return (
              <g key={s.id} opacity={s.faint ? 0.45 : 1}>
                {!s.dots || pts.length > 1 ? (
                  <path d={d} fill="none" stroke={s.color} strokeWidth={s.faint ? 1 : 2} strokeLinejoin="round" />
                ) : null}
                {s.dots &&
                  pts.map((p) => (
                    <circle key={p[0]} cx={x(p[0])} cy={y(p[1])} r={s.faint ? 2 : 3.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                  ))}
              </g>
            )
          })}
          {anchor && (
            <line x1={x(anchor[0])} x2={x(anchor[0])} y1={M.top} y2={h - M.bottom} stroke="var(--axis)" />
          )}
          {anchor &&
            series.map((s) => {
              const p = nearest(s, anchor[0])
              return p ? <circle key={s.id} cx={x(p[0])} cy={y(p[1])} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} /> : null
            })}
        </svg>
      )}
      {anchor && (
        <Tooltip left={x(anchor[0])} top={M.top} width={w}>
          <div className="mb-1 font-medium text-ink">{tooltipTitle ? tooltipTitle(anchor[0]) : frame.xFormat(anchor[0])}</div>
          {series.map((s) => {
            const p = nearest(s, anchor[0])
            return p ? <TipRow key={s.id} color={s.color} label={s.label} value={frame.yFormat(p[1])} /> : null
          })}
        </Tooltip>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- strike bars

export interface BarDatum {
  x: number
  up: number // drawn above the baseline
  down: number // drawn below the baseline (pass a negative number)
  net?: number
}

/**
 * Mirrored bars by strike: one quantity above zero, its counterpart below.
 * Used for dealer gamma (calls/puts) and for open interest / volume.
 */
export function StrikeBars({
  data,
  upColor,
  downColor,
  upLabel,
  downLabel,
  netLabel,
  ...frame
}: Omit<Frame, 'xDomain' | 'yDomain'> & {
  data: BarDatum[]
  upColor: string
  downColor: string
  upLabel: string
  downLabel: string
  netLabel?: string
}) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<BarDatum | null>(null)
  const h = frame.height

  const xs = data.map((d) => d.x)
  const xDomain: [number, number] = [Math.min(...xs), Math.max(...xs)]
  const yMax = Math.max(...data.map((d) => d.up), 0)
  const yMin = Math.min(...data.map((d) => d.down), 0)
  const pad = (yMax - yMin) * 0.06 || 1
  const yDomain: [number, number] = [yMin - pad, yMax + pad]
  const f: Frame = { ...frame, xDomain, yDomain }

  const x = linear(xDomain[0], xDomain[1], M.left + 4, Math.max(M.left + 5, w - M.right - 4))
  const y = linear(yDomain[0], yDomain[1], h - M.bottom, M.top)
  const step = data.length > 1 ? (x(xDomain[1]) - x(xDomain[0])) / (data.length - 1) : 8
  const bw = Math.max(1, Math.min(14, step - 2)) // 2px surface gap between bars
  const r = Math.min(2, bw / 2)

  const bar = (cx: number, v: number, color: string) => {
    if (!v) return null
    const y0 = y(0)
    const y1 = y(v)
    const top = Math.min(y0, y1)
    const hh = Math.max(1, Math.abs(y1 - y0))
    return <rect x={cx - bw / 2} y={top} width={bw} height={hh} rx={r} fill={color} />
  }

  return (
    <div ref={ref} className="relative w-full" style={{ height: h }}>
      {w > 0 && data.length > 0 && (
        <svg width={w} height={h} role="img" onMouseLeave={() => setHover(null)}>
          <Axes w={w} h={h} x={x} y={y} f={{ ...f, xTicks: Math.max(3, Math.floor(w / 90)) }} />
          <line x1={M.left} x2={w - M.right} y1={y(0)} y2={y(0)} stroke="var(--axis)" />
          {data.map((d) => (
            <g key={d.x} opacity={hover && hover.x !== d.x ? 0.55 : 1}>
              {bar(x(d.x), d.up, upColor)}
              {bar(x(d.x), d.down, downColor)}
              {/* hit target wider than the mark */}
              <rect
                x={x(d.x) - Math.max(step, 6) / 2}
                y={M.top}
                width={Math.max(step, 6)}
                height={h - M.top - M.bottom}
                fill="transparent"
                onMouseEnter={() => setHover(d)}
              />
            </g>
          ))}
          <RefLines w={w} h={h} x={x} y={y} f={f} />
        </svg>
      )}
      {hover && (
        <Tooltip left={x(hover.x)} top={M.top} width={w}>
          <div className="mb-1 font-medium text-ink">Strike {frame.xFormat(hover.x)}</div>
          <TipRow color={upColor} label={upLabel} value={frame.yFormat(hover.up)} />
          <TipRow color={downColor} label={downLabel} value={frame.yFormat(hover.down)} />
          {netLabel && hover.net != null && <TipRow label={netLabel} value={frame.yFormat(hover.net)} />}
        </Tooltip>
      )}
    </div>
  )
}

export function Legend({ items }: { items: { color: string; label: string; value?: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-2">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: i.color }} aria-hidden />
          {i.label}
          {i.value && <span className="num font-medium text-ink">{i.value}</span>}
        </span>
      ))}
    </div>
  )
}
