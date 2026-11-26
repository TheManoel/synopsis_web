---
name: project_seasonality
description: "Estacionalidad = estudio de ciclos: año medio, ciclo presidencial y ciclos propios de un activo (oro 13,5 m) plegando la historia; pestaña Estacionalidad de Símbolos"
metadata:
  type: project
---

# Estacionalidad (estudio de ciclos)

- **Estado**: v1 el 2026-11-26 (core d1a48cf, front f20d700). Pestaña «Estacionalidad» en Símbolos.
- **Leer si**: tocas ciclos, estacionalidad, el ciclo presidencial o el del oro
- **Código**: core `src/core/seasonality/cycle_composite.py` + `catalog.py`,
  `config/seasonality/cycles.yaml`, `applications/synopsis/seasonality_service.py`
  (`GET /seasonality/{key}`); front `components/symbols/SymbolSeasonality.tsx`

**Encuadre del usuario**: todos los ciclos (los que cita McClellan incluidos) son PARTE del
estudio de estacionalidad, no features sueltas. Un estudio = plegar la historia por un ciclo
de calendario (`CycleFold`: N años naturales desde un ancla, o N días), media de los tramos
completos (bruta = con deriva, como pinta McClellan el presidencial; sin tendencia = solo la
forma) frente al tramo en curso, y qué hicieron los tramos desde la posición actual hasta su
final (media y cuántos al alza). Aviso con < 8 tramos. Añadir un ciclo = entrada en el YAML.

**Distinto de la regla** `cycle_wave` del motor (dónde «debería» estar un ciclo postulado). El
ciclo del oro vive en las dos con el mismo periodo/ancla (test lo vigila) — ver
[[project_external_reports]]. Medido 2001-2025, la forma media del oro NO muestra suelo a
mitad de ciclo: la medida puede contradecir al autor y se enseña tal cual.

**Pendiente**: otros ciclos citados (8 años del oro con su forma propia 3 arriba/5 abajo, 5,31
años, 4 años de bitcoin — BTC no está en la base), ciclos de 26 sesiones / lunas llenas.
