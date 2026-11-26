---
name: project_relative_strength
description: "Sección Fuerza relativa (/fuerza-relativa): histórico RS guardado leído como universo → sector → industria → valor, viaje en el tiempo, mapa de calor, horizontes, comparación; decisiones y límites"
metadata:
  type: project
---

# Fuerza relativa

- **Estado**: v1 el 2026-11-26 (`/fuerza-relativa`), datos reales, sin commitear aún. Front en `feature/grupos-rotacion`; core en `feature/synopsis`.
- **Leer si**: tocas `/fuerza-relativa`, los endpoints `/rs/*` o el histórico `analytics.rs_*`
- **Código**: front `src/pages/RelativeStrengthPage.tsx`, `src/components/rs/*`, `src/lib/rs.ts`,
  `src/lib/rsCompare.ts`; core `src/applications/synopsis/rs_service.py`,
  `src/core/relative_strength/services/board.py`, `ports/rs_series_port.py`,
  `src/infrastructure/persistance/sql_rs_series_reader.py`, `config/markets/rs_taxonomy_labels.yaml`

**Solo lee el histórico guardado** (`analytics.rs_*`, lo escribe la etapa `rs_history_daily` de
`eod_daily` en Airflow, tras el OHLCV; ya no hay cron). Cualquier barra desde 1962 (SPX500) / 1986 (STOXX 600) en ~0,1 s,
frente a ~60 s en frío de un panel recalculado. Si la carga diaria no corre, va por detrás: la página lo dice (`lag_sessions` + aviso) y nunca
hace pasar una barra vieja por la de hoy. El calendario se relee cada 2 min (`CALENDAR_TTL_S`),
así que un refresco aparece sin reiniciar la API.

**Una petición por nivel no**: `GET /rs/{u}/board` trae la barra entera (sectores, industrias
con su sector padre, ~500-600 valores, resumen del universo; ~300 KB) y la navegación
universo → sector → industria es instantánea filtrando en el front (filtrar/ordenar ≠ calcular).
Toda cifra viene del core: participación (`group_rows_from`), **exceso mediano** y **% que bate
al índice** (`board.excess_breadth`, mediana por las corporate actions sin ajustar de Europa).

**Color del nivel de RS: rojo → neutro (50) → verde** (`src/lib/rs.ts:pctFill`, tokens
`--down`/`--up`). Lo pidió el usuario el 2026-11-26 en lugar del azul de un solo tono que
aconseja la memoria `rs_system` del core (allí se evitaba verde/rojo para no leer
compra/venta en una tabla que no predice). Es su decisión: no volver al azul. La cifra va
siempre escrita en la celda (rojo/verde no basta con daltonismo).

**Decisiones heredadas del sistema RS del core** (memoria `rs_system` allí): las tres lentes 12M/3M/1M siempre juntas (su discrepancia es la lectura);
líderes **y** rezagados (80/20, sin calibrar); el percentil «en su sector/industria» refina,
nunca ordena por defecto; nada de lenguaje predictivo (esquinas del gráfico de horizontes
nombradas por lo que son).

**Viaje en el tiempo**: `?date=` resuelve a la última barra guardada ≤ fecha. Historias de grupo,
detalle de valor y comparación terminan en esa fecha (`as_of` en los endpoints de historia). La
línea RS por precio (sale de `/symbols/{key}/indicator`, sin fecha final) se oculta en el pasado,
avisándolo. Sesgo de supervivencia avisado cuando la barra es anterior a `membership_as_of`.

**Grupos pequeños**: muchas industrias tienen 1-4 valores → percentiles a saltos (con 2, 0 o
100; singleton = 50). Se marca en tabla (ámbar), mapa de calor y detalle del valor.

**Comparar**: hasta 8 valores/grupos fijados (localStorage `synopsis.rs.compare`), color por
`slot` asignado al fijar (sigue a la entidad). Mezclar universos se permite y se avisa.

**Estado en URL**: `u`, `lens`, `d` (5/21/63), `date`, `sector`, `industry`, `sym`, `range`.

**Límites / siguiente**: solo SPX500 y STOXX 600 (lo que tiene histórico); valores fuera de esos
índices solo muestran la línea RS; nombres de industria nuevos caen al inglés del proveedor
(añadir a `rs_taxonomy_labels.yaml`); el tablero pesa ~300 KB sin gzip; sin tests de front.
Relacionado: [[project_symbols]] (percentil RS de un valor), [[project_groups_rotation]]
(RRG y participación en frío), [[feedback_core_computes]].
