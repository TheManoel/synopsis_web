import clsx from 'clsx'
import { ChevronRight, ExternalLink, Pause, Play } from 'lucide-react'
import { useState } from 'react'
import { useAdminRun, useAdminTaskLog, usePausePipeline, useTriggerPipeline } from '../../lib/api'
import { DASH, fmtAgo, fmtDateTime, fmtDuration } from '../../lib/format'
import type { AdminPipeline, AdminPipelines, AdminRun, AdminTracker } from '../../lib/types'
import { Card, ErrorState, Pill, Skeleton, Warnings } from '../ui'
import { ActionButton, LevelDot, LogView } from './common'

const RUN_STATE: Record<string, { label: string; cls: string }> = {
  success: { label: 'Correcta', cls: 'bg-up' },
  failed: { label: 'Fallida', cls: 'bg-down' },
  running: { label: 'En curso', cls: 'bg-accent' },
  queued: { label: 'En cola', cls: 'bg-ink-3' },
  up_for_retry: { label: 'Reintentará', cls: 'bg-warn' },
  upstream_failed: { label: 'Falló antes', cls: 'bg-down' },
  skipped: { label: 'Saltada', cls: 'bg-ink-3' },
  scheduled: { label: 'Programada', cls: 'bg-ink-3' },
  deferred: { label: 'Diferida', cls: 'bg-ink-3' },
}
const RUN_TYPE: Record<string, string> = { scheduled: 'programada', manual: 'manual', backfill: 'backfill', dataset_triggered: 'por dataset' }
const runState = (s: string | null) => RUN_STATE[s ?? ''] ?? { label: s ?? 'sin estado', cls: 'bg-surface-3' }

function RunStrip({ runs, selected, onSelect }: { runs: AdminRun[]; selected?: string | null; onSelect?: (r: AdminRun) => void }) {
  return (
    <div className="flex flex-row-reverse justify-end gap-1">
      {runs.map((r) => {
        const st = runState(r.state)
        return (
          <button
            key={r.run_id}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onSelect?.(r)
            }}
            title={`${st.label} · ${RUN_TYPE[r.run_type] ?? r.run_type} · ${fmtDateTime(r.start)} · ${fmtDuration(r.duration_s)}`}
            className={clsx('h-4 w-2.5 rounded-sm', st.cls, selected === r.run_id && 'ring-2 ring-ink ring-offset-1 ring-offset-surface')}
            aria-label={`Ejecución ${st.label} del ${fmtDateTime(r.start)}`}
          />
        )
      })}
    </div>
  )
}

function TrackerBox({ t }: { t: AdminTracker }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-2">
        <span className="font-medium text-ink">Registro de la carga</span>
        <LevelDot level={t.status === 'success' ? 'ok' : t.status === 'failed' ? 'down' : 'running'} text={t.status} />
        <span>{t.row_count == null ? 'filas: —' : `${t.row_count} filas`}</span>
        <span>{fmtDuration(t.duration_s)}</span>
        {t.facts.map((f) => (
          <span key={f.key} className="text-ink-3">
            {f.key}: <span className="num text-ink-2">{f.value}</span>
          </span>
        ))}
      </div>
      {t.error && <div className="mt-1.5 break-words text-down">{t.error}</div>}
      {t.warnings.length > 0 && <Warnings className="mt-2" items={t.warnings} />}
    </div>
  )
}

function RunDetail({ dagId, run }: { dagId: string; run: AdminRun }) {
  const q = useAdminRun(dagId, run.run_id)
  const [picked, setTask] = useState<{ id: string; tryNumber: number } | null>(null)
  const detail = q.data
  // Por defecto, el log de la tarea fallida (o la última que corrió).
  const fallback = detail?.tasks.find((t) => t.state === 'failed') ?? [...(detail?.tasks ?? [])].reverse().find((t) => t.start)
  const task = picked ?? (fallback ? { id: fallback.task_id, tryNumber: fallback.try_number } : null)
  const live = ['queued', 'running'].includes(detail?.run.state ?? run.state)
  const log = useAdminTaskLog(dagId, run.run_id, task?.id ?? null, task?.tryNumber ?? 1, live)

  if (q.error) return <ErrorState error={q.error} />
  if (!detail) return <Skeleton className="h-40" />
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
        <span className="font-mono text-[11px] text-ink">{detail.run.run_id}</span>
        <span>{runState(detail.run.state).label}</span>
        <span>{RUN_TYPE[detail.run.run_type] ?? detail.run.run_type}</span>
        <span>Inicio {fmtDateTime(detail.run.start)}</span>
        <span>Duración {fmtDuration(detail.run.duration_s)}</span>
        {detail.run.note && <span className="text-ink-3">{detail.run.note}</span>}
      </div>
      {detail.tracker && <TrackerBox t={detail.tracker} />}
      <div className="grid gap-3 lg:grid-cols-[minmax(240px,320px)_1fr]">
        <ul className="space-y-0.5">
          {detail.tasks.map((t) => {
            const st = runState(t.state)
            const active = task?.id === t.task_id
            return (
              <li key={t.task_id}>
                <button
                  type="button"
                  onClick={() => setTask({ id: t.task_id, tryNumber: t.try_number })}
                  className={clsx(
                    'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs',
                    active ? 'bg-accent-soft text-ink' : 'text-ink-2 hover:bg-surface-2',
                  )}
                >
                  <span className={clsx('h-2 w-2 shrink-0 rounded-full', st.cls)} aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{t.task_id}</span>
                  <span className="text-[11px] text-ink-3">{st.label}</span>
                  <span className="num w-14 text-right text-[11px] text-ink-3">{fmtDuration(t.duration_s)}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <div className="min-w-0">
          {task ? (
            <>
              <div className="mb-1.5 text-[11px] text-ink-3">
                Log de <span className="font-mono">{task.id}</span> · intento {Math.max(task.tryNumber, 1)}
                {live && ' · se refresca cada 3 s'}
              </div>
              {log.error ? <ErrorState error={log.error} /> : <LogView follow text={log.data?.text ?? 'Cargando…'} />}
            </>
          ) : (
            <p className="text-xs text-ink-3">Elige una tarea para ver su log.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function PipelineRow({ p, open, onToggle }: { p: AdminPipeline; open: boolean; onToggle: () => void }) {
  const trigger = useTriggerPipeline()
  const pause = usePausePipeline()
  const [runId, setRunId] = useState<string | null>(null)
  const last = p.runs[0]
  const shown = p.runs.find((r) => r.run_id === runId) ?? last

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onToggle()}
        className="grid cursor-pointer grid-cols-1 items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-surface-2/60 lg:grid-cols-[minmax(260px,1.4fr)_minmax(200px,1fr)_minmax(180px,0.9fr)_auto]"
      >
        <div className="flex min-w-0 items-start gap-2">
          <ChevronRight size={14} className={clsx('mt-0.5 shrink-0 text-ink-3 transition-transform', open && 'rotate-90')} aria-hidden />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[12px] font-medium text-ink">{p.dag_id}</span>
              {p.paused && <Pill tone="warn">en pausa</Pill>}
            </div>
            {p.description && <p className="mt-0.5 line-clamp-2 text-[11px] text-ink-3">{p.description}</p>}
          </div>
        </div>
        <div className="space-y-0.5">
          <LevelDot level={p.level} text={p.condition} />
          <div className="text-[11px] text-ink-3">
            {p.scheduled ? p.schedule : 'A mano o desde otro DAG'}
            {p.scheduled && p.next_run && !p.paused && (p.next_run_due ? <> · le toca ya</> : <> · próxima {fmtAgo(p.next_run)}</>)}
          </div>
        </div>
        <div className="space-y-1">
          <RunStrip runs={p.runs} selected={open ? shown?.run_id : null} onSelect={(r) => { setRunId(r.run_id); if (!open) onToggle() }} />
          <div className="text-[11px] text-ink-3">
            {last ? (
              <>
                {runState(last.state).label} {fmtAgo(last.start ?? last.logical_date)} · {fmtDuration(last.duration_s)}
                {p.tracker?.row_count != null && <> · {p.tracker.row_count} filas</>}
              </>
            ) : (
              'Sin ejecuciones'
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <ActionButton tone="accent" busy={trigger.isPending} onClick={() => trigger.mutate(p.dag_id, { onSuccess: (r) => setRunId(r.run_id) })} title={p.paused ? 'Está en pausa: la ejecución quedará en cola hasta reanudarla' : 'Lanzar ahora'}>
            {!trigger.isPending && <Play size={12} aria-hidden />} Lanzar
          </ActionButton>
          <ActionButton busy={pause.isPending} onClick={() => pause.mutate({ dagId: p.dag_id, paused: !p.paused })} title={p.paused ? 'Reanudar: vuelve a lanzarse a su hora' : 'Pausar: deja de lanzarse a su hora'}>
            {!pause.isPending && (p.paused ? <Play size={12} aria-hidden /> : <Pause size={12} aria-hidden />)}
            {p.paused ? 'Reanudar' : 'Pausar'}
          </ActionButton>
        </div>
      </div>
      {(trigger.error || pause.error) && (
        <div className="px-4 pb-3">
          <ErrorState error={trigger.error ?? pause.error} />
        </div>
      )}
      {open && (
        <div className="border-t border-line bg-surface-2/40 px-4 py-3">
          {p.paused && trigger.data && (
            <Warnings className="mb-3" items={['La carga está en pausa: la ejecución lanzada quedará en cola hasta que la reanudes.']} />
          )}
          {shown ? <RunDetail key={shown.run_id} dagId={p.dag_id} run={shown} /> : <p className="text-xs text-ink-3">Sin ejecuciones todavía.</p>}
        </div>
      )}
    </li>
  )
}

export function PipelinesPanel({ data, focus }: { data: AdminPipelines; focus: string | null }) {
  const [open, setOpen] = useState<string | null>(focus)
  if (!data.reachable) return <Warnings items={data.warnings} />
  return (
    <div className="space-y-4">
      <Warnings items={data.warnings} />
      <Card
        title="Cargas (DAGs de Airflow)"
        subtitle={
          <>
            {data.running ? `${data.running} en curso: se refresca cada 5 s.` : 'Se refresca cada 20 s.'} Cada cuadro es una ejecución (la más reciente a la izquierda); pulsa una para ver sus tareas y logs.
          </>
        }
        actions={
          <a href={data.airflow_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
            Abrir Airflow <ExternalLink size={12} aria-hidden />
          </a>
        }
        bodyClassName="p-0 pt-2"
      >
        <ul className="divide-y divide-line">
          {data.pipelines.map((p) => (
            <PipelineRow key={p.dag_id} p={p} open={open === p.dag_id} onToggle={() => setOpen((o) => (o === p.dag_id ? null : p.dag_id))} />
          ))}
        </ul>
        {data.pipelines.length === 0 && <p className="px-4 pb-4 text-xs text-ink-3">{DASH} Airflow no tiene DAGs activos.</p>}
      </Card>
    </div>
  )
}
