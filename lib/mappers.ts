import type { Branch as BranchRow, JlgGroup as GroupRow, Officer as OfficerRow, Prisma } from '@prisma/client'
import type { Branch, JLGGroup, Officer, Plan } from './types'

/**
 * Database rows → the API/UI contract in lib/types.ts. Prisma already uses the same
 * camelCase field names; only a few fields need converting (dates, fixed literals)
 * and database-only fields are dropped.
 */

export const toBranch = (row: BranchRow): Branch => ({
  id: row.id,
  name: row.name,
  district: row.district,
  taluka: row.taluka,
  address: row.address,
  lat: row.lat,
  lng: row.lng,
})

export const toOfficer = (row: OfficerRow): Officer => ({
  id: row.id,
  name: row.name,
  branchId: row.branchId,
  startLat: row.startLat,
  startLng: row.startLng,
  shiftStart: row.shiftStart,
  shiftEnd: row.shiftEnd,
  breakStart: row.breakStart,
  breakDurationMin: row.breakDurationMin,
  maxMeetingsPerDay: row.maxMeetingsPerDay,
  vehicle: 'two_wheeler',
  color: row.color,
  active: row.active,
})

export const toGroup = (row: GroupRow): JLGGroup => ({
  id: row.id,
  name: row.name,
  centerCode: row.centerCode,
  village: row.village,
  taluka: row.taluka,
  district: row.district,
  lat: row.lat,
  lng: row.lng,
  memberCount: row.memberCount,
  meetingDay: row.meetingDay,
  meetingFrequency: row.meetingFrequency,
  windowStart: row.windowStart,
  windowEnd: row.windowEnd,
  meetingDurationMin: row.meetingDurationMin,
  priority: row.priority,
  priorityReason: row.priorityReason,
  assignedOfficerId: row.assignedOfficerId,
  active: row.active,
  source: row.source,
  createdBy: row.createdBy,
  updatedAt: row.updatedAt.toISOString(),
})

/** What to load with a plan so it can be turned into the full Plan shape. */
export const planInclude = {
  routes: {
    include: { stops: { orderBy: { sequence: 'asc' } } },
    orderBy: { officer: { name: 'asc' } },
  },
  unassigned: true,
} satisfies Prisma.PlanInclude

type PlanRow = Prisma.PlanGetPayload<{ include: typeof planInclude }>

export const toPlan = (row: PlanRow): Plan => ({
  id: row.id,
  branchId: row.branchId,
  date: row.date.toISOString().slice(0, 10),
  createdAt: row.createdAt.toISOString(),
  createdBy: row.createdBy,
  status: row.status,
  solveTimeSec: row.solveTimeSec,
  saved: row.saved,
  routes: row.routes.map((r) => ({
    officerId: r.officerId,
    stops: r.stops.map((s) => ({
      sequence: s.sequence,
      groupId: s.groupId,
      arrivalTime: s.arrivalTime,
      waitMin: s.waitMin,
      meetingStart: s.meetingStart,
      meetingEnd: s.meetingEnd,
      departureTime: s.departureTime,
      travelMinFromPrev: s.travelMinFromPrev,
      distanceKmFromPrev: s.distanceKmFromPrev,
    })),
    totalTravelMin: r.totalTravelMin,
    totalDistanceKm: r.totalDistanceKm,
    totalWaitMin: r.totalWaitMin,
    totalMeetingMin: r.totalMeetingMin,
    startTime: r.startTime,
    endTime: r.endTime,
    returnTravelMin: r.returnTravelMin,
    returnDistanceKm: r.returnDistanceKm,
    breakStart: r.breakStart,
    breakEnd: r.breakEnd,
    geometry: r.geometry as [number, number][],
  })),
  unassigned: row.unassigned.map((u) => ({ groupId: u.groupId, reason: u.reason })),
  kpis: {
    meetingsPlanned: row.meetingsPlanned,
    meetingsTotal: row.meetingsTotal,
    highPriorityCovered: row.highPriorityCovered,
    highPriorityTotal: row.highPriorityTotal,
    totalDistanceKm: row.totalDistanceKm,
    totalTravelMin: row.totalTravelMin,
    avgUtilizationPct: row.avgUtilizationPct,
  },
})
