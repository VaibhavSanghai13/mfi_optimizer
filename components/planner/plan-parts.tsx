'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { fmtDuration, fmtKm, fmtTime, unassignedLabel } from '@/lib/format'
import { useT, type Translate } from '@/lib/i18n'
import type { Branch, JLGGroup, Officer, Plan } from '@/lib/types'
import type { MapPoint, MapRoute } from '../maps'
import { PriorityBadge, StatusBadge } from '../ui-kit'

/** Turns a plan into map markers and polylines, skipping officers hidden in the legend. */
export function planMapData(plan: Plan | null, groups: JLGGroup[], officers: Officer[], hidden: Set<string> = new Set(), unplannedGroups: JLGGroup[] = groups, t: Translate = (text) => text): { points: MapPoint[]; routes: MapRoute[] } {
  if (!plan) return { points: unplannedGroups.map((g) => ({ id: g.id, lat: g.lat, lng: g.lng, color: '#737373', popup: <GroupPopup group={g} t={t} /> })), routes: [] }
  const points: MapPoint[] = []
  const routes: MapRoute[] = []
  for (const route of plan.routes) {
    const officer = officers.find((o) => o.id === route.officerId)
    if (!officer || hidden.has(officer.id) || !route.stops.length) continue
    routes.push({ id: route.officerId, color: officer.color, positions: route.geometry.map(([lng, lat]) => [lat, lng]) })
    for (const stop of route.stops) {
      const g = groups.find((x) => x.id === stop.groupId)
      if (g) points.push({ id: g.id, lat: g.lat, lng: g.lng, color: officer.color, label: String(stop.sequence), popup: <GroupPopup group={g} t={t} extra={t('{officer} · stop {sequence} · arrive {arrival}, meeting {from}–{to}', { officer: officer.name, sequence: stop.sequence, arrival: fmtTime(stop.arrivalTime), from: fmtTime(stop.meetingStart), to: fmtTime(stop.meetingEnd) })} /> })
    }
  }
  for (const u of plan.unassigned) {
    const g = groups.find((x) => x.id === u.groupId)
    if (g) points.push({ id: g.id, lat: g.lat, lng: g.lng, color: '#94a3b8', hollow: true, popup: <GroupPopup group={g} t={t} extra={`${t('Not scheduled')}: ${t(unassignedLabel[u.reason])}`} /> })
  }
  return { points, routes }
}

function GroupPopup({ group, extra, t }: { group: JLGGroup; extra?: string; t: Translate }) {
  return <div className="space-y-0.5 text-xs"><strong>{group.name}</strong><div>{group.village} · {t('{count} members', { count: group.memberCount })}</div><div>{t('Window')} {fmtTime(group.windowStart)}–{fmtTime(group.windowEnd)} · {t('{min} min', { min: group.meetingDurationMin })} · {t('{priority} priority', { priority: t(group.priority === 'high' ? 'High' : group.priority === 'medium' ? 'Medium' : 'Low') })}</div>{extra && <div className="pt-1 font-medium">{extra}</div>}</div>
}

export function KpiStrip({ plan }: { plan: Plan }) {
  const t = useT()
  const k = plan.kpis
  const items = [
    ['Meetings planned', `${k.meetingsPlanned} / ${k.meetingsTotal}`],
    ['High-priority covered', `${k.highPriorityCovered} / ${k.highPriorityTotal}`],
    ['Total distance', fmtKm(k.totalDistanceKm)],
    ['Total travel time', fmtDuration(k.totalTravelMin)],
    ['Avg. utilization', `${k.avgUtilizationPct}%`],
  ]
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{items.map(([label, value]) => <div key={label} className="rounded-lg border bg-card p-3"><p className="text-[11px] text-muted-foreground">{t(label)}</p><p className="mt-1 text-lg font-semibold tracking-tight">{value}</p></div>)}<div className="rounded-lg border bg-card p-3"><p className="text-[11px] text-muted-foreground">{t('Solver status')}</p><div className="mt-1.5 flex items-center gap-2"><StatusBadge status={plan.status} /><span className="text-xs text-muted-foreground">{plan.solveTimeSec}s</span></div></div></div>
}

export function UnassignedPanel({ plan, groups }: { plan: Plan; groups: JLGGroup[] }) {
  const t = useT()
  return <div className="rounded-xl border bg-card"><div className="flex items-center justify-between border-b px-4 py-3"><h3 className="text-sm font-semibold">{t('Not scheduled')}</h3><span className="text-xs text-muted-foreground">{t('{count} groups', { count: plan.unassigned.length })}</span></div>
    {plan.unassigned.length === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground">{t('Every selected meeting fit into the plan.')}</p> : <ul className="divide-y">{plan.unassigned.map((u) => { const g = groups.find((x) => x.id === u.groupId); return g && <li key={u.groupId} className="flex items-start justify-between gap-3 px-4 py-3"><div><p className="text-sm font-medium">{g.name}</p><p className="text-xs text-muted-foreground">{g.village} · {fmtTime(g.windowStart)}–{fmtTime(g.windowEnd)}</p><p className="mt-1 text-xs">{t(unassignedLabel[u.reason])}</p></div><PriorityBadge priority={g.priority} /></li> })}</ul>}</div>
}

export function OfficerCards({ plan, officers }: { plan: Plan; officers: Officer[] }) {
  const t = useT()
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{plan.routes.map((r) => { const o = officers.find((x) => x.id === r.officerId); if (!o) return null; return <div key={r.officerId} className="rounded-xl border bg-card p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-semibold"><span className="size-2.5 rounded-full" style={{ background: o.color }} />{o.name}</div><span className="text-xs text-muted-foreground">{t('{count} stops', { count: r.stops.length })}</span></div>
    {r.stops.length ? <dl className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><dt className="text-muted-foreground">{t('Distance')}</dt><dd className="font-medium">{fmtKm(r.totalDistanceKm)}</dd></div><div><dt className="text-muted-foreground">{t('Travel')}</dt><dd className="font-medium">{fmtDuration(r.totalTravelMin)}</dd></div><div><dt className="text-muted-foreground">{t('Back at')}</dt><dd className="font-medium">{fmtTime(r.endTime)}</dd></div></dl> : <p className="mt-3 text-xs text-muted-foreground">{t('No meetings assigned.')}</p>}
    {r.stops.length > 0 && <Link href={`/plans/${plan.id}/officer/${o.id}`} className="mt-3 inline-block text-xs font-medium underline-offset-4 hover:underline">{t('View day sheet')} →</Link>}</div> })}</div>
}

export function Legend({ plan, officers, hidden, onToggle }: { plan: Plan; officers: Officer[]; hidden: Set<string>; onToggle: (id: string) => void }) {
  const t = useT()
  return <div className="rounded-lg border bg-card/95 p-2 text-xs shadow-sm backdrop-blur"><p className="mb-1 px-1 font-semibold">{t('Routes')}</p>{plan.routes.filter((r) => r.stops.length).map((r) => { const o = officers.find((x) => x.id === r.officerId); return o && <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-muted"><input type="checkbox" checked={!hidden.has(o.id)} onChange={() => onToggle(o.id)} className="size-3" /><span className="h-1 w-4 rounded" style={{ background: o.color }} />{o.name}</label> })}{plan.unassigned.length > 0 && <div className="mt-1 flex items-center gap-2 px-1 py-0.5 text-muted-foreground"><span className="size-3 rounded-full border-2 border-slate-400" />{t('Not scheduled')}</div>}</div>
}

export function InfeasibleNotice() {
  const t = useT()
  return <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><AlertTriangle className="mt-0.5 size-4 text-destructive" /><div><p className="font-medium">{t('No meeting could be scheduled')}</p><p className="mt-1 text-muted-foreground">{t('Try including more officers, widening meeting windows, extending shift hours in Settings, or lowering the two-wheeler speed factor.')}</p></div></div>
}

export function PlanHeaderLine({ plan, branch }: { plan: Plan; branch?: Branch }) {
  const t = useT()
  return <p className="text-xs text-muted-foreground">{branch?.name ?? t('Branch')} · {t('{count} officers on the road', { count: plan.routes.filter((r) => r.stops.length).length })} · <StatusBadge status={plan.status} /></p>
}
