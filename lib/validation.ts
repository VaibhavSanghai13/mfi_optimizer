import { z } from 'zod'

/**
 * Request validation for the data-management API. The rules mirror the form checks
 * in components/data-workspace.tsx; the database check constraints are the last line.
 */

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24-hour).')
// Same bounds as the database check constraints.
const latitude = z.number().min(15.6, 'Pin must be within Maharashtra.').max(22.1, 'Pin must be within Maharashtra.')
const longitude = z.number().min(72.6, 'Pin must be within Maharashtra.').max(80.9, 'Pin must be within Maharashtra.')
const required = (label: string) => z.string().trim().min(1, `${label} is required.`)

export const BranchSchema = z.object({
  name: required('Name'),
  district: z.string().trim(),
  taluka: required('Taluka'),
  address: z.string().trim(),
  lat: latitude,
  lng: longitude,
})

export const OfficerSchema = z
  .object({
    name: required('Name'),
    branchId: z.uuid('Choose a branch.'),
    startLat: latitude,
    startLng: longitude,
    shiftStart: hhmm,
    shiftEnd: hhmm,
    breakStart: hhmm,
    breakDurationMin: z.int().min(0).max(120),
    maxMeetingsPerDay: z.int().min(1, 'Between 1 and 15.').max(15, 'Between 1 and 15.'),
    vehicle: z.literal('two_wheeler'),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a colour.'),
    active: z.boolean(),
  })
  .refine((o) => o.shiftEnd > o.shiftStart, { path: ['shiftEnd'], message: 'Shift end must be after start.' })
  .refine((o) => o.breakStart >= o.shiftStart && o.breakStart < o.shiftEnd, { path: ['breakStart'], message: 'Break must be within the shift.' })

export const GroupSchema = z
  .object({
    name: required('Name'),
    centerCode: z.string().trim(),
    village: required('Village'),
    taluka: z.string().trim(),
    district: z.string().trim(),
    lat: latitude,
    lng: longitude,
    memberCount: z.int().min(1, 'Members must be between 1 and 20.').max(20, 'Members must be between 1 and 20.'),
    meetingDay: z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']),
    meetingFrequency: z.enum(['weekly', 'fortnightly', 'monthly']),
    windowStart: hhmm,
    windowEnd: hhmm,
    meetingDurationMin: z.int().min(10, 'Duration must be between 10 and 120 minutes.').max(120, 'Duration must be between 10 and 120 minutes.'),
    priority: z.enum(['high', 'medium', 'low']),
    priorityReason: z.enum(['overdue', 'disbursement', 'new_group', 'routine']),
    assignedOfficerId: z.uuid().nullable(),
    active: z.boolean(),
  })
  .refine((g) => g.windowEnd > g.windowStart, { path: ['windowEnd'], message: 'Window end must be after start.' })

export const SyntheticOptionsSchema = z
  .object({
    count: z.int().min(1, 'Number of groups must be between 1 and 500.').max(500, 'Number of groups must be between 1 and 500.'),
    radiusKm: z.number().min(1).max(50),
    highPct: z.number().min(0).max(100),
    mediumPct: z.number().min(0).max(100),
    windowFrom: hhmm,
    windowTo: hhmm,
    durationMin: z.int().min(10).max(120),
    durationMax: z.int().min(10).max(120),
    seed: z.int(),
    replaceExisting: z.boolean(),
  })
  .refine((o) => o.highPct + o.mediumPct <= 100, { message: 'High + medium cannot exceed 100%.' })
  .refine((o) => o.durationMax >= o.durationMin, { message: 'Maximum duration must be at least the minimum.' })
  .refine((o) => o.windowTo > o.windowFrom, { message: 'Latest time must be after earliest time.' })

const password = z.string().min(8, 'At least 8 characters.').max(200)

export const UserSchema = z
  .object({
    name: required('Name'),
    email: z.string().trim().toLowerCase().email('Enter a valid email.'),
    role: z.enum(['manager', 'field_officer']),
    branchId: z.uuid('Choose a branch.'),
    officerId: z.uuid().nullish(),
    active: z.boolean(),
  })
  .refine((u) => u.role !== 'field_officer' || !!u.officerId, { path: ['officerId'], message: 'Field officers must be linked to an officer.' })

export const NewUserSchema = UserSchema.and(z.object({ password }))
export const PasswordSchema = z.object({ password })

// Ranges match the database check constraints and the Settings form.
export const SettingsSchema = z
  .object({
    defaultShiftStart: hhmm,
    defaultShiftEnd: hhmm,
    defaultBreakStart: hhmm,
    defaultBreakDurationMin: z.int().min(0).max(120),
    defaultMeetingDurationMin: z.int().min(10, 'Meeting duration must be between 10 and 120 minutes.').max(120, 'Meeting duration must be between 10 and 120 minutes.'),
    osrmUrl: z.string().trim().regex(/^https?:\/\/\S+$/, 'OSRM URL must start with http:// or https://.'),
    speedFactor: z.number().min(0.5, 'Speed factor must be between 0.5 and 1.5.').max(1.5, 'Speed factor must be between 0.5 and 1.5.'),
    bufferMin: z.int().min(0).max(60),
    penaltyHigh: z.int().min(0),
    penaltyMedium: z.int().min(0),
    penaltyLow: z.int().min(0),
    allowLateArrival: z.boolean(),
    solverTimeLimitSec: z.int().min(1, 'Solver time limit must be between 1 and 60 seconds.').max(60, 'Solver time limit must be between 1 and 60 seconds.'),
    balanceWorkload: z.boolean(),
  })
  .refine((s) => s.defaultShiftEnd > s.defaultShiftStart, { path: ['defaultShiftEnd'], message: 'Shift end must be after shift start.' })

/** The first validation message, for a simple `{ error }` response. */
export const firstError = (error: z.ZodError) => error.issues[0]?.message ?? 'Invalid input.'
