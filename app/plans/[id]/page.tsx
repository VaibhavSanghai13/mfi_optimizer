'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { RouteMap } from '@/components/maps'
import { InfeasibleNotice, KpiStrip, Legend, OfficerCards, planMapData, UnassignedPanel } from '@/components/planner/plan-parts'
import { Timeline } from '@/components/planner/timeline'
import { buttonClass, PageHeader } from '@/components/ui-kit'
import { getBranches, getGroups, getOfficers, getPlan } from '@/lib/api-client'
import { useAuth } from '@/lib/auth'
import { fmtDate, unassignedLabel } from '@/lib/format'
import type { Branch, JLGGroup, Officer, Plan } from '@/lib/types'

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined); const [branch, setBranch] = useState<Branch | null>(null); const [groups, setGroups] = useState<JLGGroup[]>([]); const [officers, setOfficers] = useState<Officer[]>([]); const [hidden, setHidden] = useState<Set<string>>(new Set())
  const { user } = useAuth()
  // getPlan throws on 404, which shows the "Plan not found" state.
  useEffect(() => { getPlan(id).then((p) => setPlan(p ?? null)).catch(() => setPlan(null)); getBranches().then((b) => setBranch(b.find((x) => x.id === user?.branchId) ?? b[0])); getGroups().then(setGroups); getOfficers().then(setOfficers) }, [id, user?.branchId])
  const exportCsv = () => {
    if (!plan) return
    const rows = [['Officer', 'Stop', 'Group', 'Village', 'Arrival', 'Wait (min)', 'Meeting start', 'Meeting end', 'Travel (min)', 'Distance (km)']]
    for (const r of plan.routes) for (const s of r.stops) { const g = groups.find((x) => x.id === s.groupId); rows.push([officers.find((o) => o.id === r.officerId)?.name ?? '', String(s.sequence), g?.name ?? '', g?.village ?? '', s.arrivalTime, String(s.waitMin), s.meetingStart, s.meetingEnd, String(s.travelMinFromPrev), String(s.distanceKmFromPrev)]) }
    for (const u of plan.unassigned) { const g = groups.find((x) => x.id === u.groupId); rows.push(['Not scheduled', '', g?.name ?? '', g?.village ?? '', '', '', '', '', '', unassignedLabel[u.reason]]) }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `route-plan-${plan.date}.csv`; a.click(); URL.revokeObjectURL(a.href)
  }
  const toggle = (oid: string) => setHidden((h) => { const n = new Set(h); if (n.has(oid)) n.delete(oid); else n.add(oid); return n })
  const map = planMapData(plan ?? null, groups, officers, hidden)
  return <AppShell><div className="mx-auto max-w-7xl space-y-4">
    {plan === undefined && <p className="p-8 text-center text-sm text-muted-foreground">Loading plan…</p>}
    {plan === null && <div className="rounded-xl border bg-card p-10 text-center"><p className="font-medium">Plan not found</p><p className="mt-1 text-sm text-muted-foreground">It may belong to another branch, or the link is wrong.</p><Link href="/plans" className="mt-4 inline-block text-sm underline">Back to plans</Link></div>}
    {plan && <>
      <Link href="/plans" className="text-sm text-muted-foreground hover:text-foreground">← All plans</Link>
      <PageHeader eyebrow="Plan detail" title={`Routes for ${fmtDate(plan.date)}`} description={`${branch?.name ?? ''} · ${plan.saved ? 'Saved plan' : 'Unsaved draft'}`} actions={<><button onClick={exportCsv} className={buttonClass.outline}><Download size={15} />Export CSV</button><button onClick={() => window.print()} className={buttonClass.outline}><Printer size={15} />Print</button></>} />
      {plan.status === 'infeasible' && <InfeasibleNotice />}
      <KpiStrip plan={plan} />
      <div className="relative h-[420px] overflow-hidden rounded-xl border bg-muted">{branch && groups.length > 0 && <RouteMap className="h-full w-full" branch={branch} points={map.points} routes={map.routes} fitKey={plan.id} />}<div className="absolute right-3 top-3 z-[500]"><Legend plan={plan} officers={officers} hidden={hidden} onToggle={toggle} /></div></div>
      <Timeline plan={plan} groups={groups} officers={officers} />
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]"><OfficerCards plan={plan} officers={officers} /><UnassignedPanel plan={plan} groups={groups} /></div>
    </>}
  </div></AppShell>
}
