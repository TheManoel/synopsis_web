---
name: project_symbols
description: "Sección Símbolos: análisis gráfico de un activo (indicadores del core por spec), watchlist en YAML, buscador ⌘K, fuerza relativa (percentil guardado + referencias), etapa de Minervini, lectura técnica y resultados; decisiones y límites"
metadata:
  type: project
---

# Símbolos (análisis de un activo)

- **Estado**: v1 el 2026-11-25 (`/simbolos/:key`), datos reales. Front en `feature/grupos-rotacion`; core en `feature/synopsis` (commits e5553e2 front, c59656b core).
- **Leer si**: tocas `/simbolos`, añades un indicador, la watchlist o el buscador
- **Código**: front `src/pages/SymbolsPage.tsx`, `src/components/symbols/*`, `src/lib/chartPrefs.ts`,
  `src/lib/symbolNav.ts`; core `src/core/symbols/` (domain/indicators.py, services/*, ports/directory.py),
  `src/infrastructure/persistance/sql_symbol_directory.py`, `src/applications/synopsis/symbols_service.py`

**Indicadores = catálogo cerrado del core** (`domain/indicators.py`, 25: tendencia, momento,
volatilidad, volumen, fuerza relativa, distancias). El gráfico los pide por **spec** posicional
`id:v1,v2` (`sma:50`, `rs_line:sector,50`); el core valida en palabras (422) y no recorta. Una
petición por indicador (`useQueries`): añadir uno solo trae ese. Periodos en barras del marco
(SMA 50 semanal = 50 semanas). El motor compone primitivas existentes (`NativeIndicatorCalculator`:
RSI/DMI Wilder, ATR = SMA del TR, OBV, MFI, CCI, %R; `TRANSFORM_REGISTRY` sma/ema/stdev; Mansfield
de `stage_analysis`). **Añadir uno** = entrada en `INDICATORS` + rama en `indicator_engine.compute`
(el test recorre todo el catálogo).

**Fuerza relativa, tres lecturas**: (1) percentil del universo del histórico guardado
(`analytics.rs_member_lens`, solo miembros actuales de SPX500/EUROSTOXX600; va ~1 semana por
detrás de los precios y se avisa), frase redactada por el core (`rs_reading`); (2) tabla frente a
índice regional + ETF de sector e industria (`ods.sector_benchmark`/`industry_benchmark` del
universo), con «relativa» = cambio de la línea RS (multiplicativo, no resta de pp); (3) en el
gráfico, `rs_line` / `mansfield` / `rs_rank`. Alinear una referencia: as-of dentro del mismo
periodo (día/semana ISO/mes), nunca arrastrar un cierre entre periodos.

**Etapa**: `classify_stages` sobre los últimos 6 años (histéresis dependiente del camino: avisado
en `note`); se muestra `contested` cuando otra etapa puntúa más.

**Watchlist**: `config/synopsis/user/watchlist.yaml` del core (como las estrategias de usuario;
fuera de git), PUT con la lista entera ordenada; optimista en el front. Admite claves `ratio:`/`spread:`
del catálogo. NO usa `analytics.user_favorite` (31 favoritos del front anterior) a propósito
(ver [[feedback_fresh_start]]); importarlos sería decisión del usuario.

**Front**: preferencias del gráfico (marco, ventana, velas/línea, log, indicadores con su `slot`
de color) en localStorage `synopsis.symbols.chart`; último símbolo en `synopsis.symbols.last`.
`TimeChart` ganó `rangeKey` (conserva el zoom al añadir indicadores; se guarda en el evento de
rango, no al desmontar: `fitContent` es perezoso), `notes` (texto de eventos al pasar el cursor) y
color por barra en histogramas (volumen por signo de la vela, tokens `--up-vol/--down-vol`).
Paleta global Ctrl/⌘+K (`CommandPalette` en `Shell`).

**Pestaña Backtest** (2026-11-25; `Análisis | Backtest`, en localStorage `synopsis.symbols.view`):
`SymbolBacktest` ejecuta una plantilla o estrategia guardada del lab sobre el símbolo (ajustes en
`synopsis.symbols.backtest`; al cambiar de símbolo se repite con los mismos). Las reglas se escriben
en el Strategy Lab, aquí no. Debajo del precio, «¿Por qué (no) dio señal?» (`DiagnosisPanel`, ver
[[project_strategy_lab]]). Ratios/diferenciales: no se ofrece.

**Límites / siguiente**: S/R y zonas (el `zone_book` está atado al grafo de features), Ichimoku
(spans al futuro), comparar varios símbolos superpuestos, estacionalidad (`core/seasonality`
existe), ficha fundamental más allá del BPA (ventas, dividendos), enlazar desde Índices/Grupos a
`/simbolos/:key`, watchlist plegable en móvil, varias listas.
