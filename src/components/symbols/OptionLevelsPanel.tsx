import { Link } from 'react-router'
import { fmtLevel, fmtTime } from '../../lib/format'
import type { SymbolOptionLevels } from '../../lib/types'
import { LEVEL_COLOR } from './optionLevelColors'

/** What the lines on the chart are, in the core's words. */
export function OptionLevelsPanel({ data }: { data: SymbolOptionLevels }) {
  // The two sides of an implied move share their sentence: list it once.
  const seen = new Set<string>()
  const items = data.levels.filter((l) => (seen.has(l.text) ? false : (seen.add(l.text), true)))
  return (
    <section className="mt-4 rounded-xl border border-line bg-surface-2/40 p-3 text-xs">
      <header className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold text-ink">Niveles de opciones</h3>
        <span className="text-ink-3">
          Cadena de {data.underlying?.toUpperCase()} · spot {data.spot == null ? '' : fmtLevel(data.spot)}
          {data.spot_time && ` a las ${fmtTime(data.spot_time)}`} · calculados por Synopsis
        </span>
        <Link to="/opciones" className="ml-auto text-accent hover:underline">
          Detalle en Opciones
        </Link>
      </header>
      {data.regime && <p className="mb-2 text-ink">{data.regime}.</p>}
      <ul className="space-y-1">
        {items.map((l) => (
          <li key={l.kind} className="flex items-start gap-2 text-ink-2">
            <span className="mt-[6px] h-[2px] w-3 shrink-0" style={{ background: LEVEL_COLOR[l.kind] }} aria-hidden />
            <span>{l.text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-ink-3">
        Instantánea de la cadena (sin histórico): las líneas son de ahora, no de cada sesión pasada. GEX con la convención pública de dealers
        (largos de calls, cortos de puts), supuesta.
      </p>
    </section>
  )
}
