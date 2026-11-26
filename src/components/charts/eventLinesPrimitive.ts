import type {
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
} from 'lightweight-charts'

/**
 * A dated event on a session that has no bar yet (whitespace after the last
 * bar): series markers cannot sit there, so it is drawn as a dashed vertical
 * line with an arrow (up = from below, down = from above) and its label.
 */
export interface EventLine {
  time: string
  color: string // resolved
  up: boolean
  strong: boolean
  text?: string
}

type Target = Parameters<IPrimitivePaneRenderer['draw']>[0]

export class EventLinesPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApiBase<Time> | null = null
  private readonly views: IPrimitivePaneView[]
  private readonly events: EventLine[]

  constructor(events: EventLine[]) {
    this.events = events
    const renderer: IPrimitivePaneRenderer = { draw: (target) => this.draw(target) }
    this.views = [{ zOrder: () => 'top', renderer: () => renderer }]
  }

  attached({ chart }: SeriesAttachedParameter<Time>) {
    this.chart = chart
  }

  detached() {
    this.chart = null
  }

  paneViews() {
    return this.views
  }

  private draw(target: Target) {
    const chart = this.chart
    if (!chart) return
    const scale = chart.timeScale()
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      ctx.save()
      ctx.font = '10px "Inter Variable", system-ui, sans-serif'
      ctx.textAlign = 'center'
      // Several events on one session stack their labels instead of overprinting.
      const stack = new Map<string, number>()
      for (const e of this.events) {
        const x = scale.timeToCoordinate(e.time as Time)
        if (x == null || x < 0 || x > mediaSize.width) continue
        const n = stack.get(`${e.time}${e.up}`) ?? 0
        stack.set(`${e.time}${e.up}`, n + 1)
        const xs = Math.round(x) + 0.5
        ctx.globalAlpha = 0.45
        ctx.strokeStyle = e.color
        ctx.lineWidth = 1
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(xs, 0)
        ctx.lineTo(xs, mediaSize.height)
        ctx.stroke()
        ctx.globalAlpha = 1
        ctx.setLineDash([])
        const size = e.strong ? 6 : 4
        // Arrow pointing the way of the turn: up near the bottom, down near the top.
        const yArrow = e.up ? mediaSize.height - 22 - n * 22 : 14 + n * 22
        ctx.fillStyle = e.color
        ctx.beginPath()
        if (e.up) {
          ctx.moveTo(xs, yArrow - size)
          ctx.lineTo(xs - size, yArrow + size)
          ctx.lineTo(xs + size, yArrow + size)
        } else {
          ctx.moveTo(xs, yArrow + size)
          ctx.lineTo(xs - size, yArrow - size)
          ctx.lineTo(xs + size, yArrow - size)
        }
        ctx.closePath()
        ctx.fill()
        if (e.text) ctx.fillText(e.text, xs, e.up ? yArrow + size + 11 : yArrow - size - 3)
      }
      ctx.restore()
    })
  }
}
