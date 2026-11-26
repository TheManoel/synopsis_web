---
name: feedback_table_naming
description: "Las tablas se nombran por dominio (opciones, informes), no por proveedor; el feed/proveedor va como columna"
metadata:
  type: feedback
---

# Tablas por dominio, el feed como columna

- **Estado**: vigente (2026-11-26)
- **Leer si**: creas una tabla o migración para datos de una fuente externa
- **Código**: `../screener_data/database/migrations/`

El usuario no quiere `ods.montoya_post`: si mañana entra otro feed de opciones, el nombre no
encaja. Quiere renombrarla en algún momento (p. ej. `ods.analyst_post` o similar) con el feed
(`montoya`, …) como columna. No es urgente, pero las tablas NUEVAS ya deben nacer así (la de
niveles de opciones: dominio + columna `feed`, nunca `montoya_levels`).

**Why:** el dominio (opciones, informes de analista) es estable; los proveedores cambian.
**How to apply:** al proponer DDL, nombre por dominio + columna de origen/feed; el renombrado de
`ods.montoya_post` se hace con OK del usuario (DDL) junto con el DAG, el core y el panel.
Ver [[project_external_reports]].
