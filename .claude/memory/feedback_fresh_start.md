---
name: feedback_fresh_start
description: "Synopsis se diseña desde cero: no usar signal_lab_web ni sus directrices de UI como referencia; el diseño es decisión propia"
metadata:
  type: feedback
---

# Diseño desde cero

- **Estado**: vigente (instrucción del usuario, 2026-11-24)
- **Leer si**: vas a crear UI, elegir librerías o copiar un patrón de otro repo
- **Código**: —

El usuario pidió un front completamente nuevo: "no tomes como referencia nada del front actual
ni ninguna directriz que hayamos usado para el proyecto actual. Simulemos que solo conoces el
código de screener core y screener data". Da el *qué* (features), no el *cómo*: el diseño es
nuestro, con estética moderna.

**Why:** quiere una base fresca, sin la deuda ni las decisiones de `signal_lab_web`.
**How to apply:** no abrir ni importar nada de `../signal_lab_web`. Proponer el diseño y
justificarlo; las reglas de arquitectura del core (hexagonal, el core calcula) sí aplican
(ver [[feedback_core_computes]]).
