'use client'

import { fmtTime, fromMin, toMin } from '@/lib/format'
import { useT, type Translate } from '@/lib/i18n'
import type { JLGGroup, Officer, Plan } from '@/lib/types'

const DAY_START = 8 * 60
const DAY_END = 18 * 60
const pct = (min: number) => `${((Math.min(Math.max(min, DAY_START), DAY_END) - DAY_START) / (DAY_END - DAY_START)) * 100}%`
const width = (from: number, to: number) => `${((Math.min(to, DAY_END) - Math.max(from, DAY_START)) / (DAY_END - DAY_START)) * 100}%`

type Block = { kind: 'travel' | 'wait' | 'meeting' | 'break' | 'window'; from: number; to: number; label: string }

function blocksFor(plan: Plan, officerId: string, groups: JLGGroup[], t: Translate): Block[] {
  const route = plan.routes.find((r) => r.officerId === officerId)
  if (!route) return []
  const out: Block[] = []
  for (const stop of route.stops) {
    const g = groups.find((x) => x.id === stop.groupId)
    const name = g?.name ?? t('Meeting')
    const arrival = toMin(stop.arrivalTime)
    if (g) out.push({ kind: 'window', from: toMin(g.windowStart), to: toMin(g.windowEnd), label: t('{name} window {from}–{to}', { name, from: fmtTime(g.windowStart), to: fmtTime(g.windowEnd) }) })
    out.push({ kind: 'travel', from: arrival - stop.travelMinFromPrev, to: arrival, label: t('Travel to {place} · {min} min ({km} km)', { place: g?.village ?? t('next stop'), min: stop.travelMinFromPrev, km: stop.distanceKmFromPrev }) })
    if (stop.waitMin > 0) out.push({ kind: 'wait', from: arrival, to: toMin(stop.meetingStart), label: t('Waiting {min} min for the meeting window', { min: stop.waitMin }) })
    out.push({ kind: 'meeting', from: toMin(stop.meetingStart), to: toMin(stop.meetingEnd), label: `${name} · ${fmtTime(stop.meetingStart)}–${fmtTime(stop.meetingEnd)}` })  // name first: the meeting block shows it truncated
  }
  const last = route.stops.at(-1)
  if (last && route.returnTravelMin) out.push({ kind: 'travel', from: toMin(last.departureTime), to: toMin(last.departureTime) + route.returnTravelMin, label: t('Return to branch · {min} min, back at {time}', { min: route.returnTravelMin, time: fmtTime(route.endTime) }) })
  if (route.breakStart && route.breakEnd) out.push({ kind: 'break', from: toMin(route.breakStart), to: toMin(route.breakEnd), label: t('Lunch break {from}–{to}', { from: fmtTime(route.breakStart), to: fmtTime(route.breakEnd) }) })
  return out
}

/** Gantt view of each officer's day, built from plain positioned divs. */
export function Timeline({ plan, groups, officers }: { plan: Plan; groups: JLGGroup[]; officers: Officer[] }) {
  const t = useT()
  const hours = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => DAY_START + i * 60)
  const rows = plan.routes.map((r) => officers.find((o) => o.id === r.officerId)).filter((o): o is Officer => !!o)
  return <div className="overflow-x-auto rounded-xl border bg-card"><div className="min-w-[760px] p-4">
    <div className="relative ml-36 h-6 border-b">{hours.map((h) => <span key={h} className="absolute -translate-x-1/2 text-[10px] text-muted-foreground" style={{ left: pct(h) }}>{fmtTime(fromMin(h)).replace(':00', '')}</span>)}</div>
    {rows.map((o) => <div key={o.id} className="flex items-center border-b last:border-b-0">
      <div className="flex w-36 shrink-0 items-center gap-2 py-3 pr-3 text-xs font-medium"><span className="size-2.5 shrink-0 rounded-full" style={{ background: o.color }} /><span className="truncate">{o.name}</span></div>
      <div className="relative h-10 flex-1">
        {hours.map((h) => <span key={h} className="absolute inset-y-0 border-l border-dashed border-border/70" style={{ left: pct(h) }} />)}
        {blocksFor(plan, o.id, groups, t).map((b, i) => <div key={i} title={b.label} className={`group absolute ${b.kind === 'window' ? 'inset-y-0.5 rounded-sm' : b.kind === 'meeting' ? 'inset-y-1.5 z-10 overflow-hidden rounded-md px-1.5 text-[10px] font-medium leading-7 text-white' : b.kind === 'travel' ? 'inset-y-3.5 z-10 rounded-full' : 'inset-y-2.5 z-10 rounded'}`}
          style={{
            left: pct(b.from), width: width(b.from, b.to),
            background: b.kind === 'window' ? `${o.color}14` : b.kind === 'meeting' ? o.color : b.kind === 'travel' ? `${o.color}66` : b.kind === 'break' ? '#a3a3a3' : 'repeating-linear-gradient(45deg,#a3a3a355 0 4px,transparent 4px 8px)',
          }}>
          {b.kind === 'meeting' && <span className="block truncate">{b.label.split(' · ')[0]}</span>}
          {b.kind !== 'window' && <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-[11px] font-normal leading-4 text-popover-foreground shadow-md group-hover:block">{b.label}</span>}
        </div>)}
      </div>
    </div>)}
    <div className="ml-36 mt-3 flex flex-wrap gap-4 text-[11px] text-muted-foreground"><Key swatch="bg-neutral-500">{t('Meeting')}</Key><Key swatch="bg-neutral-500/40 h-1.5 rounded-full">{t('Travel')}</Key><Key swatch="[background:repeating-linear-gradient(45deg,#a3a3a3_0_3px,transparent_3px_6px)]">{t('Waiting')}</Key><Key swatch="bg-neutral-400">{t('Break')}</Key><Key swatch="bg-neutral-500/10 border">{t('Meeting window')}</Key></div>
  </div></div>
}

function Key({ swatch, children }: { swatch: string; children: React.ReactNode }) { return <span className="flex items-center gap-1.5"><span className={`inline-block h-3 w-5 rounded-sm ${swatch}`} />{children}</span> }
