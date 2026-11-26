import { useState } from 'react'
import { fmtDate, fmtNum } from '../../lib/format'
import type { RsHeatmap } from '../../lib/types'
import { pctFill } from '../../lib/rs'

const monthFmt = new Intl.DateTimeFormat('es-ES', { month: 'short' })
const yearFmt = new Intl.DateTimeFormat('es-ES', { month: 'short', year: '2-digit' })

/**
 * Groups × weeks, the cell = the group's mean percentile in the universe at the
 * week's last stored bar. One hue by intensity; rows keep the core's order
 * (strongest at the last week first). Shows rotation at a glance: a band that
 * darkens to the right is a group gaining strength.
 */
export function Heatmap({ data, onOpen, selected }: { data: RsHeatmap; onOpen: (code: string) => void; selected?: string | null }) {
  const [hover, setHover] = useState<{ r: number; c: number; x: number; y: number } | null>(null)
  const weeks = data.weeks
  const n = weeks.length

  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <div className="grid gap-y-[2px]" style={{ gridTemplateColumns: `minmax(120px, 190px) 1fr 44px` }}>
        <div />
        <div className="relative h-4 text-[10px] text-ink-3">
          {weeks.map((w, i) => {
            const d = new Date(`${w}T12:00:00`)
            const prev = i > 0 ? new Date(`${weeks[i - 1]}T12:00:00`) : null
            const newMonth = !prev || prev.getMonth() !== d.getMonth()
            // Room for a label every month up to ~30 weeks; beyond, every 2 or 3 months (January always: it carries the year).
            const step = n > 60 ? 3 : n > 30 ? 2 : 1
            const every = d.getMonth() === 0 || d.getMonth() % step === 0
            if (!newMonth || !every || i > n - 3) return null
            // The window's first (partial) month only gets a label if it has room before the next one.
            if (i === 0 && weeks.slice(1, 4).some((x) => new Date(`${x}T12:00:00`).getMonth() !== d.getMonth())) return null
            return (
              <span key={w} className="absolute whitespace-nowrap" style={{ left: `${(i / n) * 100}%` }}>
                {(d.getMonth() === 0 || i === 0 ? yearFmt : monthFmt).format(d)}
              </span>
            )
          })}
        </div>
        <div className="text-right text-[10px] text-ink-3">última</div>
        {data.rows.map((row, r) => (
          <div key={row.code} className="contents">
            <button
              onClick={() => onOpen(row.code)}
              className={`truncate pr-2 text-left text-xs hover:text-ink hover:underline ${row.code === selected ? 'font-semibold text-ink' : 'text-ink-2'}`}
              title={row.name}
            >
              {row.name}
            </button>
            <div className="flex h-[18px] gap-px" role="img" aria-label={`${row.name}: percentil medio semanal`}>
              {row.values.map((v, c) => (
                <div
                  key={c}
                  className="h-full flex-1 rounded-[2px]"
                  style={{
                    background: v == null ? 'var(--surface-2)' : pctFill(v),
                    outline: hover && hover.r === r && hover.c === c ? '1px solid var(--ink-2)' : undefined,
                  }}
                  onMouseEnter={(e) => {
                    const host = (e.currentTarget.closest('.relative') as HTMLElement).getBoundingClientRect()
                    const cell = e.currentTarget.getBoundingClientRect()
                    setHover({ r, c, x: cell.left - host.left + cell.width / 2, y: cell.top - host.top })
                  }}
                  onClick={() => onOpen(row.code)}
                />
              ))}
            </div>
            <div className="num text-right text-xs text-ink">{fmtNum(row.values[n - 1], 0)}</div>
          </div>
        ))}
      </div>
      {hover && data.rows[hover.r] && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line-strong bg-surface-3 px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: hover.x, top: hover.y - 6 }}
        >
          <div className="font-medium text-ink">{data.rows[hover.r].name}</div>
          <div className="text-ink-2">
            Semana al {fmtDate(weeks[hover.c])}: <span className="num font-medium text-ink">{fmtNum(data.rows[hover.r].values[hover.c], 1)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
