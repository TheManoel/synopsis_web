import { fmtDate } from '../../lib/format'
import type { SymbolTiming, TimingSignal } from '../../lib/types'
import { Pill, Segmented } from '../ui'
import { tint, visibleSignals, type TimingMode } from './timingOverlay'

const KIND: Record<TimingSignal['direction'], string> = { top: 'Techo', bottom: 'Suelo', volatility: 'Volatilidad' }

function Row({ s }: { s: TimingSignal }) {
  return (
    <li className="flex items-start gap-2 py-1">
      <span className="mt-[5px] h-2 w-2 shrink-0 rounded-full" style={{ background: tint(s) }} aria-hidden />
      <span className="text-ink-2">
        <span className="font-medium text-ink">
          {KIND[s.direction]}
          {s.implied ? ' implícito' : ''}
        </span>{' '}
        <span className="num">{s.predicted_raw}</span>
        {s.strong && (
          <>
            {' '}
            <Pill tone="accent">fuerte</Pill>
          </>
        )}
        <span className="block text-[11px] text-ink-3">{s.text}</span>
        {s.check && s.check.verdict !== 'pending' && <span className="block text-[11px] text-ink-2">{s.check.text}</span>}
      </span>
    </li>
  )
}

/** McClellan's forecasts for this asset: what is ahead and how the recent ones went. */
export function TimingPanel({
  timing,
  mode,
  onMode,
}: {
  timing: SymbolTiming
  mode: Exclude<TimingMode, 'off'>
  onMode: (m: Exclude<TimingMode, 'off'>) => void
}) {
  const shown = visibleSignals(timing, mode)
  const ahead = shown.filter((s) => s.upcoming)
  const past = shown.filter((s) => !s.upcoming).slice(-6).reverse()
  const r = timing.report
  return (
    <section className="mt-4 rounded-xl border border-line bg-surface-2/40 p-3 text-xs">
      <header className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold text-ink">Timing Models · {timing.source}</h3>
        {r && (
          <span className="text-ink-3">
            Informe #{r.report_no} del {fmtDate(r.published_on)}
            {r.next_report_on && ` · el siguiente, ${fmtDate(r.next_report_on)}`}
          </span>
        )}
        <span className="ml-auto">
          <Segmented
            size="sm"
            label="Qué previsiones"
            value={mode}
            options={[
              { value: 'all', label: 'Todas' },
              { value: 'strong', label: 'Solo fuertes' },
            ]}
            onChange={onMode}
          />
        </span>
      </header>
      <p className="mb-2 text-[11px] text-ink-3">
        Fechas de giro de sus modelos propietarios, tal como las publica (no las calcula Synopsis). Flecha arriba = suelo
        previsto, abajo = techo; grande = fecha en negrita (señal fuerte); letra = cluster; <span className="text-[color:var(--s7)]">BC</span> = indicador
        experimental (puede invertirse); círculo = fecha real anotada por el autor; línea discontinua = fecha sin sesión todavía; gris = no se produjo, sin fecha real anotada o retirada por el autor.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="mb-1 font-medium text-ink-2">Próximas ({ahead.length})</h4>
          {ahead.length ? (
            <ul className="divide-y divide-line">{ahead.map((s) => <Row key={`${s.block}${s.source}${s.predicted_from}${s.direction}`} s={s} />)}</ul>
          ) : (
            <p className="text-ink-3">Ninguna pendiente en estos bloques.</p>
          )}
        </div>
        <div>
          <h4 className="mb-1 font-medium text-ink-2">Recientes</h4>
          {past.length ? (
            <ul className="divide-y divide-line">{past.map((s) => <Row key={`${s.block}${s.source}${s.predicted_from}${s.direction}`} s={s} />)}</ul>
          ) : (
            <p className="text-ink-3">Ninguna en la ventana del gráfico.</p>
          )}
        </div>
      </div>
      <ul className="mt-2 space-y-0.5 text-[11px] text-ink-3">
        {timing.blocks.map((b) => (
          <li key={b.code}>
            <span className="font-medium text-ink-2">{b.label}:</span> {b.note}
          </li>
        ))}
      </ul>
    </section>
  )
}
