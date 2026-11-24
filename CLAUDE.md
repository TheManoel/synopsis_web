# Synopsis — synopsis_web

Front de estudio de mercados. React 19 + TypeScript + Vite + Tailwind v4 + TanStack Query +
lightweight-charts. Consume la API `/api/v2` de `../screener_core` (lógica de dominio, DDD +
hexagonal) que a su vez lee la BD que alimenta `../screener_data` (ETL Airflow → TimescaleDB).

Diseñado desde cero: **no usar `../signal_lab_web` como referencia** (ni código, ni componentes,
ni convenciones de UI). Ver memoria `feedback_fresh_start`.

## Comandos

```bash
npm run dev          # http://localhost:5180, proxy /api → :8899 (SYNOPSIS_API para otro destino)
npm run build        # tsc -b + vite build
npx oxlint src       # lint
# API (en ../screener_core):
API_ONLY=1 poetry run uvicorn src.applications.signal_lab.web.app:create_app --factory --port 8899
```

## Dónde vive qué

- `src/lib/` — `types.ts` (espejo de los DTO de `/api/v2`), `api.ts` (hooks de datos),
  `format.ts` (formato es-ES y por unidad), `theme.ts` (tema y variables CSS para canvas)
- `src/components/` — `Shell` (navegación + cinta), `ui.tsx` (primitivas), `charts/`
  (`TimeChart` series temporales multipanel; `xy.tsx` gráficos SVG: líneas y barras por strike)
- `src/pages/` — `MarketSectionPage` (índices, materias primas, divisas y bonos),
  `BreadthPage` (NYSE), `OptionsPage` (PoC SPX)
- Backend de este front en el core: `src/applications/synopsis/` (rutas + servicios),
  `src/core/markets/`, `src/core/options/`, `config/markets/catalog.yaml`

## Reglas

- **El front no calcula**: cualquier cifra derivada se añade al core y sale por `/api/v2`.
- **Unidades por tipo** (`kind`): price → %, yield → pb, spread → pb, level → puntos.
- **Sin fallos silenciosos**: los avisos del core (`warnings`) siempre se muestran.
- Colores solo vía tokens de `src/index.css`; series en el orden fijo validado (`--s1…--s8`).
- BD: nada de DDL ni escrituras destructivas sin OK del usuario.

## Memoria persistente de Claude

Vive en `.claude/memory/` (versionada; índice en `MEMORY.md`). En una máquina nueva:

```bash
mkdir -p ~/.claude/projects/-home-faltosu-git-synopsis-web
ln -s ~/git/synopsis_web/.claude/memory ~/.claude/projects/-home-faltosu-git-synopsis-web/memory
```

Cada memoria abre con **Estado / Leer si / Código**. `scripts/memory_lint.py` verifica las
invariantes (nombre = fichero, enlaces resolubles, tamaño, todo indexado); conviene engancharlo
al hook `Stop` en `.claude/settings.local.json`.
