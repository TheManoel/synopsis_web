---
name: project_analyst_option_levels
description: "Niveles de opciones de JJ Montoya (SpotGamma) sobre el gráfico del SPX: extracción point-in-time, alineación con ^SPX@CBOE, escalones y viaje en el tiempo"
metadata:
  type: project
---

# Niveles de opciones del analista (Montoya)

- **Estado**: hecho el 2026-11-26 (data cf2dbad/87c31aa, core 6dbe00c, front 0e8070a). Sustituye en
  el gráfico de Símbolos a nuestros niveles de yfinance (OK del usuario; siguen en /opciones).
- **Leer si**: tocas `ods.option_level`, el extractor, `/symbols/{key}/option-levels*` o el panel
- **Código**: data `airflow/dags/lib/option_levels.py` (+ tarea `extract_option_levels` en
  `load_montoya_posts`, migración 052); core `core/options/{domain,services}/analyst_levels.py`,
  `applications/synopsis/option_levels_service.py`; front `components/symbols/OptionLevelsPanel.tsx`,
  `optionLevelColors.ts`, `SymbolChart.tsx` (escalones), `TimeChart` (`step`, `onPick`)

**Tabla** `ods.option_level`: por dominio con `feed` ('montoya'); una fila por post × subyacente ×
ámbito (all/0dte/session/week/prior) × nivel; `evidence` = línea literal, `issues` = otras cifras del
mismo post. Lo que depende de NUESTROS datos (sesión, escala, cotejo) se decide en el core al leer.

**Extractor**: bloque canónico «Niveles de Gamma SPX:» en ~84 % de posts; listas con/sin emoji;
cada línea «clave número» vota y gana la mayoría (el bloque solo desempata: 2026-11-05 trae
«Volatility Trigger 7000.» frente a 7.700 en el resto). Lista sin cabecera = SPX (la mención cercana
atribuía mal: «VIX: 17» encima). Implícito: manda la línea-resumen «📐 Movimiento implícito…»;
se descartan las de acciones («- 03/02 SMCI:», «de Nvidia», «sus opciones»). Cierre declarado solo
en frases explícitas («cerró en», «cerró ayer en»): precisión antes que cobertura.

**Alineación** (la pregunta del usuario): su SPX = nuestro `^SPX@CBOE` (no ES, no SPY). Prueba
continua: el cierre que declara se coteja con nuestro cierre de la sesión previa (±0,1 %): 146/148 en
1 año. Sesión = primera cuyo cierre llega tras `published_at` (calendario NYSE; `eod_venue` mapea
`^SPX@CBOE`→XNYS desde este cambio); `late` si salió con la sesión abierta. Los títulos NO sirven
(«5 DE JULIO» publicado el 5-ago). Escala: muro a >±35 % del cierre previo = otro subyacente.

**Vigencia**: por nivel, lo último publicado; muros se arrastran ≤5 sesiones (luego hueco);
0DTE e implícito de sesión solo su sesión; implícito semanal, su semana ISO.

**Hallazgo de datos**: falta la barra del 2026-07-24 de `^SPX` y `^VIX` en `ods.ohlcv` (`^NDX` sí):
el cotejo lo delata. Pendiente de rellenar con la ingesta normal (pedir OK).
