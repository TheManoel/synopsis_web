---
name: project_strategy_lab
description: "Strategy Lab: estrategias como plantillas de reglas sobre el grafo de features y su backtest en un activo frente a comprar y mantener; Golden Cross como primera plantilla; convenciones y límites"
metadata:
  type: project
---

# Strategy Lab

- **Estado**: v1 hecha el 2026-11-24 (`/strategy-lab`), datos reales, sin commit (front en `feature/grupos-rotacion`, core en `feature/synopsis`). Una plantilla: Golden Cross.
- **Leer si**: tocas `/strategy-lab`, añades una estrategia o vas a construir el editor de reglas
- **Código**: front `src/pages/StrategyLabPage.tsx`; core `src/core/strategy_lab/`
  (`domain/strategy.py`, `domain/backtest.py`, `services/catalog.py`, `services/backtester.py`),
  `config/strategy_lab/*.yaml`, `src/applications/synopsis/strategy_service.py`

**Qué es**: la capa de backtest que el Estudio de scans dejaba pendiente. Una estrategia =
features del motor + regla de entrada + regla de salida (`ConditionGroup`), una posición a la vez.
El lab compone, no calcula: features con `strategy_engine`, cada operación con el walker de
`forward_returns` (la salida por regla es un `ExitCondition` nuevo), equity/drawdown/CAGR/Sharpe/
periodos/benchmark con `simulate_portfolio` (1 hueco, 1 sorteo), estadísticas con
`pool_trade_records`. Propio del lab: la secuenciación y los costes (aplicados a los registros
antes de que nada los lea: tabla = estadísticas = equity).

**Añadir una estrategia** = un YAML en `config/strategy_lab/` (`$param` en el grafo, `{param}` en
textos; se instancia con los defaults al arrancar, así que una plantilla rota falla al cargar).

**Convenciones** (las redacta el core, `describe_conventions`): reglas al cierre; ejecución
`open_t1` (por defecto, entrada y salida a la apertura siguiente) o `close_t`; empieza en
liquidez; costes por lado en pb (defecto 5); referencia = comprar y mantener el mismo activo sin
costes; sin dividendos ni intereses de la liquidez. Solo instrumentos `kind: price` del catálogo.

**Límites / avisos conocidos**:
- SPX en BD desde 1927, con O=H=L=C hasta ~1962 (y sueltos hasta 1983): se avisa con el recuento;
  ahí "apertura siguiente" es en realidad el cierre.
- Respuesta columnar (`series.dates` + arrays): el histórico completo del SPX pesa ~1,8 MB.
- `TimeChart` ganó `markers` y `logScale` por panel (la escala log se aplica por índice de panel;
  vía `series.priceScale()` contaminaba el panel de drawdown).

**Siguiente**: editor de reglas (componer features y condiciones desde el front), stops/objetivos
(el walker ya los tiene: `ExitLevel`), cortos, varios activos (el simulador ya admite N huecos).
