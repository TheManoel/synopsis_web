import { useSearchParams } from 'react-router'
import { DatabasePanel } from '../components/admin/DatabasePanel'
import { LevelDot } from '../components/admin/common'
import { levelLabel } from '../lib/adminLevels'
import { PipelinesPanel } from '../components/admin/PipelinesPanel'
import { ServicesPanel } from '../components/admin/ServicesPanel'
import { SourcesPanel } from '../components/admin/SourcesPanel'
import { ErrorState, PageHeader, Segmented, Skeleton } from '../components/ui'
import { ApiError, useAdminDatabase, useAdminPipelines, useAdminSources, useAdminSystem } from '../lib/api'
import type { AdminLevel } from '../lib/types'

type Tab = 'servicios' | 'bd' | 'cargas' | 'fuentes'
const TABS: Tab[] = ['servicios', 'bd', 'cargas', 'fuentes']

function Disabled() {
  return (
    <div className="card max-w-2xl space-y-2 p-5 text-sm text-ink-2">
      <div className="font-medium text-ink">El panel de administración no está activo en esta API</div>
      <p>
        Controla contenedores y lanza cargas, así que la API solo lo monta con <span className="font-mono">SYNOPSIS_ADMIN=1</span> y solo atiende
        desde este equipo. <span className="font-mono">npm run dev:all</span> ya lo activa: si arrancaste la API de otra forma, reiníciala con ese
        comando.
      </p>
    </div>
  )
}

const tabLabel = (name: string, level?: AdminLevel, extra?: string) =>
  `${name}${level && level !== 'ok' && level !== 'idle' ? ` · ${extra ?? levelLabel(level).toLowerCase()}` : ''}`

/** Un solo sitio para operar el sistema: servicios Docker, BD, cargas de Airflow y fuentes externas. */
export function AdminPage() {
  const [params, setParams] = useSearchParams()
  const tab = (TABS.includes(params.get('tab') as Tab) ? params.get('tab') : 'servicios') as Tab
  const focus = params.get('dag')

  const system = useAdminSystem()
  const disabled = system.error instanceof ApiError && system.error.status === 404
  const database = useAdminDatabase(!disabled)
  const pipelines = useAdminPipelines(!disabled)
  const sources = useAdminSources(!disabled && tab === 'fuentes')

  const go = (next: Tab, dag?: string) => setParams(dag ? { tab: next, dag } : { tab: next }, { replace: false })

  const p = pipelines.data
  const options = [
    { value: 'servicios' as Tab, label: tabLabel('Servicios', system.data?.level) },
    { value: 'bd' as Tab, label: tabLabel('Base de datos', database.data?.level) },
    { value: 'cargas' as Tab, label: tabLabel('Cargas', p?.level, p?.running ? `${p.running} en curso` : undefined) },
    { value: 'fuentes' as Tab, label: 'Fuentes externas' },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Sistema"
        title="Administración"
        subtitle="Servicios, base de datos y cargas en un solo sitio: arranca y para contenedores, lanza y sigue las cargas, y gestiona las fuentes externas sin pasar por la terminal."
      >
        {system.data && <LevelDot level={system.data.level} text={`Servicios: ${levelLabel(system.data.level).toLowerCase()}`} />}
        {database.data && <LevelDot level={database.data.level} text={`BD: ${levelLabel(database.data.level).toLowerCase()}`} />}
        {p && <LevelDot level={p.running ? 'running' : p.level} text={p.running ? `${p.running} ${p.running === 1 ? 'carga' : 'cargas'} en curso` : `Cargas: ${levelLabel(p.level).toLowerCase()}`} />}
      </PageHeader>

      {disabled ? (
        <Disabled />
      ) : (
        <>
          <Segmented value={tab} options={options} onChange={(t) => go(t)} label="Sección del panel" />
          {tab === 'servicios' &&
            (system.error ? <ErrorState error={system.error} /> : system.data ? <ServicesPanel data={system.data} /> : <Skeleton className="h-[420px]" />)}
          {tab === 'bd' &&
            (database.error ? (
              <ErrorState error={database.error} />
            ) : database.data ? (
              <DatabasePanel data={database.data} onPipeline={(dag) => go('cargas', dag)} />
            ) : (
              <Skeleton className="h-[420px]" />
            ))}
          {tab === 'cargas' &&
            (pipelines.error ? <ErrorState error={pipelines.error} /> : p ? <PipelinesPanel key={focus ?? ''} data={p} focus={focus} /> : <Skeleton className="h-[420px]" />)}
          {tab === 'fuentes' &&
            (sources.error ? (
              <ErrorState error={sources.error} />
            ) : sources.data ? (
              <SourcesPanel sources={sources.data.sources} onPipeline={(dag) => go('cargas', dag)} />
            ) : (
              <Skeleton className="h-[420px]" />
            ))}
        </>
      )}
    </div>
  )
}
