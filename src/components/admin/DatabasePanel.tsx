import { DASH, fmtAgo, fmtBytes, fmtCompact, fmtDate } from '../../lib/format'
import type { AdminDatabase } from '../../lib/types'
import { Card, InfoTip, Stat, Warnings } from '../ui'
import { LevelDot } from './common'

export function DatabasePanel({ data, onPipeline }: { data: AdminDatabase; onPipeline: (dagId: string) => void }) {
  if (!data.reachable) return <Warnings items={data.warnings} />
  const maxSchema = Math.max(...data.schemas.map((s) => s.size_bytes), 1)
  return (
    <div className="space-y-4">
      <Warnings items={data.warnings} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Tamaño" value={fmtBytes(data.size_bytes)} sub={`Base «${data.database}»`} />
        <Stat label="Motor" value={data.version ?? DASH} sub={data.timescale ? `TimescaleDB ${data.timescale}` : 'Sin TimescaleDB'} />
        <Stat
          label="Conexiones"
          value={`${data.connections_total ?? DASH} / ${data.max_connections ?? DASH}`}
          sub={data.connections.map((c) => `${c.count} ${c.state}`).join(' · ')}
        />
        <Stat label="En marcha" value={fmtAgo(data.started_at).replace(/^hace /, '')} sub={`Desde ${fmtDate(data.started_at)}`} />
      </div>

      <Card
        title="Frescura de los datos"
        subtitle="Último dato de cada tabla frente a lo que ya debería estar. Las de sesión se cuentan frente al calendario real del S&P 500."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-ink-3">
              <tr className="text-left">
                <th className="py-1 pr-3 font-medium">Dato</th>
                <th className="pr-3 font-medium">Tabla</th>
                <th className="pr-3 font-medium">Último</th>
                <th className="pr-3 font-medium">Estado</th>
                <th className="font-medium">Carga</th>
              </tr>
            </thead>
            <tbody>
              {data.datasets.map((d) => (
                <tr key={d.code} className="border-t border-line align-top">
                  <td className="py-1.5 pr-3 text-ink">
                    {d.label} {d.note && <InfoTip text={d.note} />}
                  </td>
                  <td className="pr-3 font-mono text-[11px] text-ink-3">{d.table}</td>
                  <td className="num whitespace-nowrap pr-3 text-ink-2">{fmtDate(d.last)}</td>
                  <td className="pr-3">
                    <LevelDot level={d.level} text={d.text} />
                  </td>
                  <td>
                    {d.pipeline && (
                      <button type="button" onClick={() => onPipeline(d.pipeline!)} className="font-mono text-[11px] text-accent hover:underline">
                        {d.pipeline}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <Card title="Esquemas" subtitle="Tamaño total (tablas, índices y TOAST).">
          <ul className="space-y-2">
            {data.schemas.map((s) => (
              <li key={s.schema_name} className="text-xs">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-ink">{s.schema_name}</span>
                  <span className="num text-ink-2">
                    {fmtBytes(s.size_bytes)} <span className="text-ink-3">· {s.tables} tablas</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-surface-3">
                  <div className="h-1.5 rounded-full bg-accent" style={{ width: `${Math.max((s.size_bytes / maxSchema) * 100, 0.5)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Tablas más grandes" subtitle="Filas estimadas por el planificador (ANALYZE), no un recuento exacto.">
          <table className="w-full text-xs">
            <thead className="text-ink-3">
              <tr className="text-left">
                <th className="py-1 pr-3 font-medium">Tabla</th>
                <th className="pr-3 text-right font-medium">Tamaño</th>
                <th className="text-right font-medium">Filas (est.)</th>
              </tr>
            </thead>
            <tbody>
              {data.tables.map((t) => (
                <tr key={`${t.schema_name}.${t.table}`} className="border-t border-line">
                  <td className="py-1 pr-3 font-mono text-[11px] text-ink">
                    <span className="text-ink-3">{t.schema_name}.</span>
                    {t.table}
                  </td>
                  <td className="num pr-3 text-right text-ink-2">{fmtBytes(t.size_bytes)}</td>
                  <td className="num text-right text-ink-3">{t.rows_estimate == null ? DASH : fmtCompact(t.rows_estimate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}
