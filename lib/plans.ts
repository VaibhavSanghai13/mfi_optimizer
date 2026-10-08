import type { JlgGroup, Officer, UnassignedReason } from '@prisma/client'
import { db } from './db'
import { fromMin, toMin } from './format'
import { planInclude, toPlan } from './mappers'
import { loadSettings } from './settings'
import { buildMatrix, type TravelMatrix } from './travel/matrix'
import { type LatLng, osrmRouteGeometry, TravelServiceError } from './travel/osrm'
import type { Plan, Settings } from './types'

/**
 * Optimize orchestration (the "glue" of the app):
 *
 *   database → travel matrix (OSRM + cache) → Python optimizer → road geometry
 *            → not-scheduled reasons + KPIs → saved as a DRAFT plan
 *
 * The Python function never touches the database; everything it needs is sent in
 * one request (contract: optimizer/schemas.py, times in minutes from midnight).
 */

/** Thrown when the Python optimizer cannot be reached or fails; the message is safe to show. */
export class OptimizerError extends Error {
  constructor(detail: string) {
    super('Route optimizer unavailable — try again.', { cause: detail })
    this.name = 'OptimizerError'
  }
}

/** Thrown for bad selections (unknown ids, nothing selected); the message is safe to show. */
export class PlanInputError extends Error {}

export type OptimizeInput = {
  branchId: string
  userId: string
  /** The caller's session JWT, forwarded to the optimizer (it checks the role itself). */
  token: string
  date: string
  officerIds: string[]
  groupIds: string[]
}

// ── Optimizer contract (mirrors optimizer/schemas.py) ─────────────────────
type OptimizerStop = { group_id: string; arrival: number; wait: number; start: number; end: number; departure: number; travel_from_prev: number }
type OptimizerRoute = {
  officer_id: string; start: number; end: number; stops: OptimizerStop[]; return_travel: number
  break_start: number | null; break_end: number | null; total_travel: number; total_wait: number; total_meeting: number
}
type OptimizerResponse = { status: 'optimal' | 'partial' | 'infeasible'; solver_status: string; solve_time_sec: number; routes: OptimizerRoute[]; dropped: string[] }

/**
 * Where the Python optimizer lives. Set OPTIMIZER_URL explicitly in production
 * (https://<your-domain>/api/optimize). Fallbacks: Vercel's production domain, then the
 * local uvicorn server used by `npm run dev`.
 */
const optimizerUrl = () =>
  process.env.OPTIMIZER_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/api/optimize`
    : 'http://127.0.0.1:8000/api/optimize')

export async function optimizePlan(input: OptimizeInput): Promise<Plan> {
  if (input.officerIds.length === 0) throw new PlanInputError('Select at least one officer.')
  if (input.groupIds.length === 0) throw new PlanInputError('Select at least one meeting.')

  // 1. Load what was selected (only active records of this branch count).
  const [settings, officers, groups] = await Promise.all([
    loadSettings(input.branchId),
    db.officer.findMany({ where: { id: { in: input.officerIds }, branchId: input.branchId, active: true }, orderBy: { name: 'asc' } }),
    db.jlgGroup.findMany({ where: { id: { in: input.groupIds }, branchId: input.branchId, active: true }, orderBy: { centerCode: 'asc' } }),
  ])
  if (officers.length !== new Set(input.officerIds).size) throw new PlanInputError('Some selected officers are not active in this branch.')
  if (groups.length !== new Set(input.groupIds).size) throw new PlanInputError('Some selected meetings are not active in this branch.')

  // 2. Travel matrix. Node order: officers' start locations first, then groups.
  const points: LatLng[] = [...officers.map((o) => ({ lat: o.startLat, lng: o.startLng })), ...groups.map((g) => ({ lat: g.lat, lng: g.lng }))]
  const matrix = await buildMatrix(points, settings)
  const officerNode = (i: number) => i
  const groupNode = (i: number) => officers.length + i

  // 3. Solve.
  const result = await callOptimizer(input.token, {
    time_matrix: matrix.minutes,
    officers: officers.map((o, i) => ({
      id: o.id, node: officerNode(i), shift_start: toMin(o.shiftStart), shift_end: toMin(o.shiftEnd),
      break_start: toMin(o.breakStart), break_duration: o.breakDurationMin, max_meetings: o.maxMeetingsPerDay,
    })),
    groups: groups.map((g, i) => ({
      id: g.id, node: groupNode(i), window_start: toMin(g.windowStart), window_end: toMin(g.windowEnd),
      duration: g.meetingDurationMin, penalty: penaltyFor(g, settings), officer_id: g.assignedOfficerId,
    })),
    buffer_min: settings.bufferMin,
    allow_late_arrival: settings.allowLateArrival,
    balance_workload: settings.balanceWorkload,
    time_limit_sec: settings.solverTimeLimitSec,
  })

  // 4. Turn the answer into routes with times, distances and road geometry.
  const nodeOfGroup = new Map(groups.map((g, i) => [g.id, groupNode(i)]))
  const routes = []
  for (const [i, officer] of officers.entries()) {
    const route = result.routes.find((r) => r.officer_id === officer.id)
    routes.push(await buildRoute(officer, officerNode(i), route, groups, nodeOfGroup, matrix, settings.osrmUrl))
  }

  // 5. Why each dropped group could not be scheduled, then the KPIs.
  const unassigned = result.dropped.map((groupId) => {
    const g = groups.find((x) => x.id === groupId)!
    return { groupId, reason: classifyDrop(g, nodeOfGroup.get(groupId)!, officers, matrix, settings) }
  })
  const planned = groups.length - unassigned.length
  const high = groups.filter((g) => g.priority === 'high')
  const shiftMin = (o: Officer) => toMin(o.shiftEnd) - toMin(o.shiftStart)
  const utilization = routes.reduce((sum, r, i) => sum + (r.totalMeetingMin + r.totalTravelMin) / shiftMin(officers[i]), 0) / routes.length

  console.info(
    `[optimize] ${input.date}: ${officers.length} officers, ${groups.length} meetings | travel cache ${matrix.hits} hits / ${matrix.misses} misses | solver ${result.solve_time_sec}s (${result.solver_status}) | ${result.status}`,
  )

  // 6. Save everything in one statement (a draft until the manager presses Save).
  const row = await db.plan.create({
    data: {
      branchId: input.branchId,
      date: new Date(`${input.date}T00:00:00Z`),
      status: result.status,
      solveTimeSec: result.solve_time_sec,
      saved: false,
      meetingsPlanned: planned,
      meetingsTotal: groups.length,
      highPriorityCovered: high.filter((g) => !result.dropped.includes(g.id)).length,
      highPriorityTotal: high.length,
      totalDistanceKm: round1(routes.reduce((s, r) => s + r.totalDistanceKm, 0)),
      totalTravelMin: routes.reduce((s, r) => s + r.totalTravelMin, 0),
      avgUtilizationPct: Math.round(utilization * 100),
      createdBy: input.userId,
      routes: { create: routes.map(({ stops, ...route }) => ({ ...route, stops: { create: stops } })) },
      unassigned: { create: unassigned },
    },
    include: planInclude,
  })
  return toPlan(row)
}

async function callOptimizer(token: string, body: unknown): Promise<OptimizerResponse> {
  let response: Response
  try {
    response = await fetch(optimizerUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
      cache: 'no-store',
    })
  } catch (error) {
    throw new OptimizerError(`Optimizer request failed: ${(error as Error).message}`)
  }
  if (!response.ok) throw new OptimizerError(`Optimizer ${response.status}: ${await response.text()}`)
  return response.json()
}

/** Settings hold the "cost of skipping" per priority. */
function penaltyFor(group: JlgGroup, settings: Settings) {
  return { high: settings.penaltyHigh, medium: settings.penaltyMedium, low: settings.penaltyLow }[group.priority]
}

/** One officer's route in the Plan shape (times as "HH:MM", distances in km). */
async function buildRoute(
  officer: Officer, depot: number, route: OptimizerRoute | undefined,
  groups: JlgGroup[], nodeOfGroup: Map<string, number>, matrix: TravelMatrix, osrmUrl: string,
) {
  const start = { lat: officer.startLat, lng: officer.startLng }
  const legs = route?.stops ?? []
  if (legs.length === 0) {
    // Not used today: an empty route that "starts and ends" at the shift start, as in the reference.
    return {
      officerId: officer.id, startTime: officer.shiftStart, endTime: officer.shiftStart,
      totalTravelMin: 0, totalDistanceKm: 0, totalWaitMin: 0, totalMeetingMin: 0, returnTravelMin: 0, returnDistanceKm: 0,
      breakStart: null, breakEnd: null, geometry: [[start.lng, start.lat]] as [number, number][], stops: [],
    }
  }

  let prev = depot
  const stops = legs.map((s, i) => {
    const node = nodeOfGroup.get(s.group_id)!
    const km = matrix.km[prev][node] ?? 0
    prev = node
    return {
      sequence: i + 1, groupId: s.group_id,
      arrivalTime: fromMin(s.arrival), waitMin: s.wait, meetingStart: fromMin(s.start), meetingEnd: fromMin(s.end),
      departureTime: fromMin(s.departure), travelMinFromPrev: s.travel_from_prev, distanceKmFromPrev: round1(km),
    }
  })
  const returnKm = matrix.km[prev][depot] ?? 0

  const places = [start, ...legs.map((s) => groups.find((g) => g.id === s.group_id)!), start].map((p) => ({ lat: p.lat, lng: p.lng }))
  let geometry: [number, number][]
  try {
    geometry = await osrmRouteGeometry(osrmUrl, places)
  } catch (error) {
    // The plan is still correct without the road shape; fall back to straight lines.
    if (!(error instanceof TravelServiceError)) throw error
    console.error('Route geometry unavailable, using straight lines:', error.cause)
    geometry = places.map((p) => [p.lng, p.lat])
  }

  return {
    officerId: officer.id,
    startTime: fromMin(route!.start),
    endTime: fromMin(route!.end),
    totalTravelMin: route!.total_travel,
    totalDistanceKm: round1(stops.reduce((s, x) => s + x.distanceKmFromPrev, 0) + returnKm),
    totalWaitMin: route!.total_wait,
    totalMeetingMin: route!.total_meeting,
    returnTravelMin: route!.return_travel,
    returnDistanceKm: round1(returnKm),
    breakStart: route!.break_start === null ? null : fromMin(route!.break_start),
    breakEnd: route!.break_end === null ? null : fromMin(route!.break_end),
    geometry,
    stops,
  }
}

/**
 * The reason shown for a group the optimizer left out (flow.md §6.2):
 *   unreachable           — OSRM found no road to it from any selected officer
 *   time_window_conflict  — no officer can get there before its window closes
 *   low_priority_dropped  — it is low priority (skipped so others fit)
 *   exceeds_working_hours — otherwise: there was simply not enough working time
 */
function classifyDrop(group: JlgGroup, node: number, officers: Officer[], matrix: TravelMatrix, settings: Settings): UnassignedReason {
  // Officers who may visit it (a pinned group only its own officer, if working today).
  const allowed = group.assignedOfficerId ? officers.filter((o) => o.id === group.assignedOfficerId) : officers
  const travelFrom = (o: Officer) => matrix.minutes[officers.indexOf(o)][node]
  if (allowed.length > 0 && allowed.every((o) => travelFrom(o) === null)) return 'unreachable'

  // Leaving at the very start of the shift, can anyone start the meeting in time?
  const latestStart = toMin(group.windowEnd) - group.meetingDurationMin + (settings.allowLateArrival ? 15 : 0)
  const canMakeIt = allowed.some((o) => {
    const travel = travelFrom(o)
    return travel !== null && Math.max(toMin(o.shiftStart) + travel, toMin(group.windowStart)) <= latestStart
  })
  if (!canMakeIt) return 'time_window_conflict'
  return group.priority === 'low' ? 'low_priority_dropped' : 'exceeds_working_hours'
}

const round1 = (n: number) => Math.round(n * 10) / 10

// ── Reading plans ───────────────────────────────────────────────────────

/** Saved plans of a branch, newest first (drafts are never listed). */
export async function listSavedPlans(branchId: string): Promise<Plan[]> {
  const rows = await db.plan.findMany({
    where: { branchId, saved: true },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    include: planInclude,
  })
  return rows.map(toPlan)
}

export async function getPlan(id: string, branchId: string): Promise<Plan | null> {
  const row = await db.plan.findUnique({ where: { id }, include: planInclude })
  return row && row.branchId === branchId ? toPlan(row) : null
}

export async function savePlan(id: string, branchId: string): Promise<Plan | null> {
  const existing = await db.plan.findUnique({ where: { id }, select: { branchId: true } })
  if (!existing || existing.branchId !== branchId) return null
  return toPlan(await db.plan.update({ where: { id }, data: { saved: true }, include: planInclude }))
}

/** The latest saved plan in which this officer has at least one stop (My Day). */
export async function latestPlanForOfficer(officerId: string): Promise<Plan | null> {
  const row = await db.plan.findFirst({
    where: { saved: true, routes: { some: { officerId, stops: { some: {} } } } },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    include: planInclude,
  })
  return row ? toPlan(row) : null
}
