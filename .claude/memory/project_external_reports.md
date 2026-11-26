---
name: project_external_reports
description: "Informes de analistas (McClellan Timing Models, ciclos y COT; JJ Montoya opciones): qué se integra, cómo (dato externo point-in-time vs feature nativa), dónde se guardan los PDF y el plan por fases"
metadata:
  type: project
---

# Informes externos de analistas

- **Estado**: fase 1 hecha el 2026-11-26: ingesta de los Timing Models (tabla + DAG) y ciclo
  del oro recalibrado. Sin commit. Pendiente: lectura en el core, API y marcadores en el gráfico.
- **Leer si**: tocas McClellan, ciclos, COT de sus informes, niveles de opciones de Montoya
- **Código**: screener_data `airflow/dags/lib/mcclellan_timing.py` (parser puro + PyMuPDF),
  `orchestrators/mcclellan/load_mcclellan_reports.py`, `database/migrations/050_mcclellan_timing.sql`,
  `tests/test_mcclellan_timing.py`; core `config/features/ciclo_oro_referencia.yaml`

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

**Plan**: (1) ciclos y COT visibles en Símbolos; (2) core: repositorio + fuente externa
`timing_signal` en `EXTERNAL_SERIES` + endpoint + marcadores (previsto/real/fuerte/cluster) en
`TimeChart`, mapeo bloque → instrumentos en YAML; (3) cotejo con nuestros pivotes; (4) opciones:
niveles propios desde el PoC (walls, gamma flip, implícito) → Montoya desde Gmail (extracción
revisada por el usuario) → histórico de cadena. Ver [[project_options_poc]], [[feedback_core_computes]].
