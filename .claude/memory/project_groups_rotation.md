---
name: project_groups_rotation
description: "Página Grupos y rotación: RRG por universo (sectores/industrias EE. UU. y Europa, temáticas), exceso vs índice, participación interna; decisiones y límites"
metadata:
  type: project
---

# Grupos y rotación

- **Estado**: hecha el 2026-11-24 (`/grupos`), datos reales. Front en la rama `feature/grupos-rotacion`; core en `feature/synopsis`.
- **Leer si**: tocas `/grupos`, el RRG, `rotation.yaml` o quieres añadir un universo de grupos
- **Código**: front `src/pages/GroupsPage.tsx`, `src/components/charts/RotationMap.tsx`,
  `src/lib/rotation.ts`; core `src/core/markets/services/group_rotation.py`,
  `src/applications/synopsis/rotation_service.py`, `config/markets/rotation.yaml`

**Universos**: 5 en `rotation.yaml`, cada uno con su RRG semanal (canónico, calibrado) y diario
de `config/spread_analyses`, índice de referencia y, si aplica, panel de participación
(SPX500 / EUROSTOXX600 × sector / industria). Etiquetas en español por ticker en el mismo YAML.
Añadir un universo = una entrada en el YAML (el test `test_synopsis_rotation_catalog` lo valida).

**Dos referencias, a propósito y declaradas**: el RRG mide cada grupo frente a la cesta
leave-one-out del resto de grupos; la tabla de exceso y la línea relativa, frente al índice
(S&P 500 / STOXX 600). Pueden discrepar; la página lo explica.

**Decisiones de diseño**:
- Más grupos (11–19) que tonos categóricos (8) → identidad por etiqueta directa (nombre o
  ticker; ticker por defecto con >12 grupos o pantalla estrecha), colas neutras, y el color de
  la cabeza = cuadrante (estado, tokens up/warn/down/accent, siempre con su nombre al lado).
- Eje ajustado a lo visible e incluyendo 100; al reproducir se congela al de toda la ventana.
- El core manda el cuadrante de cada punto de la cola: el reproductor no recalcula nada.

**Límites**:
- Participación: el panel RS de ~500 componentes tarda ~40 s en frío (luego caché del
  `RsPanelService` + TTL 15 min en el servicio). Va en tarjeta aparte y diferida.
- Temáticas: ~13 s la primera vez (18 ETF). Caché TTL 15 min por (universo, timeframe, día).
- La barra semanal de la semana en curso se marca en formación (`bar_in_progress` + aviso).
- Señales de rotación: sin ventaja medida por sí solas (nota en `signals_note`).
- Participación usa la membresía actual proyectada hacia atrás (sesgo de supervivencia, avisado).
