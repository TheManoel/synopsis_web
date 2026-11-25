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
  `markets_service.py`, `rotation_service.py`, `options_service.py`, `strategy_service.py` y `symbols_service.py` (todo en `../screener_core`)

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
| `GET /strategy-lab/catalog` | — | plantillas `config/strategy_lab/*.yaml` + guardadas `user/*.yaml` + instrumentos `price` + `vocabulary` del editor (con `starter`, `params`/`any_scale` por condición) + `warnings` |
| `POST /strategy-lab/rules` | `{strategy, params}` o `{rules}` | composición editable + textos + series (etiqueta/escala) + calentamiento; 422 en palabras |
| `POST /strategy-lab/strategies` | `{label, description, rules, based_on, replace_id}` | escribe `config/strategy_lab/user/<id>.yaml`; 409 si el nombre existe |
| `DELETE /strategy-lab/strategies/{id}` | — | solo estrategias `origin: user` (204) |
| `POST /strategy-lab/backtest` | `BacktestRequestDTO`: `{strategy, params}` o `{rules, label}` | `core/strategy_lab/services/backtester` (422 = valores rechazados, en palabras); devuelve `rules` |
| `GET /symbols/indicators` | — | catálogo `core/symbols/domain/indicators.py` + marcos y ventanas |
| `GET /symbols/search` | `q`, `limit` | `SqlSymbolDirectory.candidates` + `core/symbols/services/search.rank_hits` |
| `GET/PUT /symbols/watchlist` | PUT `{keys}` (lista entera) | `watchlist_store` (YAML) + `compute_reading` por clave |
| `GET /symbols/{key}` | — | ficha: lectura, técnica, referencias, tabla relativa, percentil RS, etapa, BPA (caché 10 min) |
| `GET /symbols/{key}/chart` | `timeframe` d\|w\|m, `range` 3m…max | OHLCV columnar + eventos de resultados |
| `GET /symbols/{key}/indicator` | `spec`, `timeframe`, `range` | `indicator_engine.compute` (422 = spec rechazada) |

Claves de instrumento: `TICKER@MIC` (`^SPX@CBOE`), `ratio:<code>`, `spread:<code>`.
Siempre con `encodeURIComponent` (llevan `^`, `=` y `@`).

Unidades (`kind`): `price` → % · `yield` → pb · `spread` → nivel y cambios en pb · `level` →
puntos. `from_high` y `dist_sma50/200` ya vienen en la unidad del `kind`.
`session_in_progress` = la barra es de una sesión aún abierta (FX y futuros, corte 17:00 NY).
