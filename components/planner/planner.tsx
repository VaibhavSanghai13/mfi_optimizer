'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ListFilter, Maximize2, Route, Save, Search } from 'lucide-react'
import { getBranches, getGroups, getOfficers, getSettings, optimizeRoutes, savePlan } from '@/lib/api-client'
import { useAuth } from '@/lib/auth'
import { fmtDate, fmtTime, todayIso, weekdayOf } from '@/lib/format'
import { useT } from '@/lib/i18n'
import type { Branch, JLGGroup, Officer, Plan, Priority, Settings } from '@/lib/types'
import { RouteMap } from '../maps'
import { inputClass, PriorityBadge, ReasonChip, Spinner, useToast } from '../ui-kit'
import { InfeasibleNotice, KpiStrip, Legend, OfficerCards, planMapData, UnassignedPanel } from './plan-parts'
import { Timeline } from './timeline'

export function Planner() {
  const [branch, setBranch] = useState<Branch | null>(null); const [groups, setGroups] = useState<JLGGroup[] | null>(null); const [officers, setOfficers] = useState<Officer[]>([]); const [settings, setSettings] = useState<Settings | null>(null)
  const [date, setDate] = useState(todayIso); const [tab, setTab] = useState<'meetings' | 'officers'>('meetings'); const [search, setSearch] = useState(''); const [priority, setPriority] = useState<Priority | ''>('')
  const [excludedGroups, setExcludedGroups] = useState<Set<string>>(new Set()); const [excludedOfficers, setExcludedOfficers] = useState<Set<string>>(new Set())
  const [plan, setPlan] = useState<Plan | null>(null); const [busy, setBusy] = useState<'' | 'travel' | 'optimize'>(''); const [error, setError] = useState('')
  const [hidden, setHidden] = useState<Set<string>>(new Set()); const [resultsTab, setResultsTab] = useState<'summary' | 'timeline'>('summary'); const [resultsOpen, setResultsOpen] = useState(true); const [panelOpen, setPanelOpen] = useState(false); const [fitCount, setFitCount] = useState(0)
  const [toast, showToast] = useToast(); const { user } = useAuth(); const t = useT()
  useEffect(() => { getBranches().then((b) => setBranch(b.find((x) => x.id === user?.branchId) ?? b[0])); getGroups().then(setGroups); getOfficers().then(setOfficers); getSettings().then(setSettings) }, [user?.branchId])

  const weekday = weekdayOf(date)
  const dayGroups = useMemo(() => (groups ?? []).filter((g) => g.active && g.meetingDay === weekday).sort((a, b) => a.windowStart.localeCompare(b.windowStart)), [groups, weekday])
  const visibleGroups = dayGroups.filter((g) => (!priority || g.priority === priority) && `${g.name} ${g.village}`.toLowerCase().includes(search.toLowerCase()))
  const activeOfficers = officers.filter((o) => o.active)
  const selectedGroups = dayGroups.filter((g) => !excludedGroups.has(g.id))
  const selectedOfficers = activeOfficers.filter((o) => !excludedOfficers.has(o.id))
  const toggle = (set: Set<string>, id: string) => { const next = new Set(set); if (next.has(id)) next.delete(id); else next.add(id); return next }
  const changeDate = (value: string) => { setDate(value); setPlan(null); setExcludedGroups(new Set()); setError('') }

  const optimize = async () => {
    if (!branch || !settings) return
    setError(''); setBusy('travel'); setHidden(new Set()); setPanelOpen(false)
    const timer = setTimeout(() => setBusy('optimize'), 700)
    try {
      const result = await optimizeRoutes({ branchId: branch.id, date, officerIds: selectedOfficers.map((o) => o.id), groupIds: selectedGroups.map((g) => g.id), settings })
      setPlan(result); setResultsOpen(true); setResultsTab('summary'); setFitCount((c) => c + 1)
    } catch (e) { setError((e as Error).message) } // e.g. "Travel-time service unavailable — try again."
    finally { clearTimeout(timer); setBusy('') }
  }
  const save = async () => { if (!plan) return; try { setPlan(await savePlan(plan.id)); showToast(t('Plan saved to plan history.')) } catch (e) { showToast((e as Error).message) } }

  const map = planMapData(plan, groups ?? [], officers, hidden, selectedGroups, t)
  const canOptimize = !busy && selectedGroups.length > 0 && selectedOfficers.length > 0 && !!settings

  const panel = <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-card">
    <div className="grid grid-cols-2 border-b p-1">{(['meetings', 'officers'] as const).map((name) => <button key={name} onClick={() => setTab(name)} className={`rounded-md py-1.5 text-sm ${tab === name ? 'bg-muted font-medium' : 'text-muted-foreground'}`}>{t(name === 'meetings' ? 'Meetings' : 'Officers')} <span className="text-xs text-muted-foreground">{name === 'meetings' ? selectedGroups.length : selectedOfficers.length}</span></button>)}</div>
    {tab === 'meetings' ? <>
      <div className="space-y-2 border-b p-3"><div className="relative"><Search size={15} className="absolute left-3 top-2.5 text-muted-foreground" /><input className={`${inputClass} pl-9`} placeholder={t('Search meetings')} value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="flex items-center gap-2"><ListFilter size={14} className="text-muted-foreground" /><select aria-label={t('Filter by priority')} value={priority} onChange={(e) => setPriority(e.target.value as Priority | '')} className="h-8 flex-1 rounded-md border bg-background px-2 text-xs"><option value="">{t('All priorities')}</option><option value="high">{t('High')}</option><option value="medium">{t('Medium')}</option><option value="low">{t('Low')}</option></select>
          <button onClick={() => setExcludedGroups(excludedGroups.size ? new Set() : new Set(dayGroups.map((g) => g.id)))} className="h-8 rounded-md border px-2 text-xs">{t(excludedGroups.size ? 'Select all' : 'Clear all')}</button></div></div>
      <ul className="flex-1 divide-y overflow-y-auto">{!groups && <li className="p-4 text-sm text-muted-foreground">{t('Loading meetings')}…</li>}{groups && !weekday && <li className="p-4 text-sm text-muted-foreground">{t('No meetings are held on Sundays. Pick another date.')}</li>}{groups && weekday && !visibleGroups.length && <li className="p-4 text-sm text-muted-foreground">{t('No meetings match.')}</li>}
        {visibleGroups.map((g) => <li key={g.id}><label className="flex cursor-pointer gap-3 px-3 py-2.5 hover:bg-muted/50"><input type="checkbox" className="mt-1" checked={!excludedGroups.has(g.id)} onChange={() => setExcludedGroups(toggle(excludedGroups, g.id))} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="truncate text-sm font-medium">{g.name}</p><PriorityBadge priority={g.priority} /></div><p className="text-xs text-muted-foreground">{g.village} · {fmtTime(g.windowStart)}–{fmtTime(g.windowEnd)} · {t('{min} min', { min: g.meetingDurationMin })}</p><div className="mt-1"><ReasonChip reason={g.priorityReason} /></div></div></label></li>)}</ul>
    </> : <ul className="flex-1 divide-y overflow-y-auto">{activeOfficers.map((o) => <li key={o.id}><label className="flex cursor-pointer items-center gap-3 px-3 py-3 hover:bg-muted/50"><input type="checkbox" checked={!excludedOfficers.has(o.id)} onChange={() => setExcludedOfficers(toggle(excludedOfficers, o.id))} /><span className="size-2.5 rounded-full" style={{ background: o.color }} /><div className="flex-1"><p className="text-sm font-medium">{o.name}</p><p className="text-xs text-muted-foreground">{fmtTime(o.shiftStart)}–{fmtTime(o.shiftEnd)} · {t('max {count} meetings', { count: o.maxMeetingsPerDay })}</p></div></label></li>)}</ul>}
    <div className="space-y-2 border-t bg-card p-3"><p className="text-xs text-muted-foreground">{t('{meetings} meetings · {officers} officers', { meetings: selectedGroups.length, officers: selectedOfficers.length })}</p><button disabled={!canOptimize} onClick={optimize} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50">{busy ? <><Spinner />{busy === 'travel' ? t('Fetching travel times…') : t('Optimizing routes…')}</> : <><Route size={16} />{t('Optimize Routes')}</>}</button></div>
  </div>

  return <div className="mx-auto max-w-[1600px] space-y-4">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('Planning workspace')}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">{t('Route planner')}</h1><p className="mt-1 text-sm text-muted-foreground">{weekday ? t('{count} meetings scheduled on {weekday}, {date}.', { count: dayGroups.length, weekday: t(weekday), date: fmtDate(date) }) : t('Pick a working day to plan.')}</p></div>
      <div className="flex items-center gap-2"><button onClick={() => setPanelOpen(true)} className="h-9 rounded-md border px-3 text-sm lg:hidden">{t('Meetings & officers')}</button><input type="date" aria-label={t('Plan date')} value={date} onChange={(e) => e.target.value && changeDate(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm" /></div></div>

    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <div className="hidden h-[600px] lg:block">{panel}</div>
      <div className="relative h-[420px] overflow-hidden rounded-xl border bg-muted lg:h-[600px]">
        {branch && <RouteMap className="h-full w-full" branch={branch} points={map.points} routes={map.routes} fitKey={`${date}-${fitCount}-${plan ? 'plan' : 'raw'}`} />}
        {!plan && !busy && <div className="pointer-events-none absolute inset-x-0 top-3 z-[500] flex justify-center"><p className="rounded-full border bg-card/95 px-3 py-1.5 text-xs shadow-sm">{t('Choose meetings and officers, then press Optimize Routes.')}</p></div>}
        {busy && <div className="absolute inset-0 z-[500] flex items-center justify-center bg-background/40 backdrop-blur-[1px]"><p className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm shadow"><Spinner />{busy === 'travel' ? t('Fetching travel times…') : t('Optimizing routes…')}</p></div>}
        {plan && <div className="absolute right-3 top-3 z-[500] space-y-2"><Legend plan={plan} officers={officers} hidden={hidden} onToggle={(id) => setHidden(toggle(hidden, id))} /></div>}
        {plan && <button onClick={() => setFitCount((c) => c + 1)} className="absolute bottom-3 right-3 z-[500] inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs shadow-sm"><Maximize2 size={13} />{t('Fit to routes')}</button>}
      </div>
    </div>
    {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

    {plan && <section className="rounded-xl border bg-muted/20">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5"><div className="flex items-center gap-1">{(['summary', 'timeline'] as const).map((name) => <button key={name} onClick={() => { setResultsTab(name); setResultsOpen(true) }} className={`rounded-md px-3 py-1.5 text-sm ${resultsTab === name && resultsOpen ? 'bg-card font-medium shadow-sm' : 'text-muted-foreground'}`}>{t(name === 'summary' ? 'Summary' : 'Timeline')}</button>)}</div>
        <div className="flex items-center gap-2"><button onClick={save} disabled={plan.saved} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-60"><Save size={14} />{t(plan.saved ? 'Saved' : 'Save plan')}</button><button onClick={() => setResultsOpen(!resultsOpen)} aria-label={t(resultsOpen ? 'Collapse results' : 'Expand results')} className="rounded-md border p-1.5"><ChevronDown size={14} className={resultsOpen ? '' : '-rotate-90'} /></button></div></div>
      {resultsOpen && <div className="space-y-4 p-4">{plan.status === 'infeasible' && <InfeasibleNotice />}
        {resultsTab === 'summary' ? <><KpiStrip plan={plan} /><div className="grid gap-4 xl:grid-cols-[1fr_380px]"><OfficerCards plan={plan} officers={officers} /><UnassignedPanel plan={plan} groups={groups ?? []} /></div></> : <Timeline plan={plan} groups={groups ?? []} officers={officers} />}</div>}
    </section>}

    {panelOpen && <div className="fixed inset-0 z-[1100] bg-black/30 lg:hidden" onClick={() => setPanelOpen(false)}><div className="absolute inset-y-0 left-0 w-full max-w-sm p-2" onClick={(e) => e.stopPropagation()}>{panel}</div></div>}
    {toast}
  </div>
}
