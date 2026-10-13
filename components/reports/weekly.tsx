'use client'

import { useState } from 'react'
import { CoverageBars, Legend, Sparkline, StackedBars, UtilisationGrid, UtilisationLine, type Series } from '@/components/reports/charts'
import { Panel, ReportActions, StatCard } from '@/components/reports/parts'
import { downloadCsv } from '@/lib/csv'
import { fmtDate, fmtDuration, fmtKm, fmtRupees } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { UTILISATION_FLOOR_PCT, weekdayNames, type WeekReport } from '@/lib/reports'
import type { Settings } from '@/lib/types'

/** The stacked chart can show any of three per-officer measures on the same days. */
const measures = ['Planned km', 'Meetings', 'Allowance'] as const
type Measure = (typeof measures)[number]

export function WeeklyReport({ week, settings, branchName }: { week: WeekReport; settings: Settings; branchName: string }) {
  const t = useT()
  const [measure, setMeasure] = useState<Measure>('Planned km')

  const series: Series[] = week.officers.map((officer) => ({ id: officer.officerId, name: officer.name, color: officer.color }))
  const labels = [...weekdayNames]

  const valueFor = (dayIndex: number, officerIndex: number) => {
    const officer = week.officers[officerIndex]
    const km = officer.dailyKm[dayIndex] ?? 0
    if (measure === 'Planned km') return km
    if (measure === 'Allowance') return Math.round(km * settings.travelAllowancePerKm)
    return week.days[dayIndex]?.officers.find((row) => row.officerId === officer.officerId)?.meetings ?? 0
  }
  const values = labels.map((_, dayIndex) => week.officers.map((_officer, officerIndex) => valueFor(dayIndex, officerIndex)))

  const lowestDay = week.days.reduce<{ index: number; pct: number } | null>((lowest, day, index) =>
    day && (!lowest || day.avgUtilisationPct < lowest.pct) ? { index, pct: day.avgUtilisationPct } : lowest, null)
  const topOfficer = week.officers.reduce((top, officer) => (officer.plannedKm > top.plannedKm ? officer : top), week.officers[0])

  const exportCsv = () => downloadCsv(`weekly-report-${week.startIso}.csv`, [
    [t('Officer'), t('Days'), t('Meetings'), t('Planned km'), t('km / meeting'), t('Travel (min)'), t('Avg utilisation %'), t('Travel allowance (₹)')],
    ...week.officers.map((officer) => [officer.name, officer.days, officer.meetings, officer.plannedKm, officer.kmPerMeeting, officer.travelMin, officer.avgUtilisationPct, officer.allowance]),
    [],
    [t('Day'), t('Meetings'), t('km'), t('Util.'), t('Skipped')],
    ...week.days.map((day, index) => [t(weekdayNames[index]), day ? `${day.meetingsPlanned}/${day.meetingsTotal}` : '', day?.distanceKm ?? '', day?.avgUtilisationPct ?? '', day?.skipped ?? '']),
  ])

  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            {t('Week {number} · planned', { number: week.weekNumber })}
          </p>
          <h2 className="mt-2 max-w-3xl text-2xl font-semibold leading-snug tracking-tight">
            {week.highTotal > 0 && week.highCovered === week.highTotal
              ? t('Every high-priority group covered; {name} carries {pct}% of the week’s kilometres.', { name: topOfficer?.name ?? '—', pct: week.distanceKm ? Math.round((topOfficer.plannedKm / week.distanceKm) * 100) : 0 })
              : t('{covered} of {total} high-priority groups covered across {days} working days.', { covered: week.highCovered, total: week.highTotal, days: week.workingDays })}
          </h2>
        </div>
        <ReportActions branchName={branchName} onExportCsv={exportCsv} />
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Planned distance" value={fmtKm(week.distanceKm)} note={t('{days} working days', { days: week.workingDays })} />
        <StatCard label="Meetings scheduled" value={`${week.meetingsPlanned} / ${week.meetingsTotal}`} note={t('{pct}% of selected', { pct: week.meetingsTotal ? Math.round((week.meetingsPlanned / week.meetingsTotal) * 100) : 0 })} />
        <StatCard label="High-priority covered" value={`${week.highCovered} / ${week.highTotal}`} note={week.highCovered === week.highTotal ? 'no misses' : 'needs attention'} />
        <StatCard label="km per meeting" value={String(week.kmPerMeeting)} note="lower is tighter routing" />
        <StatCard label="Avg utilisation" value={`${week.avgUtilisationPct}%`} note={t('{count} days under {floor}%', { count: week.days.filter((day) => day && day.avgUtilisationPct < UTILISATION_FLOOR_PCT).length, floor: UTILISATION_FLOOR_PCT })} />
        <StatCard label="Travel allowance" value={fmtRupees(week.allowance)} note={t('at ₹{rate}/km', { rate: settings.travelAllowancePerKm })} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title={t('Planned km by day and officer')}>
          <div className="-mt-2 mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{t('Road km from saved plans, stacked by officer')}</p>
            <div className="flex rounded-md border p-0.5 print:hidden">
              {measures.map((option) => (
                <button key={option} onClick={() => setMeasure(option)}
                  className={`rounded px-2.5 py-1 text-[11px] ${measure === option ? 'bg-muted font-medium' : 'text-muted-foreground'}`}>
                  {t(option)}
                </button>
              ))}
            </div>
          </div>
          <StackedBars labels={labels.map((label) => t(label))} series={series} values={values} unit={measure === 'Planned km' ? ' km' : ''} />
          <div className="mt-3"><Legend series={series} /></div>
        </Panel>

        <Panel title={t('Average utilisation')}>
          <p className="-mt-2 mb-3 text-xs text-muted-foreground">{t('Share of shift spent travelling or in meetings')}</p>
          <UtilisationLine
            labels={labels.map((label) => t(label))}
            values={week.days.map((day) => day?.avgUtilisationPct ?? null)}
            floorPct={UTILISATION_FLOOR_PCT}
            floorLabel={t('{floor}% floor', { floor: UTILISATION_FLOOR_PCT })}
          />
          {lowestDay && (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {t('{day} is the week’s lowest day at {pct}%.', { day: t(weekdayNames[lowestDay.index]), pct: lowestDay.pct })}
            </p>
          )}
        </Panel>

        <Panel title={t('Utilisation by officer and day')}>
          <p className="-mt-2 mb-3 text-xs text-muted-foreground">{t('Blank = not rostered; amber = rostered but under {floor}%', { floor: UTILISATION_FLOOR_PCT })}</p>
          <UtilisationGrid
            labels={labels.map((label) => t(label))}
            rows={week.officers.map((officer) => ({ id: officer.officerId, name: officer.name, values: officer.dailyUtilisation }))}
            floorPct={UTILISATION_FLOOR_PCT}
          />
        </Panel>

        <Panel title={t('Coverage')}>
          <p className="-mt-2 mb-3 text-xs text-muted-foreground">{t('Meetings scheduled vs selected')}</p>
          <CoverageBars rows={week.days.flatMap((day, index) => (day ? [{ label: t(weekdayNames[index]), scheduled: day.meetingsPlanned, total: day.meetingsTotal }] : []))} />
          <div className="mt-4 flex gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-sm bg-foreground" />{t('Scheduled')}</span>
            <span className="flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-sm bg-red-500" />{t('Not scheduled')}</span>
          </div>
        </Panel>
      </div>

      <Panel title={t('Officers this week')} aside={`${fmtDate(week.startIso)} – ${fmtDate(week.endIso)}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                {['Officer', 'Days', 'Meetings', 'Planned km', 'km / meeting', 'Travel', 'Avg util.', 'Daily km', 'TA (₹)'].map((head, index) => (
                  <th key={head} className={`pb-2 font-medium ${index > 0 && index < 7 ? 'text-right' : index >= 8 ? 'text-right' : ''}`}>{t(head)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {week.officers.map((officer) => (
                <tr key={officer.officerId} className="border-t">
                  <td className="py-2.5">
                    <span className="flex items-center gap-2">
                      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: officer.color }} />
                      {officer.name}
                    </span>
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{officer.days}</td>
                  <td className="py-2.5 text-right tabular-nums">{officer.meetings}</td>
                  <td className="py-2.5 text-right tabular-nums">{officer.plannedKm.toFixed(1)}</td>
                  <td className="py-2.5 text-right tabular-nums">{officer.kmPerMeeting}</td>
                  <td className="py-2.5 text-right tabular-nums">{fmtDuration(officer.travelMin)}</td>
                  <td className="py-2.5 text-right tabular-nums">{officer.avgUtilisationPct}%</td>
                  <td className="py-2.5 pl-4"><Sparkline values={officer.dailyKm} color={officer.color} unit={t('km')} /></td>
                  <td className="py-2.5 text-right tabular-nums">{officer.allowance.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
