import { fromMin, haversineKm, seededRandom, toMin } from './format'
import type { GroupInput, MeetingFrequency, Priority, PriorityReason, SyntheticOptions, Weekday } from './types'
import type { Village } from './villages'

/**
 * Seeded synthetic JLG group generator. Real JLG data is private, so groups are
 * placed on real villages with realistic schedules. The same options (incl. seed)
 * always give the same groups. Used by the seed script (S4) and the Generate
 * Synthetic Data page (S7).
 */

export type SyntheticContext = {
  /** Groups are placed on villages within `options.radiusKm` of the branch. */
  branch: { lat: number; lng: number; taluka: string; district: string }
  /** Officers a group may be pinned to (a few groups are). Empty = never pinned. */
  officerIds: string[]
  /** User id recorded as the creator. */
  createdBy: string
  /** Prefix for centre codes, e.g. "SYN" → "SYN-001". */
  codePrefix: string
}

const DAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const GROUP_NAMES = ['Savitri', 'Jijau', 'Mahalaxmi', 'Asha', 'Ahilya', 'Ramai', 'Sahyadri', 'Pragati', 'Laxmi', 'Durga', 'Saraswati', 'Ekta']
const REASONS: Record<Priority, PriorityReason[]> = {
  high: ['overdue', 'disbursement', 'new_group'],
  medium: ['routine', 'new_group'],
  low: ['routine'],
}
/** Meeting windows are 1.5 or 2 hours long and start on the half hour. */
const WINDOW_LENGTHS_MIN = [90, 120]
/** Places missing from the census still get picked, just rarely. */
const DEFAULT_POPULATION = 500
/** ~200 m, so several groups in one village do not share a pin. */
const JITTER_DEG = 0.002
const PINNED_SHARE = 0.1
const FORTNIGHTLY_SHARE = 0.2

export function buildSyntheticGroups(villages: Village[], options: SyntheticOptions, context: SyntheticContext): GroupInput[] {
  const rand = seededRandom(options.seed)
  const pick = <T,>(items: readonly T[]) => items[Math.floor(rand() * items.length)]

  const nearby = villages.filter((v) => haversineKm(context.branch.lat, context.branch.lng, v.lat, v.lng) <= options.radiusKm)
  if (nearby.length === 0) throw new Error(`No villages within ${options.radiusKm} km of the branch.`)

  // Exact priority counts (e.g. 25 % of 48 = 12 high), shuffled so they are spread over days and villages.
  const high = Math.round((options.count * options.highPct) / 100)
  const medium = Math.round((options.count * options.mediumPct) / 100)
  const priorities = shuffle(
    Array.from({ length: options.count }, (_, i): Priority => (i < high ? 'high' : i < high + medium ? 'medium' : 'low')),
    rand,
  )

  const from = toMin(options.windowFrom)
  const to = toMin(options.windowTo)

  return priorities.map((priority, i) => {
    const village = pickByPopulation(nearby, rand)
    const duration = options.durationMin + 5 * Math.floor(rand() * ((options.durationMax - options.durationMin) / 5 + 1))
    // The window must hold the meeting plus some slack, and fit inside [windowFrom, windowTo].
    const length = Math.min(Math.max(pick(WINDOW_LENGTHS_MIN), duration + 30), to - from)
    const start = from + 30 * Math.floor(rand() * (Math.floor((to - from - length) / 30) + 1))
    const pinned = context.officerIds.length > 0 && rand() < PINNED_SHARE

    return {
      name: `${GROUP_NAMES[i % GROUP_NAMES.length]} Mahila JLG`,
      centerCode: `${context.codePrefix}-${String(i + 1).padStart(3, '0')}`,
      village: village.name,
      taluka: context.branch.taluka,
      district: context.branch.district,
      lat: round5(village.lat + (rand() - 0.5) * 2 * JITTER_DEG),
      lng: round5(village.lng + (rand() - 0.5) * 2 * JITTER_DEG),
      memberCount: 5 + Math.floor(rand() * 6),
      // Round-robin over the weekdays gives an even spread (48 groups → 8 per day).
      meetingDay: DAYS[i % DAYS.length],
      meetingFrequency: (rand() < FORTNIGHTLY_SHARE ? 'fortnightly' : 'weekly') as MeetingFrequency,
      windowStart: fromMin(start),
      windowEnd: fromMin(start + length),
      meetingDurationMin: duration,
      priority,
      priorityReason: pick(REASONS[priority]),
      assignedOfficerId: pinned ? pick(context.officerIds) : null,
      active: true,
      source: 'synthetic',
      createdBy: context.createdBy,
    }
  })
}

/** Bigger villages are more likely to have JLG groups. */
function pickByPopulation(villages: Village[], rand: () => number): Village {
  const weights = villages.map((v) => v.population ?? DEFAULT_POPULATION)
  let roll = rand() * weights.reduce((sum, w) => sum + w, 0)
  for (let i = 0; i < villages.length; i++) {
    roll -= weights[i]
    if (roll < 0) return villages[i]
  }
  return villages[villages.length - 1]
}

/** Fisher–Yates shuffle driven by the seeded random function. */
function shuffle<T>(items: T[], rand: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

const round5 = (value: number) => Math.round(value * 1e5) / 1e5
