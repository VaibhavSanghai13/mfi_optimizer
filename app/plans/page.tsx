'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { PageHeader, StatusBadge } from '@/components/ui-kit'
import { getOfficers, getPlans, getUsers } from '@/lib/api-client'
import { fmtDate, fmtKm } from '@/lib/format'
import { useT } from '@/lib/i18n'
import type { Officer, Plan, User } from '@/lib/types'

export default function PlansPage() {
  const t = useT()
  const [plans, setPlans] = useState<Plan[] | null>(null); const [officers, setOfficers] = useState<Officer[]>([]); const [users, setUsers] = useState<User[]>([])
  useEffect(() => { getPlans().then(setPlans); getOfficers().then(setOfficers); getUsers().then(setUsers) }, [])
  return <AppShell><div className="mx-auto max-w-7xl space-y-6">
    <PageHeader eyebrow={t('Planning workspace')} title={t('Plans')} description={t('Saved route plans for your branch, newest first.')} actions={<Link href="/planner" className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">{t('New plan')}</Link>} />
    <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr>{['Date', 'Officers', 'Meetings planned', 'Distance', 'Status', 'Created', ''].map((h) => <th key={h} className="px-4 py-3 font-medium">{h && t(h)}</th>)}</tr></thead>
      <tbody>{!plans && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">{t('Loading plans')}…</td></tr>}{plans?.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">{t('No saved plans yet. Optimize routes in the Planner and press Save plan.')}</td></tr>}
        {plans?.map((p) => <tr key={p.id} className="border-t hover:bg-muted/30"><td className="px-4 py-3 font-medium">{fmtDate(p.date)}</td><td className="px-4 py-3"><div className="flex -space-x-1">{p.routes.filter((r) => r.stops.length).map((r) => { const o = officers.find((x) => x.id === r.officerId); return o && <span key={o.id} title={o.name} className="flex size-6 items-center justify-center rounded-full border-2 border-card text-[9px] font-semibold text-white" style={{ background: o.color }}>{o.name.split(' ').map((n) => n[0]).join('')}</span> })}</div></td><td className="px-4 py-3">{p.kpis.meetingsPlanned} / {p.kpis.meetingsTotal}</td><td className="px-4 py-3">{fmtKm(p.kpis.totalDistanceKm)}</td><td className="px-4 py-3"><StatusBadge status={p.status} /></td><td className="px-4 py-3 text-xs text-muted-foreground">{users.find((u) => u.id === p.createdBy)?.name ?? '—'}<div>{fmtDate(p.createdAt)}</div></td><td className="px-4 py-3 text-right"><Link href={`/plans/${p.id}`} className="text-xs font-medium underline-offset-4 hover:underline">{t('Open')} →</Link></td></tr>)}</tbody></table></div>
  </div></AppShell>
}
