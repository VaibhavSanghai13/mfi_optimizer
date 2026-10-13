import type { Priority, PriorityReason, UnassignedReason, Weekday } from './types'

/** "09:30" -> 570 */
export const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

/** 570 -> "09:30" */
export const fromMin = (min: number) => {
  const m = Math.max(0, Math.round(min))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** "13:05" -> "01:05 PM" */
export function fmtTime(hhmm: string) {
  const h = Number(hhmm.slice(0, 2))
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${String(h % 12 || 12).padStart(2, '0')}:${hhmm.slice(3, 5)} ${suffix}`
}

/** "2026-09-28" -> "28 Sep 2026" */
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function fmtDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d} ${months[Number(m) - 1]} ${y}`
}

/** Today's date on this device as "YYYY-MM-DD" (local time, not UTC). */
export function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 95 -> "1h 35m" */
export function fmtDuration(min: number) {
  const m = Math.round(min)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

export const fmtKm = (km: number) => `${km.toFixed(1)} km`

/** 4236 -> "₹4,236" (Indian digit grouping). */
export const fmtRupees = (amount: number) => `₹${Math.round(amount).toLocaleString('en-IN')}`

const weekdays: (Weekday | null)[] = [null, 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
/** Meeting day for an ISO date; Sunday has no meetings. */
export const weekdayOf = (iso: string) => weekdays[new Date(`${iso.slice(0, 10)}T00:00:00`).getDay()] ?? null

export const priorityLabel: Record<Priority, string> = { high: 'High', medium: 'Medium', low: 'Low' }

export const reasonLabel: Record<PriorityReason, string> = {
  overdue: 'Overdue',
  disbursement: 'Disbursement',
  new_group: 'New group',
  routine: 'Routine',
}

export const unassignedLabel: Record<UnassignedReason, string> = {
  time_window_conflict: 'Meeting window cannot be reached in time',
  exceeds_working_hours: 'Would exceed officers’ working hours',
  low_priority_dropped: 'Dropped to fit higher-priority meetings',
  unreachable: 'No road route found',
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(x))
}

/** Small deterministic PRNG so synthetic data is reproducible from a seed. */
export function seededRandom(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}
