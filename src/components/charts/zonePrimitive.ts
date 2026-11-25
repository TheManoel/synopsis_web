import type {
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from 'lightweight-charts'

/**
 * A horizontal zone (a ceiling or a floor) as the core sends it: it forms from
 * `from` (its first point) and is the level the rules read from `start` to
 * `to`. Dates are sessions of the chart's series. Nothing here is computed:
 * the core decides every edge.
 */
export interface ZoneBox {
  from: string
  start: string
  to: string
  lower: number
  upper: number
  points: { time: string; value: number }[]
}

type Target = Parameters<IPrimitivePaneRenderer['draw']>[0]

/** Two stretches, drawn differently: forming (not the level yet), the level. */
const FORMING = { fill: 0.07, edge: 0.55, dash: [3, 3] }
const LEVEL = { fill: 0.2, edge: 1, dash: [] as number[] }

/**
 * Draws zones over a series (its price scale): a box per stretch and a dot per
 * point that forms the zone. Attached to the price pane's candles.
 */
export class ZonesPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApiBase<Time> | null = null
  private series: ISeriesApi<SeriesType, Time> | null = null
  private readonly views: IPrimitivePaneView[]
  private readonly boxes: ZoneBox[]
  private readonly color: string
  private readonly ring: string

  constructor(boxes: ZoneBox[], color: string, ring: string) {
    this.boxes = boxes
    this.color = color
    this.ring = ring
    const renderer: IPrimitivePaneRenderer = { draw: (target) => this.draw(target) }
    this.views = [{ zOrder: () => 'normal', renderer: () => renderer }]
  }

  attached({ chart, series }: SeriesAttachedParameter<Time>) {
    this.chart = chart
    this.series = series
  }

  detached() {
    this.chart = null
    this.series = null
  }

  paneViews() {
    return this.views
  }

  private draw(target: Target) {
    const chart = this.chart
    const series = this.series
    if (!chart || !series) return
    const scale = chart.timeScale()
    const half = Math.max(scale.options().barSpacing / 2, 0.5)
    const x = (t: string) => scale.timeToCoordinate(t as Time)
    const y = (p: number) => series.priceToCoordinate(p)

    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      ctx.save()
      for (const b of this.boxes) {
        const x0 = x(b.from)
        const x1 = x(b.to)
        const yTop = y(b.upper)
        const yBottom = y(b.lower)
        if (x0 == null || x1 == null || yTop == null || yBottom == null) continue
        if (x1 + half < 0 || x0 - half > mediaSize.width) continue
        // A zone of one price still shows as a band.
        const mid = (yTop + yBottom) / 2
        const top = Math.min(yTop, mid - 1)
        const bottom = Math.max(yBottom, mid + 1)

        const xs = x(b.start) ?? x0
        const stretch = (from: number, to: number, look: typeof LEVEL) => {
          if (to <= from) return
          ctx.globalAlpha = look.fill
          ctx.fillStyle = this.color
          ctx.fillRect(from, top, to - from, bottom - top)
          ctx.globalAlpha = look.edge
          ctx.strokeStyle = this.color
          ctx.lineWidth = 1
          ctx.setLineDash(look.dash)
          ctx.beginPath()
          ctx.moveTo(from, Math.round(top) + 0.5)
          ctx.lineTo(to, Math.round(top) + 0.5)
          ctx.moveTo(from, Math.round(bottom) - 0.5)
          ctx.lineTo(to, Math.round(bottom) - 0.5)
          ctx.stroke()
        }
        stretch(x0 - half, xs - half, FORMING)
        stretch(xs - half, x1 + half, LEVEL)
        // Where it becomes the level: a tick across the band.
        ctx.globalAlpha = 1
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.moveTo(Math.round(xs - half) + 0.5, top - 3)
        ctx.lineTo(Math.round(xs - half) + 0.5, bottom + 3)
        ctx.stroke()

        for (const t of b.points) {
          const tx = x(t.time)
          const ty = y(t.value)
          if (tx == null || ty == null) continue
          ctx.globalAlpha = 1
          ctx.beginPath()
          ctx.arc(tx, ty, 3.5, 0, 2 * Math.PI)
          ctx.fillStyle = this.color
          ctx.fill()
          ctx.lineWidth = 1.5
          ctx.strokeStyle = this.ring
          ctx.stroke()
        }
      }
      ctx.restore()
    })
  }
}
