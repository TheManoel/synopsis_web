import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { fmtDate, fmtDateTime, fmtLevel } from '../../lib/format'
import type { AnalystLevel, SymbolOptionLevels, SymbolOptionLevelsHistory } from '../../lib/types'
import { Warnings } from '../ui'
import { LEVEL_COLOR } from './optionLevelColors'

const NAV =
  'inline-flex h-7 items-center gap-1 rounded-md border border-line bg-surface-2 px-2 text-ink-2 hover:text-ink disabled:opacity-40 disabled:hover:text-ink-2'

/**
 * The analyst's levels on one session, in the core's words: each level with the post it
 * comes from and what the session did with it. Travel in time with the arrows, the date
 * or a click on the chart.
 */
export function OptionLevelsPanel({
  data,
  history,
  sessions,
  picked,
  onPick,
  stale,
}: {
  data: SymbolOptionLevels
  history?: SymbolOptionLevelsHistory
  /** The chart's sessions: the arrows step through them. */
  sessions: string[]
  /** The session asked for (null = the latest published). */
  picked: string | null
  onPick: (session: string | null) => void
  stale: boolean
}) {
  const at = data.as_of
  const i = at ? sessions.indexOf(at) : -1
  const last = sessions.length ? sessions[sessions.length - 1] : null
  // A session after the chart's last bar (levels published for tomorrow) steps back to it.
  const prev = i > 0 ? sessions[i - 1] : i < 0 && at && last && at > last ? last : null
  const next = i >= 0 && i < sessions.length - 1 ? sessions[i + 1] : null
  // The two sides of an implied move share their sentence: list it once.
  const seen = new Set<string>()
  const items = data.levels.filter((l) => (seen.has(l.text) ? false : (seen.add(l.text), true)))
  return (
    <section className={`mt-4 rounded-xl border border-line bg-surface-2/40 p-3 text-xs ${stale ? 'is-stale' : ''}`}>
      <header className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="text-sm font-semibold text-ink">Niveles de opciones · {data.feed_label}</h3>
        <div className="ml-auto flex items-center gap-1.5">
          <button className={NAV} disabled={!prev} onClick={() => prev && onPick(prev)} title="Sesión anterior">
            <ChevronLeft size={13} />
          </button>
          <input
            type="date"
            className="num h-7 rounded-md border border-line bg-surface-2 px-2 text-ink"
            value={at ?? ''}
            min={data.first_session ?? undefined}
            max={data.last_session ?? undefined}
            onChange={(e) => e.target.value && onPick(e.target.value)}
            aria-label="Sesión"
          />
          <button className={NAV} disabled={!next} onClick={() => next && onPick(next)} title="Sesión siguiente">
            <ChevronRight size={13} />
          </button>
          <button className={NAV} disabled={picked == null} onClick={() => onPick(null)} title="La última publicación">
            Última
          </button>
        </div>
      </header>
      {at && (
        <p className="mb-2 text-ink-3">
          Sesión del <span className="num text-ink">{fmtDate(at)}</span>
          {data.bar ? (
            <>
              {' '}· mín <span className="num">{fmtLevel(data.bar.low)}</span> · máx <span className="num">{fmtLevel(data.bar.high)}</span> · cierre{' '}
              <span className="num">{fmtLevel(data.bar.close)}</span>
            </>
          ) : (
            ' (aún sin cotizar)'
          )}
          {data.prior_close != null && (
            <>
              {' '}· cierre previo <span className="num">{fmtLevel(data.prior_close)}</span>
            </>
          )}
          . Pulsa en el gráfico para ver otra sesión.
        </p>
      )}
      {data.regime && <p className="mb-2 text-ink">{data.regime}.</p>}
      <ul className="space-y-1.5">
        {items.map((l) => (
          <LevelItem key={l.kind} level={l} />
        ))}
      </ul>
      {data.check && (
        <p className={`mt-3 ${data.check.ok ? 'text-ink-2' : 'text-warn'}`}>
          <span className="font-medium">{data.check.ok ? 'Alineación ✓ ' : 'Alineación ✗ '}</span>
          {data.check.text}.
        </p>
      )}
      {history?.alignment && <p className="mt-1 text-ink-3">{history.alignment}.</p>}
      <Warnings
        items={[...data.warnings, ...data.rejected.map((r) => `Descartado: ${r}`), ...(history?.mismatches ?? []).map((m) => m.text)]}
        className="mt-2"
      />
      {data.sources.length > 0 && (
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-3">
          Fuente:
          {data.sources.map((s) => (
            <a key={s.ref} href={s.url ?? undefined} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
              post del {fmtDateTime(s.known_at)}
              {s.late ? ' (con la sesión abierta)' : ''}
              <ExternalLink size={11} />
            </a>
          ))}
        </p>
      )}
      <p className="mt-2 text-[11px] text-ink-3">
        {data.binding}. Son los niveles que publica el autor, sin recalcular; los nuestros (yfinance) están en Opciones.
      </p>
    </section>
  )
}

function LevelItem({ level: l }: { level: AnalystLevel }) {
  return (
    <li className="flex items-start gap-2 text-ink-2">
      <span className="mt-[6px] h-[2px] w-3 shrink-0" style={{ background: LEVEL_COLOR[l.kind] }} aria-hidden />
      <span>
        <span className="text-ink">{l.text}</span>
        {l.reaction && <span>: {l.reaction}</span>}
        {l.issues.map((x) => (
          <span key={x} className="block text-warn">
            {x}
          </span>
        ))}
        <span className="block text-[11px] text-ink-3" title="La línea del post de la que sale">
          «{l.evidence}»
        </span>
      </span>
    </li>
  )
}
