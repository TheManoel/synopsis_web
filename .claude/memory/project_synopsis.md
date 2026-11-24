---
name: project_synopsis
description: "Estado de Synopsis (front nuevo): páginas hechas, backend asociado en screener_core, deuda abierta y próximos pasos"
metadata:
  type: project
---

# Synopsis · estado del proyecto

- **Estado**: v0 hecha el 2026-11-24. Cinco páginas operativas con datos reales; sin tests de front.
- **Leer si**: empiezas una sesión en este repo o vas a añadir una feature
- **Código**: `src/pages/*`, backend en `../screener_core/src/applications/synopsis/`

## Hecho (v0)

| página | ruta | endpoint principal |
|---|---|---|
| Índices | `/indices` | `/markets/sections/indices` |
| Amplitud NYSE | `/amplitud` | `/breadth/nyse` |
| Materias primas | `/materias-primas` | `/markets/sections/commodities` |
| Divisas y bonos | `/divisas-bonos` | `/markets/sections/rates_fx` |
| Opciones (PoC) | `/opciones` | `/options/spx/*` — ver [[project_options_poc]] |

La sección `volatility` del catálogo no tiene página propia: alimenta la cinta superior y el
contexto de volatilidad de Opciones. Detalle de endpoints en [[reference_api_v2]].

## Cómo se añade un instrumento

Solo editando `../screener_core/config/markets/catalog.yaml` (instrumento, `ratio` o `spread`).
Si el activo no existe en la BD hay que ingerirlo en screener_data (`asset_metadata_refresh` →
`load_assets_staging` → `load_assets_ods`).

## Deuda / pendiente

- Amplitud solo NYSE (por petición del usuario). El core ya lee NASDAQ y EUROSTOXX600.
- Opciones sin histórico de cadena (necesita tabla nueva → OK del usuario).
- `yfinance` no declarado en el `pyproject.toml` del core.
- Sin tests de front (ni unitarios ni e2e). Capturas manuales con playwright-core + el
  chromium-headless-shell de `~/.cache/ms-playwright`.
- La rama del core es `feature/synopsis` (sale de `refactor/motor-series`).
