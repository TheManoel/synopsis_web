---
name: project_admin_panel
description: "Panel de administración /sistema: servicios Docker (start/stop/restart), BD (tamaño, frescura de datasets), cargas de Airflow (lanzar, pausar, tareas y logs) y fuentes externas (Montoya Substack, McClellan)"
metadata:
  type: project
---

# Panel de administración (/sistema)

- **Estado**: hecho el 2026-11-26. `npm run dev:all` es el único comando: el resto (BD,
  Airflow, cargas) se opera desde la web.
- **Leer si**: tocas el panel, añades un servicio/dataset/fuente o un DAG nuevo
- **Código**: core `src/core/operations/` (modelos, puertos, `services/health.py` = reglas de
  nivel, `services/catalog.py`), `config/operations/system.yaml` (servicios + datasets),
  adaptadores `src/infrastructure/operations/{docker_compose,airflow_rest}.py`,
  `persistance/sql_database_inspector.py`, `sql_external_sources.py`, app
  `applications/synopsis/admin_{service,routes}.py`, tests `tests/unit/operations/`;
  front `pages/AdminPage.tsx`, `components/admin/*`, `lib/adminLevels.ts`

**Seguridad**: el router `/api/v2/admin` solo se monta con `SYNOPSIS_ADMIN=1` (lo pone
`scripts/dev.sh`) y solo atiende desde loopback. Sin la variable → 404 y el front explica cómo
activarlo. En prod (core-api tras cloudflared) NO se activa.

**Docker**: CLI `docker compose --project-directory ../screener_data` (`SCREENER_DATA_DIR`).
Solo start/stop/restart de contenedores existentes; nunca up/down/build/rm (recrear pierde
paquetes instalados a mano y relanza airflow-init). Acciones según estado (core decide);
stop/restart piden confirmación con `stop_warning` del YAML.

**Airflow**: API REST `/api/v1` con basic auth (`admin/admin`; `AIRFLOW_API_URL/USER/PASSWORD`).
Requirió `auth_backends = …basic_auth,…session` en `screener_data/airflow/airflow.cfg` (CRLF!).
`next_dagrun` es la fecha LÓGICA: la ejecución se crea en `next_dagrun_create_after`.
Lanzar desde el panel adelanta la fecha lógica 60 s (mismo motivo que el backdate de
`shared/orchestration.py`: reloj de WSL). DAG nuevo = pausado al crearse
(`dags_are_paused_at_creation`) y Airflow tarda hasta 5 min en verlo (`dag_dir_list_interval`).
El panel cruza cada DAG con su fila de `etl.ingestion_run` (nombre del artefacto = dag_id):
filas, error, `parameters.warnings/errors` → avisos.

**BD**: la app arranca y el panel responde con la BD parada (nada toca la BD al registrar),
para poder arrancarla desde la web. Frescura: `sessions` cuenta sesiones del SPX
(`ods.ohlcv`, filtro fijo del YAML) posteriores al último dato; la referencia misma se mide
en días laborables sin festivos. `max(bar_date)` siempre con filtro: `ods.ohlcv` no tiene índice
que empiece por fecha.

**Niveles** (core): ok · running · warn · down · idle; al resumir una sección `idle` (parado
a propósito, p. ej. pgAdmin) no empeora un `ok`.

**Fuentes**: Montoya → [[project_external_reports]] (cookie `substack.sid` como Variable de
Airflow `montoya_substack_sid`, se pega desde el panel). McClellan → PDF en carpeta.

**Pendiente/conocido**: pgAdmin se cae al arrancar (rechaza `admin@screener.local` del compose,
dominio reservado) — fallo previo, no del panel. Sin backups ni migraciones desde el panel.
