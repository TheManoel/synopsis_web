---
name: reference_design_system
description: "Sistema de diseño de Synopsis: tokens de color/tema, paleta categórica validada, tipografía, componentes de UI y de gráficos"
metadata:
  type: reference
---

# Sistema de diseño

- **Estado**: v0
- **Leer si**: creas una pantalla, un componente o un gráfico
- **Código**: `src/index.css`, `src/components/ui.tsx`, `src/components/charts/*`, `src/lib/theme.ts`

**Tema**: oscuro por defecto (`--canvas #0a0b0d`, `--surface #111317`), claro bajo
`data-theme="light"` con sus propios valores (no es una inversión). Se guarda en localStorage
`synopsis.theme`; un script en `index.html` lo aplica antes del primer pintado.
Tokens semánticos en Tailwind: `bg-surface`, `text-ink/ink-2/ink-3`, `border-line`, `accent`,
`up`/`down` (signo), `warn`.

**Series**: `--s1…--s8` en orden fijo (azul, naranja, aguamarina, amarillo, magenta, verde,
violeta, rojo), validadas con el validador de dataviz sobre `#111317` (pasa todo) y `#ffffff`
(3 tonos <3:1 → requieren etiqueta directa o leyenda con valor). El color sigue a la entidad
(índice del miembro en su grupo), nunca al ranking. Calls = `--s1`, puts = `--s2`.

**Tipografía**: Inter Variable; cifras tabulares (`.num`) solo en tablas y ejes.

**Componentes UI**: `Card`, `Stat` (cifra grande), `Segmented`, `Delta` (signo con flecha:
nunca solo color), `Pill`, `Warnings`, `InfoTip`, `Skeleton`, `PageHeader`.

**Gráficos**:
- `TimeChart` (lightweight-charts v5): paneles apilados con cursor sincronizado, leyenda HTML
  con el valor bajo el cursor, `levels` = líneas de referencia. Se reconstruye al cambiar spec
  o tema → memoizar `panes` en el llamador. Lee los colores resueltos con `useCssVars`.
- `LinePlot` / `StrikeBars` (`xy.tsx`, SVG): tooltip con regla vertical, `refX`/`refY`,
  separación de 2px entre barras, zona de hover más ancha que la marca.
- `TimeChart` también admite `markers` (eventos sobre una serie de línea: entradas/salidas) y
  `logScale` por panel (historias largas).
- Nunca dos ejes Y: unidades distintas → paneles distintos.
- Al recargar se mantiene el render anterior atenuado (`is-stale`), sin parpadeo de skeleton.
