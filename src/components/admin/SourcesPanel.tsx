import { CheckCircle2, CircleDashed, ExternalLink, KeyRound, Play } from 'lucide-react'
import { useState } from 'react'
import { useMontoyaCredential, useTriggerPipeline } from '../../lib/api'
import { fmtDate, fmtDateTime } from '../../lib/format'
import type { AdminSource } from '../../lib/types'
import { Card, ErrorState, Pill, Warnings } from '../ui'
import { ActionButton, LevelDot } from './common'

function Credential({ source }: { source: AdminSource }) {
  const cred = source.credential!
  const save = useMontoyaCredential()
  const [value, setValue] = useState('')
  return (
    <div className="rounded-lg border border-line bg-surface-2 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <KeyRound size={13} className="text-ink-3" aria-hidden />
        <span className="font-medium text-ink">{cred.label}</span>
        {cred.configured == null ? (
          <Pill tone="warn">sin comprobar</Pill>
        ) : cred.configured ? (
          <Pill tone="up">guardada</Pill>
        ) : (
          <Pill>sin cookie: solo vista previa</Pill>
        )}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-3">{cred.hint}</p>
      <form
        className="mt-2 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (value.trim()) save.mutate(value.trim(), { onSuccess: () => setValue('') })
        }}
      >
        <input
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={cred.configured ? 'Pegar otra para sustituirla' : 'Valor de substack.sid'}
          className="min-w-[240px] flex-1 rounded-lg border border-line bg-surface px-2.5 py-1 font-mono text-xs text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
        <button type="submit" disabled={!value.trim() || save.isPending} className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-canvas hover:opacity-90 disabled:opacity-50">
          Guardar
        </button>
        {cred.configured && (
          <ActionButton tone="danger" busy={save.isPending && save.variables == null} onClick={() => window.confirm('¿Quitar la cookie? Los posts nuevos de pago llegarán solo con la vista previa.') && save.mutate(null)}>
            Quitar
          </ActionButton>
        )}
      </form>
      {save.error && (
        <div className="mt-2">
          <ErrorState error={save.error} />
        </div>
      )}
    </div>
  )
}

function SourceCard({ s, onPipeline }: { s: AdminSource; onPipeline: (dagId: string) => void }) {
  const trigger = useTriggerPipeline()
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          {s.label} <Pill>{s.channel}</Pill>
        </span>
      }
      subtitle={s.description}
      actions={
        <>
          <LevelDot level={s.level} />
          <ActionButton tone="accent" busy={trigger.isPending} onClick={() => trigger.mutate(s.pipeline, { onSuccess: () => onPipeline(s.pipeline) })}>
            {!trigger.isPending && <Play size={12} aria-hidden />} Cargar ahora
          </ActionButton>
        </>
      }
      bodyClassName="space-y-3 p-4"
    >
      <Warnings items={s.warnings} />
      {trigger.error && <ErrorState error={trigger.error} />}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
        {s.counts.map((c) => (
          <span key={c.key} className="text-ink-3">
            {c.key}: <span className="num font-medium text-ink">{c.value}</span>
          </span>
        ))}
        <button type="button" onClick={() => onPipeline(s.pipeline)} className="font-mono text-[11px] text-accent hover:underline">
          {s.pipeline}
        </button>
      </div>
      {s.credential && <Credential source={s} />}
      {s.items.length > 0 ? (
        <ul className="divide-y divide-line text-xs">
          {s.items.map((it) => (
            <li key={`${it.published}${it.title}`} className="flex items-start gap-2 py-1.5">
              {it.complete ? (
                <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-up" aria-label="Completo" />
              ) : (
                <CircleDashed size={13} className="mt-0.5 shrink-0 text-warn" aria-label="Solo vista previa" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-ink" title={it.title}>
                  {it.url ? (
                    <a href={it.url} target="_blank" rel="noreferrer" className="hover:underline">
                      {it.title} <ExternalLink size={10} className="inline text-ink-3" aria-hidden />
                    </a>
                  ) : (
                    it.title
                  )}
                </div>
                <div className="text-[11px] text-ink-3">
                  {it.kind} · {it.published.length === 10 ? fmtDate(it.published) : fmtDateTime(it.published)} · {it.detail}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-ink-3">Aún no ha entrado nada de esta fuente.</p>
      )}
    </Card>
  )
}

export function SourcesPanel({ sources, onPipeline }: { sources: AdminSource[]; onPipeline: (dagId: string) => void }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {sources.map((s) => (
        <SourceCard key={s.code} s={s} onPipeline={onPipeline} />
      ))}
    </div>
  )
}
