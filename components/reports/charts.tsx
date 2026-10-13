'use client'

/**
 * Small SVG charts for the Reports page.
 *
 * Colour always follows the officer (their stored `color`), never their rank in a
 * sort, so a filter that changes which officers appear never repaints the rest.
 * Every chart sits beside a table carrying the same numbers, and bars are directly
 * labelled — the palette's lightest hue does not rely on contrast alone.
 */

export type Series = { id: string; name: string; color: string }

const axis = 'fill-muted-foreground text-[9px]'
const GAP = 2 // surface gap between stacked segments and adjacent bars

/** Nearest round number at or above `value`, for an axis that ends on a readable tick. */
function niceMax(value: number) {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  return Math.ceil(value / magnitude) * magnitude
}

export function StackedBars({
  labels, series, values, unit = '',
}: {
  labels: string[]
  series: Series[]
  /** values[dayIndex][seriesIndex] */
  values: number[][]
  unit?: string
}) {
  const width = 520, height = 230, padLeft = 30, padBottom = 26, padTop = 20
  const totals = values.map((row) => row.reduce((a, b) => a + b, 0))
  const max = niceMax(Math.max(...totals, 1))
  const plotHeight = height - padBottom - padTop
  const step = (width - padLeft) / labels.length
  const barWidth = Math.min(40, step - 14)
  const scale = (value: number) => (value / max) * plotHeight

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img">
      {[0, max / 2, max].map((tick) => (
        <g key={tick}>
          <line x1={padLeft} x2={width} y1={padTop + plotHeight - scale(tick)} y2={padTop + plotHeight - scale(tick)} className="stroke-border" strokeWidth={1} />
          <text x={0} y={padTop + plotHeight - scale(tick) + 3} className={axis}>{Math.round(tick)}</text>
        </g>
      ))}
      {labels.map((label, dayIndex) => {
        const x = padLeft + dayIndex * step + (step - barWidth) / 2
        let cursor = padTop + plotHeight
        return (
          <g key={label}>
            {series.map((entry, seriesIndex) => {
              const value = values[dayIndex][seriesIndex]
              if (value <= 0) return null
              const barHeight = Math.max(scale(value) - GAP, 1)
              cursor -= barHeight + GAP
              return (
                <rect key={entry.id} x={x} y={cursor} width={barWidth} height={barHeight} rx={3} fill={entry.color}>
                  <title>{`${label} · ${entry.name}: ${value.toFixed(1)}${unit}`}</title>
                </rect>
              )
            })}
            {totals[dayIndex] > 0 && (
              <text x={x + barWidth / 2} y={cursor - 5} textAnchor="middle" className="fill-foreground text-[9px] font-medium">
                {Math.round(totals[dayIndex])}
              </text>
            )}
            <text x={x + barWidth / 2} y={height - 8} textAnchor="middle" className={axis}>{label}</text>
          </g>
        )
      })}
    </svg>
  )
}

/** Average utilisation across the week, with the floor the branch aims to stay above. */
export function UtilisationLine({ labels, values, floorPct, floorLabel }: { labels: string[]; values: (number | null)[]; floorPct: number; floorLabel: string }) {
  const width = 520, height = 200, padLeft = 30, padBottom = 26, padTop = 14
  const max = Math.max(60, niceMax(Math.max(...values.map((v) => v ?? 0))))
  const plotHeight = height - padBottom - padTop
  const step = (width - padLeft) / labels.length
  const x = (index: number) => padLeft + index * step + step / 2
  const y = (value: number) => padTop + plotHeight - (value / max) * plotHeight
  const points = values.map((value, index) => (value === null ? null : { x: x(index), y: y(value), value, index })).filter((p) => p !== null)
  const lowest = points.reduce((low, point) => (point.value < low.value ? point : low), points[0])

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img">
      {[0, max / 2, max].map((tick) => (
        <g key={tick}>
          <line x1={padLeft} x2={width} y1={y(tick)} y2={y(tick)} className="stroke-border" strokeWidth={1} />
          <text x={0} y={y(tick) + 3} className={axis}>{Math.round(tick)}%</text>
        </g>
      ))}
      <line x1={padLeft} x2={width} y1={y(floorPct)} y2={y(floorPct)} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 4" />
      <text x={width} y={y(floorPct) - 5} textAnchor="end" className="text-[9px]" fill="#f59e0b">{floorLabel}</text>
      {points.length > 1 && (
        <polyline points={points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" className="stroke-foreground" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      )}
      {points.map((point) => (
        <circle key={point.index} cx={point.x} cy={point.y} r={point === lowest ? 5 : 4}
          fill={point === lowest ? '#f59e0b' : 'currentColor'}
          className={point === lowest ? '' : 'fill-foreground'}
          stroke="var(--card)" strokeWidth={2}>
          <title>{`${labels[point.index]}: ${point.value}%`}</title>
        </circle>
      ))}
      {labels.map((label, index) => <text key={label} x={x(index)} y={height - 8} textAnchor="middle" className={axis}>{label}</text>)}
    </svg>
  )
}

/**
 * Utilisation per officer per day. A blank cell means the officer was not rostered;
 * the amber state is reserved for "rostered but under the floor", and carries its
 * number, so the state never rests on colour alone.
 */
export function UtilisationGrid({ labels, rows, floorPct }: { labels: string[]; rows: { id: string; name: string; values: (number | null)[] }[]; floorPct: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-separate border-spacing-1 text-xs">
        <thead>
          <tr><th /> {labels.map((label) => <th key={label} className="pb-1 text-center text-[10px] font-medium text-muted-foreground">{label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row" className="w-28 pr-2 text-left text-[11px] font-normal text-muted-foreground">{row.name}</th>
              {row.values.map((value, index) => {
                if (value === null) return <td key={index} className="h-7 rounded border border-dashed border-border" />
                const low = value < floorPct
                // One hue, light→dark with magnitude; amber is the "below floor" state.
                const fill = low ? 'rgb(254 243 199)' : `color-mix(in oklch, var(--foreground) ${Math.min(90, 25 + value)}%, transparent)`
                return (
                  <td key={index} className="h-7 rounded text-center text-[10px] font-medium tabular-nums"
                    style={{ background: fill, color: low ? 'rgb(146 64 14)' : value > 45 ? 'var(--background)' : 'var(--foreground)' }}>
                    {value}%
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Meetings scheduled against meetings selected, one row per day. */
export function CoverageBars({ rows }: { rows: { label: string; scheduled: number; total: number }[] }) {
  const max = Math.max(...rows.map((row) => row.total), 1)
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-3 text-xs">
          <span className="w-10 shrink-0 text-muted-foreground">{row.label}</span>
          <div className="flex h-3 flex-1 gap-[2px] overflow-hidden rounded-sm">
            <div className="bg-foreground" style={{ width: `${(row.scheduled / max) * 100}%` }} />
            {row.total > row.scheduled && <div className="bg-red-500" style={{ width: `${((row.total - row.scheduled) / max) * 100}%` }} />}
            <div className="flex-1 bg-muted" />
          </div>
          <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">{row.scheduled} / {row.total}</span>
        </div>
      ))}
    </div>
  )
}

/** Daily kilometres for one officer, in a table cell. */
export function Sparkline({ values, color, unit }: { values: (number | null)[]; color: string; unit: string }) {
  const max = Math.max(...values.map((v) => v ?? 0), 1)
  return (
    <div className="flex h-6 items-end gap-[2px]" role="img" aria-label={`${values.filter((v) => v).length} days`}>
      {values.map((value, index) => (
        <div key={index} className="w-1.5 rounded-sm" title={value === null ? '—' : `${value.toFixed(1)} ${unit}`}
          style={{ height: value ? `${Math.max((value / max) * 100, 8)}%` : '2px', background: value ? color : 'var(--border)' }} />
      ))}
    </div>
  )
}

/** A single proportion, used in table cells. */
export function MiniBar({ pct, color }: { pct: number; color?: string }) {
  return (
    <div className="h-1.5 w-full max-w-[120px] overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(pct, 0))}%`, background: color ?? 'var(--foreground)' }} />
    </div>
  )
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
      {series.map((entry) => (
        <li key={entry.id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span aria-hidden className="size-2 rounded-full" style={{ background: entry.color }} />
          {entry.name}
        </li>
      ))}
    </ul>
  )
}
