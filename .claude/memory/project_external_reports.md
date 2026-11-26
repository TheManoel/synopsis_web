---
name: project_external_reports
description: "Informes de analistas (McClellan Timing Models, ciclos y COT; JJ Montoya opciones): qué se integra, cómo (dato externo point-in-time vs feature nativa), dónde se guardan los PDF y el plan por fases"
metadata:
  type: project
---

# Informes externos de analistas

- **Estado**: 2026-11-26: ingesta (screener_data aa193ff), ciclo del oro (d7d68b1), lectura +
  motor + API + overlay en Símbolos (7fb633d/c1dc866), página Informes con cotejo
  (5dece7f/4256097), COT como indicador de Símbolos (d1a48cf), niveles de opciones propios
  sobre el SPX (bb1c5e1/670cf6f). Montoya: ingesta de Substack a `ods.montoya_post` (migración
  051) el 2026-11-26; pendiente extraer sus niveles (revisado por el usuario) e histórico de cadena.
- **Leer si**: tocas McClellan, ciclos, COT de sus informes, niveles de opciones de Montoya
- **Código**: screener_data `airflow/dags/lib/mcclellan_timing.py` (parser puro + PyMuPDF),
  `orchestrators/mcclellan/load_mcclellan_reports.py`, `database/migrations/050_mcclellan_timing.sql`,
  `tests/test_mcclellan_timing.py`; core `src/core/timing_models/` (history = fotos point-in-time,
  series, catalog, book, engine_handler), `config/timing_models/mcclellan.yaml` (bloque →
  instrumentos), `applications/synopsis/timing_service.py`; front `components/symbols/TimingPanel.tsx`,
  `timingOverlay.ts`, `charts/eventLinesPrimitive.ts`, `pages/ReportsPage.tsx` (/informes);
  cotejo `core/timing_models/services/check.py`; niveles de opciones
  `options_service.levels_for_symbol` + `components/symbols/OptionLevelsPanel.tsx`

**Principio** (acordado con el usuario): no se discuten sus conclusiones, se visualizan y, más
adelante, se cotejan con nuestros datos. Lo calculable (osciladores, COT, ciclos) = feature
nativa del motor; lo propietario (fechas de los Timing Models, VT de SpotGamma, umbrales CTA) =
dato externo **point-in-time**, nunca recalculado (mismo patrón que el COT y su `release_ts`).

**McClellan**: PDF quincenal de pago con marca de agua del usuario → los descarga él a
`screener_data/airflow/data/mcclellan/` (gitignored; `/opt/airflow/data/mcclellan`). Página 6
fija. Bloques stocks/bonds/gold + BC (implícitos que se invierten, «Volatility Event», no
siempre presente). Negrita en la fecha = señal fuerte (solo en la fuente). Fechas sin año
(el más cercano al informe). Una fila por aparición en cada informe; `published_on` = desde
cuándo se sabe. Celdas raras: cluster «*», «- - -» (missed), «forming», «July 13/16».
PyMuPDF instalado a mano en el contenedor (`pip --user`); fijado en `airflow/requirements.txt`
→ se pierde si se recrea el contenedor hasta reconstruir la imagen.

**Ciclo del oro**: el ancla 2018-12-31 era el inicio del eje del gráfico «13-1/2 Month Cycle»
(#752), no un suelo. Medido el histograma: suelos 29-ene-2019 … 11-nov-2025 cada 413 días.
Ahora `wave`, 411 días naturales, ancla 2025-11-01 → suelos 26-may-2026 (mitad) y 17-dic-2026
(el que da McClellan en #756/#759), ±15 d frente a su gráfico. Otros ciclos citados: 8 años
(oro, techo a principios de 2028), presidencial (4 años), 5,31 años, 26 sesiones + lunas llenas.

**Core**: identidad de una previsión = (bloque, sentido, implícita, oscilador, fecha prevista);
si el autor mueve la fecha es otra. Fotos acumuladas por informe; en cada barra solo la del
último publicado. El motor (`timing_signal`: window/pulse/days_to_next, filtro de fuerza) ignora
previsiones FUTURAS retiradas por el autor. Solo conectado en el chart panel de signal_lab; el
Strategy Lab de Synopsis no materializa externas. `state` lo decide el core: `awaiting` = fecha
pasada tras el último informe (aún sin anotar) ≠ `unrecorded`.

**Front**: botón «McClellan» en el gráfico de Símbolos (solo si el activo está en un bloque),
pref `timing` off/all/strong. lightweight-charts no pinta marcadores sobre huecos (whitespace):
las fechas futuras van con `EventLinesPrimitive`, y con huecos `fitContent` ancla la última barra
al borde → se fija el rango lógico a mano.

**Cotejo**: giro = pivote de cierre (k = 3); hit ±2 / near ±5 sesiones en el `verify_on` del
bloque; SIEMPRE frente a la base (lo que acierta una sesión cualquiera del periodo, ~50 % a ±2).
Primer resultado (10 informes): índices 37 % vs 49 % de base; el resto ≈ base. Con pocas
previsiones es ruido: mostrar n.

**Ciclos**: son parte del estudio de estacionalidad → [[project_seasonality]].

**Montoya** (elegido Substack frente a Gmail: API JSON con id, fecha exacta, slug y audiencia;
idempotente y sin parsear correos): screener_data `lib/substack.py` (puro + cliente),
`orchestrators/montoya/load_montoya_posts.py` (cada hora 06–21 UTC), `tests/test_substack.py`,
migración `051_montoya_posts.sql` (OK del usuario a la tabla Y a guardar el texto, para
re-extraer sin volver a descargar). jjmontoya.substack.com: ~404 posts desde jul-2024 (100
abiertos, 304 `only_paid`). `/api/v1/archive` pagina por **cursor** (`nextCursor`): `offset` o
`limit` > 12 → 400. Sin cookie los de pago traen solo la vista previa (en las morning notes
incluye el TL;DR con niveles); «completo» = palabras ≥ 85 % del `wordcount` de Substack.
Cookie `substack.sid` → Variable de Airflow `montoya_substack_sid`, se pega en /sistema →
Fuentes; con cookie, la siguiente carga completa los incompletos (barrido entero del archivo).
El usuario se suscribió y pegó la cookie el 2026-11-26: la carga de las 13:20 UTC completó los de pago (vista previa → completo) hacia atrás. Fuentes externas no son solo estas dos: amplitud = suscripción a amplituddemercado.com (endpoint Apps Script), precios/metadatos = yfinance, COT = CFTC. Ver [[project_admin_panel]].

**Niveles de Montoya** (hecho 2026-11-26) → [[project_analyst_option_levels]].
**Pendiente**: histórico diario de nuestra cadena (DDL) para viajar en el tiempo también con
nuestros niveles y compararlos con los suyos. Ver [[project_options_poc]], [[feedback_core_computes]].
