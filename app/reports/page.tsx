'use client'

import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { DailyReport } from '@/components/reports/daily'
import { EmptyReport } from '@/components/reports/parts'
import { PayrollReport } from '@/components/reports/payroll'
import { WeeklyReport } from '@/components/reports/weekly'
import { PageHeader, useToast } from '@/components/ui-kit'
import { getApprovals, getGroups, getOfficers, getPlans, getSettings, type ApprovalDto } from '@/lib/api-client'
import { useAuth } from '@/lib/auth'
import { fmtDate } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { addDays, buildWeekReport, weeksWithPlans, weekStartIso } from '@/lib/reports'
import type { JLGGroup, Officer, Plan, Settings } from '@/lib/types'

const tabs = ['Daily', 'Weekly', 'Payroll export'] as const
type Tab = (typeof tabs)[number]

export default function ReportsPage() {
  return <AppShell><Reports /></AppShell>
}

function Reports() {
  const t = useT()
  const { branchName } = useAuth()
  const [tab, setTab] = useState<Tab>('Daily')
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [officers, setOfficers] = useState<Officer[]>([])
  const [groups, setGroups] = useState<JLGGroup[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [weekStart, setWeekStart] = useState('')
  const [requestedDay, setRequestedDay] = useState(0)
  const [approvals, setApprovals] = useState<ApprovalDto[]>([])
  const [toast, showToast] = useToast()

  useEffect(() => {
    Promise.all([getPlans(), getOfficers(), getGroups(), getSettings()])
      .then(([loadedPlans, loadedOfficers, loadedGroups, loadedSettings]) => {
        setPlans(loadedPlans)
        setOfficers(loadedOfficers)
        setGroups(loadedGroups)
        setSettings(loadedSettings)
        // Open on the most recent week that has a saved plan.
        if (loadedPlans.length) setWeekStart(weekStartIso(loadedPlans[0].date))
      })
      .catch((error: Error) => showToast(error.message))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Approvals belong to a week, so they are refetched whenever the week changes.
  useEffect(() => {
    if (!weekStart) return
    let cancelled = false
    getApprovals(weekStart)
      .then((loaded) => !cancelled && setApprovals(loaded))
      .catch((error: Error) => !cancelled && showToast(error.message))
    return () => { cancelled = true }
  }, [weekStart]) // eslint-disable-line react-hooks/exhaustive-deps

  const weeks = useMemo(() => (plans ? weeksWithPlans(plans) : []), [plans])
  const week = useMemo(
    () => (plans && settings && weekStart ? buildWeekReport(weekStart, plans, officers, settings.travelAllowancePerKm) : null),
    [plans, officers, settings, weekStart],
  )

  // Derived, not stored: switching week can leave the requested day without a plan,
  // in which case the latest day that has one is shown instead.
  const dayIndex = !week || week.days[requestedDay] ? requestedDay : Math.max(0, week.days.findLastIndex((day) => day !== null))
  const selectedDay = week?.days[dayIndex] ?? null

  const header = (
    <PageHeader
      eyebrow={t('Analytics')}
      title={t('Reports')}
      description={week ? `${branchName} · ${fmtDate(week.startIso)} – ${fmtDate(week.endIso)}` : branchName}
      actions={weeks.length > 1 ? (
        <label className="flex items-center gap-2 text-xs text-muted-foreground print:hidden">
          {t('Week')}
          <select value={weekStart} onChange={(event) => setWeekStart(event.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm text-foreground">
            {weeks.map((start) => <option key={start} value={start}>{fmtDate(start)} – {fmtDate(addDays(start, 5))}</option>)}
          </select>
        </label>
      ) : undefined}
    />
  )

  if (!plans || !settings) return <div className="mx-auto max-w-7xl space-y-6">{header}<EmptyReport message={`${t('Loading')}…`} />{toast}</div>
  if (!week) return <div className="mx-auto max-w-7xl space-y-6">{header}<EmptyReport message={t('No saved plans yet. Optimize routes in the Planner and press Save plan.')} />{toast}</div>

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {header}
      <div role="tablist" className="flex gap-1 border-b print:hidden">
        {tabs.map((name) => (
          <button key={name} role="tab" aria-selected={tab === name} onClick={() => setTab(name)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === name ? 'border-foreground font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t(name)}
          </button>
        ))}
      </div>

      {tab === 'Daily' && (selectedDay
        ? <DailyReport week={week} day={selectedDay} selectedIndex={dayIndex} onSelectDay={setRequestedDay} groups={groups} settings={settings} branchName={branchName} />
        : <EmptyReport message={t('No plan was saved for this week.')} />)}

      {tab === 'Weekly' && <WeeklyReport week={week} settings={settings} branchName={branchName} />}

      {tab === 'Payroll export' && (
        <PayrollReport week={week} settings={settings} branchName={branchName} approvals={approvals} onApprovalsChange={setApprovals} onError={showToast} />
      )}
      {toast}
    </div>
  )
}
