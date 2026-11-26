import clsx from 'clsx'
import { ExternalLink, Play, RotateCw, ScrollText, Square } from 'lucide-react'
import { useState } from 'react'
import { useServiceAction, useServiceLogs } from '../../lib/api'
import { fmtAgo } from '../../lib/format'
import type { AdminService, AdminSystem, ServiceAction } from '../../lib/types'
import { Card, ErrorState, Pill, Warnings } from '../ui'
import { ActionButton, LevelDot, LogView } from './common'

const ACTION: Record<ServiceAction, { label: string; icon: typeof Play; tone: 'neutral' | 'accent' | 'danger' }> = {
  start: { label: 'Arrancar', icon: Play, tone: 'accent' },
  restart: { label: 'Reiniciar', icon: RotateCw, tone: 'neutral' },
  stop: { label: 'Parar', icon: Square, tone: 'danger' },
}
const ROLE: Record<string, string> = { database: 'Base de datos', orchestrator: 'Airflow', tool: 'Herramienta', init: 'Inicialización' }

function ServiceLogs({ name }: { name: string }) {
  const q = useServiceLogs(name)
  if (q.error) return <ErrorState error={q.error} />
  return (
    <div className="mt-3">
      <div className="mb-1.5 text-[11px] text-ink-3">Últimas 300 líneas · se refresca cada 10 s</div>
      <LogView follow text={q.data?.lines.join('\n') ?? 'Cargando…'} />
    </div>
  )
}

function ServiceRow({ s }: { s: AdminService }) {
  const act = useServiceAction()
  const [logs, setLogs] = useState(false)
  const pending = act.isPending ? act.variables?.action : null

  const run = (action: ServiceAction) => {
    if (action !== 'start' && s.stop_warning) {
      const verb = action === 'stop' ? 'Parar' : 'Reiniciar'
      if (!window.confirm(`${verb} ${s.label}?\n\n${s.stop_warning}`)) return
    }
    act.mutate({ name: s.name, action })
  }

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
        <div className="min-w-[240px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-ink">{s.label}</span>
            <Pill>{ROLE[s.role] ?? s.role}</Pill>
            {s.url && s.state === 'running' && (
              <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline">
                Abrir <ExternalLink size={11} aria-hidden />
              </a>
            )}
          </div>
          <p className="mt-0.5 text-xs text-ink-3">{s.description}</p>
        </div>
        <div className="w-[260px] space-y-0.5">
          <LevelDot level={s.level} text={s.condition} />
          <div className="text-[11px] text-ink-3">
            {s.started_at ? `Arrancado ${fmtAgo(s.started_at)}` : s.status_text || s.state}
            {s.ports.length > 0 && <span className="num"> · puerto {s.ports.join(', ')}</span>}
          </div>
          {s.container && <div className="font-mono text-[10px] text-ink-3">{s.container}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {s.actions.map((a) => {
            const A = ACTION[a]
            return (
              <ActionButton key={a} tone={A.tone} busy={pending === a} disabled={act.isPending} onClick={() => run(a)}>
                {pending !== a && <A.icon size={12} aria-hidden />}
                {A.label}
              </ActionButton>
            )
          })}
          {s.container && (
            <ActionButton onClick={() => setLogs((v) => !v)} title="Ver el log del contenedor">
              <ScrollText size={12} aria-hidden /> {logs ? 'Ocultar log' : 'Log'}
            </ActionButton>
          )}
        </div>
      </div>
      {act.error && (
        <div className="mt-2">
          <ErrorState error={act.error} />
        </div>
      )}
      {logs && <ServiceLogs name={s.name} />}
    </li>
  )
}

export function ServicesPanel({ data }: { data: AdminSystem }) {
  return (
    <div className="space-y-4">
      <Warnings items={data.warnings} />
      <Card
        title="Servicios del sistema"
        subtitle={
          <>
            Contenedores del compose de <span className="font-mono">{data.compose_dir}</span>. El panel solo arranca, para y reinicia los que ya
            existen: crearlos o reconstruir imágenes sigue siendo <span className="font-mono">docker compose up</span> /{' '}
            <span className="font-mono">build</span>.
          </>
        }
        bodyClassName="p-0 pt-2"
      >
        <ul className={clsx('divide-y divide-line', !data.docker_available && 'is-stale')}>
          {data.services.map((s) => (
            <ServiceRow key={s.name} s={s} />
          ))}
        </ul>
      </Card>
    </div>
  )
}
