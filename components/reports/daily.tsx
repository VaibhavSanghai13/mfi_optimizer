'use client'

import { Badge } from '@/components/ui-kit'
import { MiniBar } from '@/components/reports/charts'
import { Panel, ReportActions, StatCard } from '@/components/reports/parts'
import { downloadCsv } from '@/lib/csv'
import { fmtDate, fmtDuration, fmtKm, fmtRupees, fmtTime, unassignedLabel } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { dayInsights, UTILISATION_FLOOR_PCT, weekdayNames, type DayReport, type WeekReport } from '@/lib/reports'
import type { JLGGroup, Settings } from '@/lib/types'

export function DailyReport({
  week, day, selectedIndex, onSelectDay, groups, settings, branchName,
}: {
  week: WeekReport
  day: DayReport
  selectedIndex: number
  onSelectDay: (index: number) => void
  groups: JLGGroup[]
  settings: Settings
  branchName: string
}) {
  const t = useT()
  const insights = dayInsights(day, settings.solverTimeLimitSec)
  const maxDayKm = Math.max(...week.days.map((entry) => entry?.distanceKm ?? 0), 1)

  const exportCsv = () => downloadCsv(`daily-report-${day.date}.csv`, [
    [t('Officer'), t('Meetings'), t('Planned km'), t('Travel (min)'), t('Waiting (min)'), t('Back at branch'), t('Utilisation %'), t('Travel allowance (₹)')],
    ...day.officers.map((officer) => [officer.name, officer.meetings, officer.plannedKm, officer.travelMin, officer.waitMin, officer.endTime ?? '', officer.utilisationPct, officer.allowance]),
    [t('Branch total'), day.meetingsPlanned, day.distanceKm, day.travelMin, day.waitMin, '', day.avgUtilisationPct, day.allowance],
  ])

  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{t('Daily branch report')}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            {t('{planned} of {total} meetings planned · {km}', { planned: day.meetingsPlanned, total: day.meetingsTotal, km: fmtKm(day.distanceKm) })}
          </h2>
        </div>
        <ReportActions branchName={branchName} onExportCsv={exportCsv} />
      </header>

      {/* The week in context: pick any day that has a saved plan. */}
      <div className="flex flex-wrap items-start gap-2 print:hidden">
        {week.days.map((entry, index) => {
          const iso = weekdayNames[index]
          const selected = index === selectedIndex
          return (
            <button key={iso} type="button" disabled={!entry} onClick={() => onSelectDay(index)}
              className={`w-[104px] rounded-lg border p-2.5 text-left transition-colors disabled:opacity-40 ${selected ? 'border-foreground bg-card ring-1 ring-foreground' : 'bg-card hover:bg-muted/50'}`}>
              <p className="text-[11px] font-medium">{t(iso)} {entry ? entry.date.slice(8) : ''}</p>
              <div className="mt-2 h-6 w-full rounded bg-muted">
                {entry && <div className="h-full rounded bg-foreground" style={{ width: `${(entry.distanceKm / maxDayKm) * 100}%` }} />}
              </div>
              <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">{entry ? `${Math.round(entry.distanceKm)} km` : t('No plan')}</p>
            </button>
          )
        })}
        <p className="max-w-[180px] pt-2 text-[11px] leading-snug text-muted-foreground">
          {t('Bars show planned km per day, week of {range}.', { range: `${fmtDate(week.startIso)} – ${fmtDate(week.endIso)}` })}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Meetings scheduled" value={`${day.meetingsPlanned} / ${day.meetingsTotal}`} note="of groups selected" />
        <StatCard label="High-priority covered" value={`${day.highCovered} / ${day.highTotal}`} note="must be 100%" />
        <StatCard label="Planned distance" value={fmtKm(day.distanceKm)} note="road km, all officers" />
        <StatCard label="Planned travel" value={fmtDuration(day.travelMin)} note="two-wheeler time" />
        <StatCard label="Avg utilisation" value={`${day.avgUtilisationPct}%`} note="of shift in travel + meetings" />
        <StatCard label="Travel allowance" value={fmtRupees(day.allowance)} note={t('planned km × ₹{rate}/km', { rate: settings.travelAllowancePerKm })} />
      </div>

      {insights.length > 0 && (
        <Panel title={t('Needs a look')} aside={t('{count} items', { count: insights.length })}>
          <ul className="space-y-2.5">
            {insights.map((insight, index) => (
              <li key={index} className="flex gap-2.5 text-sm">
                <span aria-hidden className={`mt-1.5 size-1.5 shrink-0 rounded-full ${insight.tone === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                <span className="text-muted-foreground">{t(insight.template, insight.vars)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title={t('By officer')} aside={t('Solver: {status} · {seconds}s', { status: t(day.status), seconds: day.solveTimeSec.toFixed(1) })}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                {['Officer', 'Meetings', 'Planned km', 'Travel', 'Waiting', 'Back at branch', 'Utilisation', 'TA (₹)'].map((head, index) => (
                  <th key={head} className={`pb-2 font-medium ${index > 0 ? 'text-right' : ''}`}>{t(head)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {day.officers.map((officer) => (
                <tr key={officer.officerId} className="border-t">
                  <td className="py-2.5">
                    <span className="flex items-center gap-2">
                      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: officer.color }} />
                      {officer.name}
                      {officer.meetings === 0 && <Badge tone="medium">{t('Idle')}</Badge>}
                    </span>
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{officer.meetings}</td>
                  <td className="py-2.5 text-right tabular-nums">{officer.plannedKm.toFixed(1)}</td>
                  <td className="py-2.5 text-right tabular-nums">{officer.travelMin ? fmtDuration(officer.travelMin) : '—'}</td>
                  <td className="py-2.5 text-right tabular-nums">{officer.waitMin ? `${officer.waitMin} min` : '—'}</td>
                  <td className="py-2.5 text-right tabular-nums">{officer.endTime ? fmtTime(officer.endTime) : '—'}</td>
                  <td className="py-2.5">
                    <span className="flex items-center justify-end gap-2">
                      <MiniBar pct={officer.utilisationPct} color={officer.utilisationPct < UTILISATION_FLOOR_PCT ? '#f59e0b' : undefined} />
                      <span className="w-9 text-right tabular-nums">{officer.utilisationPct}%</span>
                    </span>
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{officer.allowance}</td>
                </tr>
              ))}
              <tr className="border-t-2 font-medium">
                <td className="py-2.5">{t('Branch total')}</td>
                <td className="py-2.5 text-right tabular-nums">{day.meetingsPlanned}</td>
                <td className="py-2.5 text-right tabular-nums">{day.distanceKm.toFixed(1)}</td>
                <td className="py-2.5 text-right tabular-nums">{fmtDuration(day.travelMin)}</td>
                <td className="py-2.5 text-right tabular-nums">{day.waitMin} min</td>
                <td />
                <td className="py-2.5 text-right tabular-nums">{day.avgUtilisationPct}% {t('avg')}</td>
                <td className="py-2.5 text-right tabular-nums">{day.allowance}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('Not scheduled')} aside={t('{count} groups', { count: day.skipped })}>
          {day.skipped === 0 ? (
            <p className="text-sm text-muted-foreground">{t('Every selected meeting fit into the plan.')}</p>
          ) : (
            <ul className="space-y-2">
              {day.unassigned.map((entry) => {
                const group = groups.find((g) => g.id === entry.groupId)
                return (
                  <li key={entry.groupId} className="rounded-md border bg-muted/40 p-2.5">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {group?.name ?? t('Unknown group')}
                      {group && <Badge tone={group.priority}>{t(group.priority === 'high' ? 'High' : group.priority === 'medium' ? 'Medium' : 'Low')}</Badge>}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t(unassignedLabel[entry.reason])}</p>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <Panel title={t('This week')}>
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>{['Day', 'Meetings', 'km', 'Util.', 'Skipped'].map((head, index) => <th key={head} className={`pb-2 font-medium ${index > 0 ? 'text-right' : ''}`}>{t(head)}</th>)}</tr>
            </thead>
            <tbody>
              {week.days.map((entry, index) => (
                <tr key={weekdayNames[index]} className={`border-t ${index === selectedIndex ? 'bg-muted/50' : ''}`}>
                  <td className="py-2">{t(weekdayNames[index])} {entry ? entry.date.slice(8) : ''}</td>
                  <td className="py-2 text-right tabular-nums">{entry ? `${entry.meetingsPlanned} / ${entry.meetingsTotal}` : '—'}</td>
                  <td className="py-2 text-right tabular-nums">{entry ? entry.distanceKm.toFixed(1) : '—'}</td>
                  <td className="py-2 text-right tabular-nums">{entry ? `${entry.avgUtilisationPct}%` : '—'}</td>
                  <td className="py-2 text-right tabular-nums">{entry ? entry.skipped : '—'}</td>
                </tr>
              ))}
              <tr className="border-t-2 font-medium">
                <td className="py-2">{t('Week')}</td>
                <td className="py-2 text-right tabular-nums">{week.meetingsPlanned} / {week.meetingsTotal}</td>
                <td className="py-2 text-right tabular-nums">{week.distanceKm.toFixed(1)}</td>
                <td className="py-2 text-right tabular-nums">{week.avgUtilisationPct}%</td>
                <td className="py-2 text-right tabular-nums">{week.skipped}</td>
              </tr>
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  )
}
