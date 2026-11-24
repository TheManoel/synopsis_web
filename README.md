# Synopsis

Front de estudio de mercados sobre `screener_core` (`/api/v2`).

- **Índices**, **Materias primas**, **Divisas y bonos**: lecturas por horizonte (en %, pb o
  puntos según el instrumento), tendencia, rango de 52 semanas, gráfico con MA50/MA200,
  rendimiento relativo base 100 y ratios/diferenciales intermercado.
- **Amplitud (NYSE)**: McClellan, índice de suma, % sobre MA50/MA200, máximos − mínimos,
  línea A/D, impulso de Zweig, confirmación A/D y días del 90%.
- **Opciones (PoC, S&P 500)**: cadena del SPX (Yahoo, retrasada), forward por paridad put-call,
  IV propia (Black-76), GEX por strike y perfil de gamma, gamma cero, muros, max pain,
  estructura temporal, sonrisa, cadena y contexto VIX/VIX3M/VVIX/SKEW.

El front no calcula: todo lo derivado sale del core.

## Arrancar

```bash
# API (desde ../screener_core)
API_ONLY=1 poetry run uvicorn src.applications.signal_lab.web.app:create_app --factory --port 8899

# Front
npm install
npm run dev        # http://localhost:5180 (proxy /api → :8899; SYNOPSIS_API para otro destino)
```

## Estructura

```
src/lib/          tipos de la API, hooks de datos (TanStack Query), formato es-ES, tema
src/components/   Shell (navegación + cinta), primitivas de UI, gráficos
  charts/TimeChart.tsx   series temporales multipanel (lightweight-charts)
  charts/xy.tsx          gráficos XY en SVG (líneas, barras por strike) con tooltip
src/pages/        MarketSectionPage, BreadthPage, OptionsPage
```

Tokens de color en `src/index.css` (oscuro por defecto, claro bajo `data-theme="light"`).
La paleta categórica de series (8 posiciones, orden fijo) está validada para ambas superficies.
