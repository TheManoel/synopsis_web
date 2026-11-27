---
name: reference_api_v2
description: "Endpoints /api/v2 que consume Synopsis, sus parámetros y en qué módulo de screener_core se calcula cada cosa"
metadata:
  type: reference
---

# API v2 (screener_core)

- **Estado**: estable para v0; los DTO están reflejados en `src/lib/types.ts`
- **Leer si**: añades un endpoint, cambias un DTO o buscas dónde se calcula una cifra
- **Código**: rutas `src/applications/synopsis/routes.py`, DTO `models.py`, servicios
  `markets_service.py`, `rotation_service.py`, `options_service.py`, `strategy_service.py`, `symbols_service.py`, `rs_service.py`, `timing_service.py` y `admin_service.py` (+ `admin_routes.py`) (todo en `../screener_core`)

| endpoint | parámetros | cálculo en el core |
|---|---|---|
| `GET /markets/sections` | — | catálogo `config/markets/catalog.yaml` |
| `GET /markets/sections/{code}` | — | `core/markets/services/instrument_metrics.compute_reading` |
| `GET /markets/sections/{code}/groups/{g}/performance` | `bars` | `rebase` (base 100, inicio común) |
| `GET /markets/instruments/{key}/series` | `bars` | OHLC + SMA50/200 con warmup |
| `GET /breadth/nyse` | `bars` | `core/markets/services/breadth_board` |
| `GET /groups` | — | catálogo `config/markets/rotation.yaml` |
| `GET /groups/{u}/rotation` | `timeframe` weekly\|daily | RRG `spread_analysis` + `core/markets/services/group_rotation` |
| `GET /groups/{u}/relative/{sym}` | `bars` | ETF / índice, base 100 |
| `GET /groups/{u}/participation` | `lens` rs_1m\|3m\|12m | `RsPanelService.groups` (app signal_lab) |
| `GET /options/spx/summary` | `basis`, `max_days`, `refresh` | `core/options/services/chain_analytics` |
| `GET /options/spx/expiries/{date}` | `basis`, `band` | `expiry_detail` |
| `GET /options/spx/vol-context` | `bars` | `core/options/services/vol_context` |
| `GET /symbols/{key}/option-levels` | `as_of` | `option_levels_service.snapshot` → `core/options/services/analyst_levels` |
| `GET /symbols/{key}/option-levels/history` | `timeframe` (solo `d`), `range` | `option_levels_service.history` |
| `GET /strategy-lab/catalog` | — | plantillas `config/strategy_lab/*.yaml` + guardadas `user/*.yaml` + instrumentos `price` + `vocabulary` del editor (con `starter`, `params`/`any_scale` por condición) + `warnings` |
| `POST /strategy-lab/rules` | `{strategy, params}` o `{rules}` | composición editable + textos + series (etiqueta/escala) + calentamiento; 422 en palabras |
| `POST /strategy-lab/strategies` | `{label, description, rules, based_on, replace_id}` | escribe `config/strategy_lab/user/<id>.yaml`; 409 si el nombre existe |
| `DELETE /strategy-lab/strategies/{id}` | — | solo estrategias `origin: user` (204) |
| `POST /strategy-lab/backtest` | `BacktestRequestDTO`: `{strategy, params}` o `{rules, label}` | `core/strategy_lab/services/backtester` (422 = valores rechazados, en palabras); devuelve `rules` |
| `POST /strategy-lab/diagnose` | petición del backtest + `window_start`, `window_end` | `core/strategy_lab/services/diagnosis` (traza por sesión, márgenes, veredicto; 422 = ventana inválida) |
| `GET /strategy-lab/universes` | — | universos con acciones + sectores/industrias nombrados + nota de membresía + huecos/sorteos por defecto |
| `POST /strategy-lab/universe-backtest` | petición del backtest sin `instrument` + `universe`, `sectors`, `industries`, `slots`, `draws` | 202 + tarea (422/404 antes de encolar); `core/strategy_lab/services/universe_backtest` |
| `GET` / `DELETE /strategy-lab/universe-backtest/{id}` | — | estado (`queued/running/done/failed/cancelled`, `stage`, `done/total`) y `result` al acabar; DELETE cancela; 404 si caducó o se reinició la API |
| `POST /strategy-lab/universe-screen` + `GET`/`DELETE …/{id}` | regla (`strategy`/`params` o `rules`) + `universe`, `sectors`, `industries`, `lookback`, `live` | tarea como el backtest; `result` = señales en la última sesión (`core/strategy_lab/services/universe_screen`) |
| `GET /symbols/indicators` | — | catálogo `core/symbols/domain/indicators.py` + marcos y ventanas |
| `GET /symbols/search` | `q`, `limit` | `SqlSymbolDirectory.candidates` + `core/symbols/services/search.rank_hits` |
| `GET/PUT /symbols/watchlist` | PUT `{keys}` (lista entera) | `watchlist_store` (YAML) + `compute_reading` por clave |
| `GET /rs/universes` | — | calendario guardado + retraso frente a la base (`board.sessions_after`) |
| `GET /rs/{u}/board` | `as_of`, `delta` 5\|21\|63 | barra guardada entera: `group_rows_from` + `board.excess_breadth`; 422 si la fecha precede al histórico |
| `GET /rs/{u}/groups/{scope}/{code}/history` | `range`, `as_of` | `rs_group_bar` (80/20), semanal si > 3 años (`board.weekly_last`) |
| `GET /rs/{u}/heatmap` | `scope`, `sector`, `lens`, `weeks` ≤ 260, `as_of` | media semanal por grupo |
| `GET /rs/members/{key}/history` | `universe`, `range`, `as_of` | `rs_member_lens` + `rs_member_bar`; sin histórico → `universe: null` + aviso |
| `GET /symbols/{key}` | — | ficha: lectura, técnica, referencias, tabla relativa, percentil RS, etapa, BPA (caché 10 min) |
| `GET /symbols/{key}/chart` | `timeframe` d\|w\|m, `range` 3m…max | OHLCV columnar + eventos de resultados |
| `GET /symbols/{key}/timing` | `timeframe`, `range` | `TimingService.for_symbol`: Timing Models de McClellan en el calendario del gráfico, `future_dates` (ver [[project_external_reports]]) |
| `GET /timing/mcclellan` | — | tablero del último informe + avisos (informe siguiente atrasado) |
| `GET /admin/system` · `POST /admin/services/{name}/{start\|stop\|restart}` · `GET …/logs` | `tail` | `AdminService` + `DockerComposeRuntime` (solo con `SYNOPSIS_ADMIN=1`, loopback; ver [[project_admin_panel]]) |
| `GET /admin/database` | — | `SqlDatabaseInspector` + `core/operations/services/health.freshness` |
| `GET /admin/pipelines` · `…/runs/{run}` · `…/tasks/{task}/log` · `POST …/trigger` · `POST …/pause` | `try_number` | `AirflowRestOrchestrator` + `etl.ingestion_run` |
| `GET /admin/sources` · `PUT/DELETE /admin/sources/montoya/credential` | — | Montoya (Substack) y McClellan; cookie = Variable de Airflow |
| `GET /symbols/{key}/indicator` | `spec`, `timeframe`, `range` | `indicator_engine.compute` (422 = spec rechazada) |

Claves de instrumento: `TICKER@MIC` (`^SPX@CBOE`), `ratio:<code>`, `spread:<code>`.
Siempre con `encodeURIComponent` (llevan `^`, `=` y `@`).

Unidades (`kind`): `price` → % · `yield` → pb · `spread` → nivel y cambios en pb · `level` →
puntos. `from_high` y `dist_sma50/200` ya vienen en la unidad del `kind`.
`session_in_progress` = la barra es de una sesión aún abierta (FX y futuros, corte 17:00 NY).

**Precio actual (2026-11-26)**: todos los servicios de Synopsis leen precios vía
`applications/synopsis/live_bars.LiveBarsRepository` (montado en `routes._live_config`): historia
de la BD + barras **provisionales** de Yahoo (`yf.download` 1mo, lote, TTL 60 s) para las sesiones
que la BD aún no tiene, incluida la de hoy; símbolo Yahoo desde `ods.provider_ticker_map`. Nunca
sustituye barras guardadas salvo la última si es de sesión abierta; base vacía → no inventa
historia. Amplitud usa `get_stored_history` (alineada con sus snapshots). DTO: `live`
(`LiveQuoteDTO`) en tarjeta, serie y gráfico de símbolo; si Yahoo falla → `warnings`. El front
refresca cada 60 s y `TimeChart current live` pinta la línea de precio y la insignia.
