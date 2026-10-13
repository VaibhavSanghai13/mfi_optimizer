import { toMin } from './format'
import type { Officer, Plan, UnassignedGroup } from './types'

/**
 * Everything the Reports page shows, derived from saved plans.
 *
 * Reports never recompute routing — they read the planned values stored with each
 * plan, so a report and the plan it came from can never disagree. Utilisation uses
 * the same formula as the planner (lib/plans.ts): meeting + travel time over the
 * officer's shift length.
 */

/** Monday–Saturday; the branch does not hold meetings on Sunday. */
export const weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export type OfficerDay = {
  officerId: string
  name: string
  color: string
  meetings: number
  plannedKm: number
  travelMin: number
  waitMin: number
  meetingMin: number
  /** When the officer gets back to the branch; null when they were given no meetings. */
  endTime: string | null
  utilisationPct: number
  allowance: number
}

/** A sentence for the "Needs a look" panel. The template is translated by the component. */
export type Insight = { tone: 'warning' | 'info'; template: string; vars: Record<string, string | number> }

export type DayReport = {
  planId: string
  date: string
  status: Plan['status']
  solveTimeSec: number
  meetingsPlanned: number
  meetingsTotal: number
  highCovered: number
  highTotal: number
  distanceKm: number
  travelMin: number
  waitMin: number
  avgUtilisationPct: number
  allowance: number
  officers: OfficerDay[]
  unassigned: UnassignedGroup[]
  skipped: number
}

export type OfficerWeek = {
  officerId: string
  name: string
  color: string
  /** Days the officer was given at least one meeting. */
  days: number
  meetings: number
  plannedKm: number
  kmPerMeeting: number
  travelMin: number
  avgUtilisationPct: number
  allowance: number
  /** One entry per weekday, Mon–Sat; null where the officer was not rostered. */
  dailyKm: (number | null)[]
  dailyUtilisation: (number | null)[]
}

export type WeekReport = {
  startIso: string
  endIso: string
  weekNumber: number
  /** One entry per weekday, Mon–Sat; null where no plan was saved. */
  days: (DayReport | null)[]
  officers: OfficerWeek[]
  meetingsPlanned: number
  meetingsTotal: number
  highCovered: number
  highTotal: number
  distanceKm: number
  travelMin: number
  kmPerMeeting: number
  avgUtilisationPct: number
  allowance: number
  skipped: number
  workingDays: number
}

const round1 = (n: number) => Math.round(n * 10) / 10
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

// ── Dates ────────────────────────────────────────────────────────────────

const isoOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const dateOf = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`)

/** The Monday of the week containing `iso`. Sunday belongs to the week that just ended. */
export function weekStartIso(iso: string) {
  const date = dateOf(iso)
  const weekday = date.getDay()
  date.setDate(date.getDate() + (weekday === 0 ? -6 : 1 - weekday))
  return isoOf(date)
}

/** `addDays('2026-10-05', 2)` -> `'2026-10-07'` */
export function addDays(iso: string, days: number) {
  const date = dateOf(iso)
  date.setDate(date.getDate() + days)
  return isoOf(date)
}

/** ISO-8601 week number, so "Week 41" matches a calendar. */
export function isoWeekNumber(iso: string) {
  const date = dateOf(iso)
  // Thursday decides which year's week this is.
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
  const firstThursday = new Date(date.getFullYear(), 0, 4)
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7))
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000))
}

// ── One day ──────────────────────────────────────────────────────────────

export function buildDayReport(plan: Plan, officers: Officer[], ratePerKm: number): DayReport {
  const rows: OfficerDay[] = plan.routes.map((route) => {
    const officer = officers.find((o) => o.id === route.officerId)
    const shiftMin = officer ? toMin(officer.shiftEnd) - toMin(officer.shiftStart) : 0
    const busyMin = route.totalMeetingMin + route.totalTravelMin
    return {
      officerId: route.officerId,
      name: officer?.name ?? 'Unknown officer',
      color: officer?.color ?? '#71717a',
      meetings: route.stops.length,
      plannedKm: round1(route.totalDistanceKm),
      travelMin: route.totalTravelMin,
      waitMin: route.totalWaitMin,
      meetingMin: route.totalMeetingMin,
      endTime: route.stops.length ? route.endTime : null,
      utilisationPct: shiftMin > 0 ? Math.round((busyMin / shiftMin) * 100) : 0,
      allowance: Math.round(route.totalDistanceKm * ratePerKm),
    }
  })
  rows.sort((a, b) => b.meetings - a.meetings || a.name.localeCompare(b.name))
  return {
    planId: plan.id,
    date: plan.date.slice(0, 10),
    status: plan.status,
    solveTimeSec: plan.solveTimeSec,
    meetingsPlanned: plan.kpis.meetingsPlanned,
    meetingsTotal: plan.kpis.meetingsTotal,
    highCovered: plan.kpis.highPriorityCovered,
    highTotal: plan.kpis.highPriorityTotal,
    distanceKm: round1(plan.kpis.totalDistanceKm),
    travelMin: plan.kpis.totalTravelMin,
    waitMin: sum(rows.map((r) => r.waitMin)),
    avgUtilisationPct: plan.kpis.avgUtilizationPct,
    allowance: sum(rows.map((r) => r.allowance)),
    officers: rows,
    unassigned: plan.unassigned,
    skipped: plan.unassigned.length,
  }
}

/** Thresholds for the "Needs a look" panel — a route below this is worth a second glance. */
export const UTILISATION_FLOOR_PCT = 30
const LONG_WAIT_MIN = 30

export function dayInsights(day: DayReport, solverTimeLimitSec: number): Insight[] {
  const insights: Insight[] = []
  for (const officer of day.officers) {
    if (officer.meetings === 0) {
      insights.push({ tone: 'info', template: '{name} was selected but got no meetings. Check “Balance workload”, or leave the officer unticked so they aren’t counted against utilisation.', vars: { name: officer.name } })
    } else if (officer.utilisationPct < UTILISATION_FLOOR_PCT) {
      insights.push({ tone: 'warning', template: '{name} at {pct}% utilisation. Room for more groups on this route.', vars: { name: officer.name, pct: officer.utilisationPct } })
    }
    if (officer.waitMin >= LONG_WAIT_MIN) {
      insights.push({ tone: 'info', template: '{name} waits {min} min in total. A meeting window opens well after arrival — consider re-ordering or a different officer.', vars: { name: officer.name, min: officer.waitMin } })
    }
  }
  if (day.skipped > 0) {
    insights.push({ tone: 'warning', template: '{count} group(s) could not be scheduled. See the not-scheduled list for the reason.', vars: { count: day.skipped } })
  }
  if (day.status !== 'optimal' && day.solveTimeSec >= solverTimeLimitSec) {
    insights.push({ tone: 'info', template: 'Solver stopped at its {limit} s limit. Plan is the best found, not proven optimal.', vars: { limit: solverTimeLimitSec } })
  }
  return insights
}

// ── One week ─────────────────────────────────────────────────────────────

/** Every week that has at least one saved plan, newest first. */
export function weeksWithPlans(plans: Plan[]) {
  const starts = [...new Set(plans.map((plan) => weekStartIso(plan.date)))]
  return starts.sort((a, b) => b.localeCompare(a))
}

export function buildWeekReport(startIso: string, plans: Plan[], officers: Officer[], ratePerKm: number): WeekReport {
  const days = weekdayNames.map((_, index) => {
    const iso = addDays(startIso, index)
    const plan = plans.find((p) => p.date.slice(0, 10) === iso)
    return plan ? buildDayReport(plan, officers, ratePerKm) : null
  })
  const present = days.filter((day): day is DayReport => day !== null)

  // Officers appear in the order of the branch's officer list, so colours stay put
  // when a filter changes which officers have rows.
  const officerRows: OfficerWeek[] = officers
    .map((officer) => {
      const entries = days.map((day) => day?.officers.find((row) => row.officerId === officer.id) ?? null)
      const worked = entries.filter((entry): entry is OfficerDay => !!entry && entry.meetings > 0)
      const meetings = sum(worked.map((entry) => entry.meetings))
      const plannedKm = round1(sum(worked.map((entry) => entry.plannedKm)))
      return {
        officerId: officer.id,
        name: officer.name,
        color: officer.color,
        days: worked.length,
        meetings,
        plannedKm,
        kmPerMeeting: meetings ? round1(plannedKm / meetings) : 0,
        travelMin: sum(worked.map((entry) => entry.travelMin)),
        avgUtilisationPct: worked.length ? Math.round(sum(worked.map((entry) => entry.utilisationPct)) / worked.length) : 0,
        allowance: sum(worked.map((entry) => entry.allowance)),
        dailyKm: entries.map((entry) => (entry ? entry.plannedKm : null)),
        dailyUtilisation: entries.map((entry) => (entry ? entry.utilisationPct : null)),
      }
    })
    .filter((row) => row.dailyKm.some((km) => km !== null))

  const meetingsPlanned = sum(present.map((day) => day.meetingsPlanned))
  const distanceKm = round1(sum(present.map((day) => day.distanceKm)))
  return {
    startIso,
    endIso: addDays(startIso, 5),
    weekNumber: isoWeekNumber(startIso),
    days,
    officers: officerRows,
    meetingsPlanned,
    meetingsTotal: sum(present.map((day) => day.meetingsTotal)),
    highCovered: sum(present.map((day) => day.highCovered)),
    highTotal: sum(present.map((day) => day.highTotal)),
    distanceKm,
    travelMin: sum(present.map((day) => day.travelMin)),
    kmPerMeeting: meetingsPlanned ? round1(distanceKm / meetingsPlanned) : 0,
    avgUtilisationPct: present.length ? Math.round(sum(present.map((day) => day.avgUtilisationPct)) / present.length) : 0,
    allowance: sum(present.map((day) => day.allowance)),
    skipped: sum(present.map((day) => day.skipped)),
    workingDays: present.length,
  }
}

// ── Travel allowance statements ──────────────────────────────────────────

export type StatementRow = { date: string; planId: string; meetings: number; plannedKm: number; travelMin: number; endTime: string | null; allowance: number }
export type Statement = { officer: OfficerWeek; rows: StatementRow[] }

/** One officer's week, day by day — the body of a travel-allowance statement. */
export function buildStatement(week: WeekReport, officerId: string): Statement | null {
  const officer = week.officers.find((row) => row.officerId === officerId)
  if (!officer) return null
  const rows = week.days.flatMap((day, index) => {
    const entry = day?.officers.find((row) => row.officerId === officerId)
    if (!day || !entry || entry.meetings === 0) return []
    return [{ date: addDays(week.startIso, index), planId: day.planId, meetings: entry.meetings, plannedKm: entry.plannedKm, travelMin: entry.travelMin, endTime: entry.endTime, allowance: entry.allowance }]
  })
  return { officer, rows }
}
