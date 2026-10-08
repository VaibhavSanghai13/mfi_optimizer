'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, Navigation, Printer } from 'lucide-react'
import { getDaySheetData } from '@/lib/api-client'
import { fmtDate, fmtDuration, fmtKm, fmtTime } from '@/lib/format'
import type { Branch, JLGGroup, Officer, Plan } from '@/lib/types'
import { RouteMap } from './maps'
import { planMapData } from './planner/plan-parts'
import { PriorityBadge } from './ui-kit'

const directions = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`

/** Mobile-first, printable itinerary for one officer on one plan. */
export function DaySheet({ plan, officerId }: { plan: Plan; officerId: string }) {
  const [branch, setBranch] = useState<Branch | null>(null); const [groups, setGroups] = useState<JLGGroup[]>([]); const [officers, setOfficers] = useState<Officer[]>([])
  const [visited, setVisited] = useState<Set<string>>(new Set())
  // One call that also works for field officers (the full groups/officers lists are manager-only).
  useEffect(() => { getDaySheetData(plan.id, officerId).then((d) => { setBranch(d.branch); setGroups(d.groups); setOfficers([d.officer]) }).catch(() => {}) }, [plan.id, officerId])
  const route = plan.routes.find((r) => r.officerId === officerId)
  const officer = officers.find((o) => o.id === officerId)
  if (!route) return <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">This officer has no route in this plan.</p>
  if (!officer || !branch || !groups.length) return <p className="p-8 text-center text-sm text-muted-foreground">Loading day sheet…</p>
  const map = planMapData({ ...plan, routes: [route], unassigned: [] }, groups, officers)
  // The optimizer takes the break just before travelling to the first meeting after it.
  const breakBefore = route.breakEnd ? route.stops.findIndex((s) => s.arrivalTime >= route.breakEnd!) : -1
  const toggle = (id: string) => setVisited((v) => { const n = new Set(v); if (n.has(id)) n.delete(id); else n.add(id); return n })
  // The real optimizer may also place lunch after the last meeting, before riding back (breakBefore = -1).
  const lunch = route.breakStart && route.breakEnd ? <Step dot={<span className="flex size-7 items-center justify-center rounded-full border text-[10px]">☕</span>}><p className="text-sm">Lunch break · {fmtTime(route.breakStart)}–{fmtTime(route.breakEnd)}</p></Step> : null
  return <div className="mx-auto max-w-2xl space-y-4 print:max-w-none">
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Day sheet · {fmtDate(plan.date)}</p><h1 className="mt-1 flex items-center gap-2 text-xl font-semibold tracking-tight"><span className="size-3 rounded-full" style={{ background: officer.color }} />{officer.name}</h1></div><button onClick={() => window.print()} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm print:hidden"><Printer size={15} />Print</button></div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><Item label="Start" value={fmtTime(route.startTime)} /><Item label="Back at branch" value={fmtTime(route.endTime)} /><Item label="Meetings" value={`${visited.size} / ${route.stops.length} done`} /><Item label="Travel" value={`${fmtKm(route.totalDistanceKm)} · ${fmtDuration(route.totalTravelMin)}`} /></dl>
    </div>
    <div className="h-56 overflow-hidden rounded-xl border print:hidden"><RouteMap className="h-56 w-full" branch={branch} points={map.points} routes={map.routes} fitKey={plan.id + officerId} /></div>
    <ol className="relative space-y-0 rounded-xl border bg-card p-4">
      <Step dot={<span className="flex size-7 items-center justify-center rounded-md bg-primary text-[9px] font-bold text-primary-foreground">HQ</span>}><p className="text-sm font-medium">Start at {branch.name}</p><p className="text-xs text-muted-foreground">Leave at {fmtTime(route.startTime)}</p></Step>
      {route.stops.map((s) => { const g = groups.find((x) => x.id === s.groupId); if (!g) return null; const done = visited.has(s.groupId); return <div key={s.groupId}>
        {s.sequence === breakBefore + 1 && lunch}
        <Leg>{s.travelMinFromPrev} min · {s.distanceKmFromPrev} km</Leg>
        <Step dot={<span className="flex size-7 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ background: officer.color }}>{s.sequence}</span>}>
          <div className={done ? 'opacity-60' : ''}><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{g.name}</p><PriorityBadge priority={g.priority} /></div><p className="text-xs text-muted-foreground">{g.village} · {g.memberCount} members · {g.centerCode}</p>
            <p className="mt-1.5 text-sm">Arrive <strong>{fmtTime(s.arrivalTime)}</strong>{s.waitMin > 0 && <span className="text-muted-foreground"> · wait {s.waitMin} min</span>} · Meeting <strong>{fmtTime(s.meetingStart)}–{fmtTime(s.meetingEnd)}</strong></p></div>
          <div className="mt-2 flex flex-wrap gap-2 print:hidden"><a href={directions(g.lat, g.lng)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"><Navigation size={14} />Navigate</a><button onClick={() => toggle(s.groupId)} aria-pressed={done} className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm ${done ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300' : ''}`}>{done ? <CheckCircle2 size={15} /> : <Circle size={15} />}{done ? 'Visited' : 'Mark visited'}</button></div>
        </Step></div> })}
      {breakBefore === -1 && lunch}
      <Leg>{route.returnTravelMin} min · {route.returnDistanceKm} km</Leg>
      <Step dot={<span className="flex size-7 items-center justify-center rounded-md bg-primary text-[9px] font-bold text-primary-foreground">HQ</span>} last><p className="text-sm font-medium">Return to {branch.name}</p><p className="text-xs text-muted-foreground">Arrive around {fmtTime(route.endTime)}</p></Step>
    </ol>
  </div>
}

function Item({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-medium">{value}</dd></div> }
function Step({ dot, children, last }: { dot: React.ReactNode; children: React.ReactNode; last?: boolean }) { return <li className="flex list-none gap-3"><div className="flex flex-col items-center"><div className="shrink-0">{dot}</div>{!last && <div className="w-px flex-1 bg-border" />}</div><div className="min-w-0 flex-1 pb-2 pt-0.5">{children}</div></li> }
function Leg({ children }: { children: React.ReactNode }) { return <div className="flex gap-3"><div className="flex w-7 justify-center"><div className="w-px bg-border" /></div><p className="py-2 text-xs text-muted-foreground">↓ {children}</p></div> }
