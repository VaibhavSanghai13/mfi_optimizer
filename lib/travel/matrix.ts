import type { Settings } from '../types'
import { type CachedPair, keyToPoint, pairKey, pointKey, readCache, writeCache } from './cache'
import { type LatLng, osrmTable } from './osrm'

/**
 * Travel matrices for the optimizer. Entry [i][j] is from points[i] to points[j];
 * null means OSRM found no road route (the group is then "unreachable").
 */
export type TravelMatrix = {
  /** Two-wheeler minutes: ceil(car seconds / 60 × speed factor). */
  minutes: (number | null)[][]
  /** Road kilometres, 2 decimals. */
  km: (number | null)[][]
  /** Raw car seconds from OSRM, before the speed factor. */
  carSeconds: (number | null)[][]
  /** Ordered pairs (between distinct places) found in / missing from the cache. */
  hits: number
  misses: number
}

export async function buildMatrix(points: LatLng[], settings: Pick<Settings, 'osrmUrl' | 'speedFactor'>): Promise<TravelMatrix> {
  // Several points can share a place (e.g. every officer starts at the branch).
  const keys = points.map(pointKey)
  const places = [...new Set(keys)]
  const known = await readCache(places)

  // Which ordered pairs of distinct places are not cached yet?
  const missing = places.flatMap((origin) =>
    places.filter((destination) => origin !== destination && !known.has(pairKey(origin, destination))).map((destination) => ({ origin, destination })),
  )
  const hits = places.length * (places.length - 1) - missing.length

  if (missing.length > 0) {
    const fetched = await fetchPairs(settings.osrmUrl, missing)
    await writeCache(fetched)
    for (const pair of fetched) known.set(pairKey(pair.origin, pair.destination), pair)
  }

  const cell = (pick: (pair: CachedPair) => number) =>
    keys.map((origin) =>
      keys.map((destination): number | null => {
        if (origin === destination) return 0
        const pair = known.get(pairKey(origin, destination))
        return pair ? pick(pair) : null
      }),
    )

  return {
    minutes: cell((pair) => Math.ceil((pair.durationSec / 60) * settings.speedFactor)),
    km: cell((pair) => Math.round(pair.distanceM / 10) / 100),
    carSeconds: cell((pair) => pair.durationSec),
    hits,
    misses: missing.length,
  }
}

/**
 * Asks OSRM for every place that is missing at least one pair. This can re-fetch a
 * few pairs that were already cached, but keeps it to one table (or a few chunks).
 * Pairs OSRM cannot route (null) are not cached, so they are retried next time.
 */
async function fetchPairs(osrmUrl: string, missing: { origin: string; destination: string }[]) {
  const origins = [...new Set(missing.map((pair) => pair.origin))]
  const destinations = [...new Set(missing.map((pair) => pair.destination))]
  const table = await osrmTable(osrmUrl, origins.map(keyToPoint), destinations.map(keyToPoint))

  return missing.flatMap(({ origin, destination }) => {
    const i = origins.indexOf(origin)
    const j = destinations.indexOf(destination)
    const durationSec = table.durations[i][j]
    const distanceM = table.distances[i][j]
    return durationSec === null || distanceM === null ? [] : [{ origin, destination, durationSec, distanceM }]
  })
}
