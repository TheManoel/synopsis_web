---
name: project_strategy_lab
description: "Strategy Lab: estrategias como plantillas de reglas sobre el grafo de features y su backtest en un activo frente a comprar y mantener; Golden Cross como primera plantilla; convenciones y límites"
metadata:
  type: project
---

# Strategy Lab

- **Estado**: v1 el 2026-11-24; editor de reglas + estrategias guardadas + «Nueva estrategia» (sin
  plantilla) + Bollinger/percentil/divergencias el 2026-11-24; ancla del máx./mín. y zona de puntos
  el 2026-11-25 (front en `feature/grupos-rotacion`, core en `feature/synopsis`). Una plantilla: Golden Cross.
- **Leer si**: tocas `/strategy-lab`, añades una estrategia, un tipo de serie o de condición
- **Código**: front `src/pages/StrategyLabPage.tsx`, `src/components/strategy/RulesEditor.tsx`; core
  `src/core/strategy_lab/` (`domain/rules.py` vocabulario, `services/rules_compiler.py`,
  `services/user_strategies.py`, `domain/strategy.py`, `services/catalog.py`, `services/backtester.py`),
  `config/strategy_lab/*.yaml` (+ `user/`), `src/applications/synopsis/strategy_service.py`

**Qué es**: la capa de backtest que el Estudio de scans dejaba pendiente. Una estrategia =
features del motor + regla de entrada + regla de salida (`ConditionGroup`), una posición a la vez.
El lab compone, no calcula: features con `strategy_engine`, cada operación con el walker de
`forward_returns` (la salida por regla es un `ExitCondition` nuevo), equity/drawdown/CAGR/Sharpe/
periodos/benchmark con `simulate_portfolio` (1 hueco, 1 sorteo), estadísticas con
`pool_trade_records`. Propio del lab: la secuenciación y los costes (aplicados a los registros
antes de que nada los lea: tabla = estadísticas = equity).

**Reglas compuestas** (`domain/rules.py`): vocabulario cerrado propio del lab, no el grafo crudo.
Series (precio, SMA/EMA —también sobre otra serie, `of`—, RSI, ROC %, máx./mín. de las N sesiones
*anteriores* —del máximo/mínimo o de otra serie; con «Anclar el nivel»—, zona de puntos
(`zone` → `point_zone`: cualquier congestión de máximos/mínimos), techo / suelo (`extreme` →
`extreme_zone`: los K máximos más altos del intervalo dentro de la tolerancia, centroide ± tolerancia), banda de Bollinger sup./media/inf. (SMA ± k·σ
poblacional; admite `of`), anchura de Bollinger (`bb_width`, %, solo precio), percentil de N
sesiones (0–100, `percentile` del motor contra una línea cero ×100)), cada una con su escala (`price`/`points`/`percent`: solo se comparan series de la
misma escala). Condiciones: cruza por encima/debajo, por encima/debajo, `distance_above/below`
(separación mínima en % = la «extensión» que confirma en vez del cruce), con `bars` = N sesiones
seguidas (en cruces entre series, `confirm_bars` del `cross`). Grupos todas/alguna anidados
(máx. 3 niveles, 16 condiciones, 8 series = 8 colores). El compilador traduce a features del motor
(`cross` → ==±1, `diff` → >/<0, `distance_pct` → ≥/≤±X; divergencias → estado de
`bullish/bearish_extremes_divergence` ==1, A = oscilador, B = referencia; helpers `_hN` compartidos) y valida con
el `FeatureResolver`; los textos los redacta el core. Golden Cross compilado = mismas 34/95
operaciones que el grafo escrito a mano (verificado sobre SPX 1960-2026).

**Ruptura confirmada = nivel fijo** (caso SPX sept-2010): «cierre por encima de Máx. N sesiones
durante 2» sin ancla exige dos MÁXIMOS nuevos seguidos (la ventana rueda e incluye el día de la
ruptura) → señal 13-oct. El usuario lo resolvió así (2026-11-25), retirando «Último máximo/mínimo
(puntos)»:
- **Ancla** (casilla, `KindParam` tipo `bool`): en una condición de K sesiones el nivel es el de
  antes de la racha (mín(A, K) > máx. de las N sesiones anteriores a las K). Solo como B; sin `of`
  (el front no ofrece una serie anclada en «sobre»).
- **Nivel → techo/suelo → estrategia** (usuario 2026-11-25). «Zona de puntos» = cualquier
  congestión de los puntos del detector a la tolerancia (zonas a 100, 97, 94, 90: todas), con
  vida tras la ruptura. «Techo / suelo» = los K puntos más extremos del intervalo si el K-ésimo
  está a la tolerancia del más extremo; zona = centroide ± tolerancia; nada más (sin toques,
  rupturas ni vida: el usuario pidió no sobrediseñar). SPX 2010 en máximos, 40 ses., K=2:
  21-jun + 9-ago. Rectángulo/triángulo como series: más adelante.

**Gráfico de precio = velas** (2026-11-25). Un techo/suelo (`overlay.shape == 'zones'`) no se
pinta como línea: `TimeChart` recibe `pane.zones` y `ZonesPrimitive` (`charts/zonePrimitive.ts`,
primitiva de serie de lightweight-charts) dibuja cada episodio del core —discontinuo mientras se
forma (desde su primer punto), sólido desde que es el nivel (marca vertical)— y un punto por cada
máximo (mínimo) que lo forma. Su línea queda oculta (`hidden`) solo para el valor de la leyenda; al pasar el cursor se
muestra el `text` del episodio (lo redacta el core). Velas y marcadores: `candles` admite `markers`.

**Params condicionales**: `KindParam.applies_when = (param, valores)` (DTO `{param: [valores]}`);
el core rechaza un param que no aplica, el front lo oculta y lo quita (`settle` en RulesEditor).

**Divergencias** (`bullish_divergence`/`bearish_divergence`): única condición con `any_scale` (B
de cualquier escala) y `params` propios (ventana, separación, retroceso mínimo %): las condiciones
llevan ahora `params` genéricos como las series (`KindParam` admite `float`). Detector de extremos
por ventana del motor (sin retraso de pivote), es un estado: se cumple mientras dura.

**Nueva estrategia**: `vocabulary.starter` (cierre × SMA 50) abre el editor sin plantilla
(`form.strategy = NEW`, `template = null`); se guarda con `based_on: null`.

**Plantillas y guardadas**: una plantilla = composición con `$param`; una estrategia del usuario =
composición sin params en `config/strategy_lab/user/<slug>.yaml` (mismo formato, `based_on`).
Plantillas rotas fallan al arrancar; guardadas rotas se omiten y se avisa (`catalog.warnings`).
Las plantillas son de solo lectura (guardar como nueva); las del usuario se sobrescriben o borran.

**Front**: «Editar reglas» abre la composición (POST `/rules` con los params actuales) en una
tarjeta sobre los resultados; cada cambio se comprueba con debounce 300 ms (etiquetas, frases,
rechazos en palabras). El backtest viaja como `{rules, label}`. Color de serie = índice en la
composición (`seriesColor`), igual en editor y gráfico; series no-precio en paneles propios.

**Añadir una estrategia** = un YAML en `config/strategy_lab/` (o guardarla desde el editor).
**Añadir un tipo de serie/condición** = `SERIES_KINDS`/`CONDITION_OPS` en `rules.py` + su
traducción en `rules_compiler.py` + `series_label`/`describe_condition`; el front lo lee del vocabulario.

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

**Siguiente**: stops/objetivos/salida por tiempo como bloques de salida (el walker ya tiene
`ExitLevel`), cortos (`SIDES` solo ofrece largo), más series (ATR, ADX, volumen), divergencias
por pivotes (las del motor con confirmación), rectángulo/triángulo como series (techo/suelo de
patrón), condiciones sobre la pendiente («la media sube N sesiones»), varios activos (el simulador ya admite
N huecos).
