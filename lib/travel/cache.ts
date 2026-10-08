import { db } from '../db'
import type { LatLng } from './osrm'

/**
 * PostgreSQL cache of OSRM results (table `travel_cache`).
 *
 * Keys are "lat,lng" rounded to 5 decimals (~1 m), so the same place always gives
 * the same key. Values are the raw CAR numbers from OSRM; the two-wheeler speed
 * factor is applied later, so changing it never invalidates the cache.
 */

export type CachedPair = { durationSec: number; distanceM: number }

export const pointKey = (point: LatLng) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`

export const keyToPoint = (key: string): LatLng => {
  const [lat, lng] = key.split(',').map(Number)
  return { lat, lng }
}

export const pairKey = (origin: string, destination: string) => `${origin}|${destination}`

/** All cached pairs between the given points, keyed by pairKey(origin, destination). */
export async function readCache(keys: string[]): Promise<Map<string, CachedPair>> {
  const rows = await db.travelCache.findMany({
    where: { origin: { in: keys }, destination: { in: keys } },
    select: { origin: true, destination: true, durationSec: true, distanceM: true },
  })
  return new Map(rows.map((row) => [pairKey(row.origin, row.destination), row]))
}

export async function writeCache(entries: (CachedPair & { origin: string; destination: string })[]) {
  if (entries.length === 0) return
  // skipDuplicates: two requests running at once may both fetch the same pair.
  await db.travelCache.createMany({ data: entries, skipDuplicates: true })
}
