'use client'

import { useState } from 'react'
import { ReportActions } from '@/components/reports/parts'
import { buttonClass, Spinner } from '@/components/ui-kit'
import { approveAllowance, withdrawAllowance, type ApprovalDto } from '@/lib/api-client'
import { downloadCsv } from '@/lib/csv'
import { fmtDate, fmtDuration, fmtRupees, fmtTime } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { buildStatement, weekdayNames, type WeekReport } from '@/lib/reports'
import type { Settings } from '@/lib/types'

/**
 * Travel-allowance statements, one per officer per week.
 *
 * Amounts are always recomputed from the saved plans; approving stores only the
 * sign-off, so re-opening an approved week can never show a stale figure.
 */
export function PayrollReport({
  week, settings, branchName, approvals, onApprovalsChange, onError,
}: {
  week: WeekReport
  settings: Settings
  branchName: string
  approvals: ApprovalDto[]
  onApprovalsChange: (approvals: ApprovalDto[]) => void
  onError: (message: string) => void
}) {
  const t = useT()
  const [selectedId, setSelectedId] = useState(week.officers[0]?.officerId ?? '')
  const [busy, setBusy] = useState(false)

  const selected = week.officers.find((officer) => officer.officerId === selectedId) ?? week.officers[0]
  const statement = selected ? buildStatement(week, selected.officerId) : null
  const approvalOf = (officerId: string) => approvals.find((approval) => approval.officerId === officerId)
  const approved = selected ? approvalOf(selected.officerId) : undefined
  const period = `${fmtDate(week.startIso)} – ${fmtDate(week.endIso)}`

  async function toggleApproval() {
    if (!selected) return
    setBusy(true)
    try {
      if (approved) {
        await withdrawAllowance(selected.officerId, week.startIso)
        onApprovalsChange(approvals.filter((approval) => approval.officerId !== selected.officerId))
      } else {
        const created = await approveAllowance(selected.officerId, week.startIso)
        onApprovalsChange([...approvals, created])
      }
    } catch (error) {
      onError((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const exportAll = () => downloadCsv(`travel-allowance-${week.startIso}.csv`, [
    [t('Travel allowance statements'), period, branchName],
    [],
    [t('Officer'), t('Date'), t('Meetings'), t('Planned km'), t('Travel (min)'), t('Back at branch'), t('Allowance (₹)'), t('Status')],
    ...week.officers.flatMap((officer) => {
      const rows = buildStatement(week, officer.officerId)?.rows ?? []
      const status = approvalOf(officer.officerId) ? t('Approved') : t('Pending')
      return rows.map((row) => [officer.name, row.date, row.meetings, row.plannedKm, row.travelMin, row.endTime ?? '', row.allowance, status])
    }),
    [],
    [t('Officer'), t('Days'), t('Meetings'), t('Planned km'), t('Total allowance (₹)'), t('Status')],
    ...week.officers.map((officer) => [officer.name, officer.days, officer.meetings, officer.plannedKm, officer.allowance, approvalOf(officer.officerId) ? t('Approved') : t('Pending')]),
  ])

  if (!selected || !statement) return <p className="text-sm text-muted-foreground">{t('No officer had a published plan this week.')}</p>

  const maxDayKm = Math.max(...selected.dailyKm.map((km) => km ?? 0), 1)
  const longestDay = Math.max(...selected.dailyKm.map((km) => km ?? 0))

  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{t('Travel allowance · payroll')}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            {t('{approved} of {total} statements approved', { approved: approvals.length, total: week.officers.length })}
          </h2>
        </div>
        <ReportActions branchName={branchName} onExportCsv={exportAll} />
      </header>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-3 print:hidden">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t('Branch allowance, this week')}</p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight">{fmtRupees(week.allowance)}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t('{km} planned km × ₹{rate}/km · {count} officers', { km: week.distanceKm.toFixed(1), rate: settings.travelAllowancePerKm, count: week.officers.length })}
            </p>
          </div>

          <ul className="overflow-hidden rounded-xl border bg-card">
            {week.officers.map((officer) => {
              const isSelected = officer.officerId === selected.officerId
              const officerApproval = approvalOf(officer.officerId)
              return (
                <li key={officer.officerId}>
                  <button onClick={() => setSelectedId(officer.officerId)}
                    className={`flex w-full items-start justify-between gap-2 border-l-2 px-3 py-2.5 text-left hover:bg-muted/50 ${isSelected ? 'border-l-foreground bg-muted/40' : 'border-l-transparent'}`}>
                    <span>
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: officer.color }} />
                        {officer.name}
                      </span>
                      <span className="mt-0.5 block pl-4 text-[11px] text-muted-foreground">
                        {t('{meetings} meetings · {km} km', { meetings: officer.meetings, km: officer.plannedKm.toFixed(1) })}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-medium tabular-nums">{fmtRupees(officer.allowance)}</span>
                      <span className={`block text-[11px] ${officerApproval ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                        {officerApproval ? t('Approved') : t('Pending')}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="rounded-xl border bg-muted/40 p-3">
            <p className="text-xs font-medium">{t('How allowance is worked out')}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {t('Planned road km for each published plan (branch → every stop → branch) × the rate in Settings. Days with no meetings pay nothing. Drafts are excluded.')}
            </p>
          </div>
        </aside>

        <section className="rounded-xl border bg-card p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{t('Travel allowance statement')}</p>
              <h3 className="mt-2 flex items-center gap-2 text-xl font-semibold tracking-tight">
                <span aria-hidden className="size-2.5 rounded-full" style={{ background: selected.color }} />
                {selected.name}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{t('Field officer · {branch}', { branch: branchName })}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{t('Amount payable')}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{fmtRupees(selected.allowance)}</p>
              <p className={`mt-1 text-xs ${approved ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                {approved ? t('Approved by {name}', { name: approved.approvedByName }) : t('Pending approval')}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 print:hidden">
            <button onClick={toggleApproval} disabled={busy} className={approved ? buttonClass.outline : buttonClass.primary}>
              {busy && <Spinner />}{approved ? t('Withdraw approval') : t('Approve statement')}
            </button>
          </div>

          <dl className="mt-6 grid gap-4 border-t pt-5 sm:grid-cols-4">
            {[
              { label: 'Period', value: period },
              { label: 'Days in field', value: String(selected.days) },
              { label: 'Meetings planned', value: String(selected.meetings) },
              { label: 'Rate', value: t('₹{rate} per km', { rate: settings.travelAllowancePerKm }) },
            ].map((item) => (
              <div key={item.label}>
                <dt className="text-[11px] text-muted-foreground">{t(item.label)}</dt>
                <dd className="mt-1 text-sm font-medium">{item.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <p className="text-xs font-medium">{t('Week at a glance')}</p>
              <div className="mt-3 flex h-28 items-end gap-2">
                {selected.dailyKm.map((km, index) => (
                  <div key={weekdayNames[index]} className="flex flex-1 flex-col items-center gap-1.5">
                    <span className="text-[9px] tabular-nums text-muted-foreground">{km ? Math.round(km) : ''}</span>
                    <div className="w-full rounded-sm" title={km ? `${km.toFixed(1)} km` : '—'}
                      style={{ height: km ? `${Math.max((km / maxDayKm) * 100, 6)}%` : '2px', background: km ? selected.color : 'var(--border)' }} />
                    <span className="text-[9px] text-muted-foreground">{t(weekdayNames[index])}</span>
                  </div>
                ))}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3">
              {[
                { label: 'km per meeting', value: String(selected.kmPerMeeting), note: t('branch: {value}', { value: week.kmPerMeeting }) },
                { label: 'Avg utilisation', value: `${selected.avgUtilisationPct}%`, note: t('branch: {value}%', { value: week.avgUtilisationPct }) },
                { label: 'Share of branch km', value: `${week.distanceKm ? Math.round((selected.plannedKm / week.distanceKm) * 100) : 0}%`, note: t('of {km} km', { km: week.distanceKm.toFixed(1) }) },
                { label: 'Longest day', value: `${longestDay.toFixed(1)} km`, note: t('planned km') },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border p-3">
                  <dt className="text-[11px] text-muted-foreground">{t(item.label)}</dt>
                  <dd className="mt-1 text-lg font-semibold tracking-tight">{item.value}</dd>
                  <p className="text-[10px] text-muted-foreground">{item.note}</p>
                </div>
              ))}
            </dl>
          </div>

          <table className="mt-6 w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                {['Date', 'Plan', 'Meetings', 'Planned km', 'Travel', 'Back at branch', 'Allowance (₹)'].map((head, index) => (
                  <th key={head} className={`border-b pb-2 font-medium ${index > 1 ? 'text-right' : ''}`}>{t(head)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statement.rows.map((row) => (
                <tr key={row.date} className="border-b">
                  <td className="py-2.5">{fmtDate(row.date)}</td>
                  <td className="py-2.5 text-muted-foreground">{t('Published plan')}</td>
                  <td className="py-2.5 text-right tabular-nums">{row.meetings}</td>
                  <td className="py-2.5 text-right tabular-nums">{row.plannedKm.toFixed(1)}</td>
                  <td className="py-2.5 text-right tabular-nums">{fmtDuration(row.travelMin)}</td>
                  <td className="py-2.5 text-right tabular-nums">{row.endTime ? fmtTime(row.endTime) : '—'}</td>
                  <td className="py-2.5 text-right tabular-nums">{row.allowance}</td>
                </tr>
              ))}
              <tr className="font-medium">
                <td className="py-2.5" colSpan={2}>{t('Total')}</td>
                <td className="py-2.5 text-right tabular-nums">{selected.meetings}</td>
                <td className="py-2.5 text-right tabular-nums">{selected.plannedKm.toFixed(1)}</td>
                <td className="py-2.5 text-right tabular-nums">{fmtDuration(selected.travelMin)}</td>
                <td />
                <td className="py-2.5 text-right tabular-nums">{selected.allowance.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-10 grid gap-10 sm:grid-cols-2">
            {['Field officer', 'Branch manager approval'].map((role) => (
              <div key={role}>
                <div className="border-t" />
                <p className="mt-1.5 text-[11px] text-muted-foreground">{t(role)}</p>
              </div>
            ))}
          </div>

          <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
            {t('Generated from saved plans. Figures are planned road distances, not GPS-tracked.')}
          </p>
        </section>
      </div>
    </div>
  )
}
