# Synopsis · índice de memoria

## Empieza por aquí

- [Estado del proyecto y próximas features](project_synopsis.md) — qué hay hecho, qué falta y deuda abierta
- [API v2 del core](reference_api_v2.md) — endpoints, DTOs y dónde vive cada cálculo en screener_core

## Reglas de trabajo

- [Diseño desde cero](feedback_fresh_start.md) — no tomar nada de signal_lab_web; el diseño es propio
- [El front no calcula](feedback_core_computes.md) — toda cifra derivada nace en el core, con sus unidades y avisos

## Diseño

- [Sistema de diseño](reference_design_system.md) — tokens, paleta validada, componentes y gráficos

## Dominios

- [Grupos y rotación](project_groups_rotation.md) — RRG por universo, dos referencias (cesta vs índice), participación lenta en frío
- [Opciones (PoC SPX)](project_options_poc.md) — fuente, método, supuestos y limitaciones de la cadena
- [Símbolos](project_symbols.md) — análisis gráfico de un activo: indicadores del core por spec, watchlist YAML, ⌘K, fuerza relativa, etapa
- [Fuerza relativa](project_relative_strength.md) — histórico RS guardado por universo → sector → industria → valor, viaje en el tiempo, comparación; avisa el retraso del cron
- [Strategy Lab](project_strategy_lab.md) — estrategias como plantillas de reglas, backtest vs comprar y mantener, Golden Cross
- [Informes externos](project_external_reports.md) — McClellan (Timing Models en BD, ciclos, COT) y Montoya (opciones): dato externo point-in-time vs feature nativa, PDF en screener_data
- [Estacionalidad](project_seasonality.md) — ciclos como estudio de estacionalidad: año medio, presidencial, oro 13,5 m; plegado de la historia vs tramo en curso
