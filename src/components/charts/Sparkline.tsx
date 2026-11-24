import { useId } from 'react'

/** Inline trend line; colour follows the sign of the whole window. */
export function Sparkline({ values, width = 112, height = 32 }: { values: number[]; width?: number; height?: number }) {
  const id = useId()
  if (values.length < 2) return <svg width={width} height={height} aria-hidden />
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pad = 2
  const x = (i: number) => (i / (values.length - 1)) * width
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - 2 * pad)
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const up = values[values.length - 1] >= values[0]
  const color = up ? 'var(--up)' : 'var(--down)'
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${d}L${width},${height}L0,${height}Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={2.25} fill={color} />
    </svg>
  )
}

/** Position of the last close inside the 52-week range. */
export function RangeBar({ position, low, high, fmt }: { position: number | null; low: string; high: string; fmt?: string }) {
  const p = position == null ? null : Math.min(1, Math.max(0, position))
  return (
    <div className="w-full min-w-[96px]" title={fmt}>
      <div className="relative h-1.5 rounded-full bg-surface-3">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: p == null ? 0 : `${p * 100}%`,
            background: 'linear-gradient(90deg, var(--down-soft), var(--accent-soft))',
          }}
        />
        {p != null && (
          <div
            className="absolute top-1/2 h-3 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink"
            style={{ left: `${p * 100}%` }}
          />
        )}
      </div>
      <div className="num mt-1 flex justify-between text-[10px] text-ink-3">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  )
}
