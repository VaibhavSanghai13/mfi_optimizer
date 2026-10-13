/**
 * Decorative hero artwork: four officer routes leaving one branch (HQ).
 * Purely illustrative — it is not drawn from plan data, so it is hidden from
 * assistive technology.
 */

const hq = { x: 470, y: 250 }

/** One route per officer: the colour, and the stops in visiting order. */
const routes = [
  { color: '#a855f7', stops: [{ x: 320, y: 290, n: 1 }, { x: 372, y: 155, n: 2 }, { x: 430, y: 108, n: 3 }, { x: 512, y: 178, n: 4 }] },
  { color: '#22c55e', stops: [{ x: 408, y: 268, n: 6 }, { x: 452, y: 318, n: 5 }, { x: 492, y: 198, n: 7 }] },
  { color: '#f97316', stops: [{ x: 534, y: 300, n: 8 }, { x: 572, y: 362, n: 1 }] },
  { color: '#3b82f6', stops: [{ x: 560, y: 212, n: 2 }, { x: 648, y: 168, n: 3 }] },
]

/** A gentle arc between two points, so routes read as roads rather than straight lines. */
function arc(from: { x: number; y: number }, to: { x: number; y: number }) {
  const midX = (from.x + to.x) / 2
  const midY = (from.y + to.y) / 2
  const bend = 0.16
  return `Q ${midX - (to.y - from.y) * bend} ${midY + (to.x - from.x) * bend} ${to.x} ${to.y}`
}

export function RouteGraphic() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 800 480"
      className="pointer-events-none absolute inset-0 size-full opacity-70"
      preserveAspectRatio="xMidYMid slice"
    >
      {/* Faint contour lines behind the routes. */}
      <g stroke="white" strokeOpacity={0.05} fill="none">
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M -40 ${90 + i * 110} Q 240 ${30 + i * 110} 460 ${120 + i * 110} T 860 ${70 + i * 110}`} />
        ))}
      </g>

      {routes.map((route) => {
        const path = route.stops.reduce((d, stop, i) => `${d} ${arc(i === 0 ? hq : route.stops[i - 1], stop)}`, `M ${hq.x} ${hq.y}`)
        return (
          <g key={route.color}>
            <path d={path} fill="none" stroke={route.color} strokeWidth={1.6} strokeOpacity={0.85} strokeLinecap="round" />
            {route.stops.map((stop) => (
              <g key={`${stop.x}-${stop.y}`}>
                <circle cx={stop.x} cy={stop.y} r={9} fill={route.color} />
                <text x={stop.x} y={stop.y + 3.2} textAnchor="middle" fontSize={9} fontWeight={600} fill="white" fontFamily="ui-monospace, monospace">
                  {stop.n}
                </text>
              </g>
            ))}
          </g>
        )
      })}

      <g>
        <rect x={hq.x - 20} y={hq.y - 12} width={40} height={24} rx={5} fill="white" />
        <text x={hq.x} y={hq.y + 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="#0a0a0a" fontFamily="ui-monospace, monospace">HQ</text>
      </g>
    </svg>
  )
}
