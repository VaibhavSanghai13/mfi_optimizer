export type UserRole = 'manager' | 'field_officer'
export type MeetingFrequency = 'weekly' | 'fortnightly' | 'monthly'
export type Priority = 'high' | 'medium' | 'low'
export type PriorityReason = 'overdue' | 'disbursement' | 'new_group' | 'routine'
export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat'

export type User = {
  id: string
  name: string
  email: string
  role: UserRole
  branchId: string
  officerId?: string
  active: boolean
}

export type Branch = {
  id: string
  name: string
  district: string
  taluka: string
  lat: number
  lng: number
  address: string
}

export type JLGGroup = {
  id: string
  name: string
  centerCode: string
  village: string
  taluka: string
  district: string
  lat: number
  lng: number
  memberCount: number
  meetingDay: Weekday
  meetingFrequency: MeetingFrequency
  windowStart: string
  windowEnd: string
  meetingDurationMin: number
  priority: Priority
  priorityReason: PriorityReason
  assignedOfficerId: string | null
  active: boolean
  source: 'synthetic' | 'manual'
  createdBy: string
  updatedAt: string
}

export type Officer = {
  id: string
  name: string
  branchId: string
  /** Where the officer's day starts and ends; defaults to the branch location. */
  startLat: number
  startLng: number
  shiftStart: string
  shiftEnd: string
  breakStart: string
  breakDurationMin: number
  maxMeetingsPerDay: number
  vehicle: 'two_wheeler'
  color: string
  active: boolean
}

export type OptimizeRequest = {
  branchId: string
  date: string
  officerIds: string[]
  groupIds: string[]
  settings: Settings
}

export type PlanStop = {
  sequence: number
  groupId: string
  arrivalTime: string
  waitMin: number
  meetingStart: string
  meetingEnd: string
  departureTime: string
  travelMinFromPrev: number
  distanceKmFromPrev: number
}

export type OfficerRoute = {
  officerId: string
  stops: PlanStop[]
  totalTravelMin: number
  totalDistanceKm: number
  totalWaitMin: number
  totalMeetingMin: number
  startTime: string
  endTime: string
  /** Travel from the last stop back to the start location. */
  returnTravelMin: number
  returnDistanceKm: number
  breakStart: string | null
  breakEnd: string | null
  geometry: [number, number][]
}

export type UnassignedReason = 'time_window_conflict' | 'exceeds_working_hours' | 'low_priority_dropped' | 'unreachable'

export type UnassignedGroup = {
  groupId: string
  reason: UnassignedReason
}

export type PlanStatus = 'optimal' | 'feasible' | 'partial' | 'infeasible'

export type Plan = {
  id: string
  branchId: string
  date: string
  createdAt: string
  createdBy: string
  status: PlanStatus
  solveTimeSec: number
  saved: boolean
  routes: OfficerRoute[]
  unassigned: UnassignedGroup[]
  kpis: {
    meetingsPlanned: number
    meetingsTotal: number
    highPriorityCovered: number
    highPriorityTotal: number
    totalDistanceKm: number
    totalTravelMin: number
    avgUtilizationPct: number
  }
}

export type Settings = {
  defaultShiftStart: string
  defaultShiftEnd: string
  defaultBreakStart: string
  defaultBreakDurationMin: number
  defaultMeetingDurationMin: number
  osrmUrl: string
  /** Multiplies car travel times from OSRM to approximate a two-wheeler. */
  speedFactor: number
  bufferMin: number
  /** Rupees per planned road kilometre, used for travel-allowance reports. */
  travelAllowancePerKm: number
  penaltyHigh: number
  penaltyMedium: number
  penaltyLow: number
  allowLateArrival: boolean
  solverTimeLimitSec: number
  balanceWorkload: boolean
}

export type GroupInput = Omit<JLGGroup, 'id' | 'updatedAt'>
export type OfficerInput = Omit<Officer, 'id'>
export type BranchInput = Omit<Branch, 'id'>
export type UserInput = Omit<User, 'id'> & { password: string }
export type SettingsInput = Partial<Settings>
export type PlanRequest = OptimizeRequest

export type SyntheticOptions = {
  count: number
  radiusKm: number
  highPct: number
  mediumPct: number
  windowFrom: string
  windowTo: string
  durationMin: number
  durationMax: number
  seed: number
  replaceExisting: boolean
}
