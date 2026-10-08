/**
 * Minimal client for an OSRM server (http://project-osrm.org/docs/v5.24.0/api/).
 *
 *  - Table API: car travel durations (seconds) and distances (metres) between points.
 *  - Route API: the road-shaped line through a sequence of points.
 *
 * The public demo server asks for at most 1 request per second and allows at most
 * 100 coordinates per table request, so requests are throttled and chunked here.
 */

export type LatLng = { lat: number; lng: number }

/** Table result: [i][j] is from point i to point j; null when OSRM finds no road route. */
export type OsrmTable = { durations: (number | null)[][]; distances: (number | null)[][] }

/** Thrown for anything that stops us talking to OSRM; the message is safe to show users. */
export class TravelServiceError extends Error {
  constructor(detail: string) {
    super('Travel-time service unavailable — try again.', { cause: detail })
    this.name = 'TravelServiceError'
  }
}

const MAX_COORDINATES = 100
const MIN_INTERVAL_MS = 1000
const TIMEOUT_MS = 20_000

let lastRequestAt = 0

/** Waits so that consecutive requests are at least MIN_INTERVAL_MS apart. */
async function throttle() {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now()
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  lastRequestAt = Date.now()
}

async function osrmGet<T>(url: string): Promise<T> {
  await throttle()
  let response: Response
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' })
  } catch (error) {
    throw new TravelServiceError(`OSRM request failed: ${(error as Error).message}`)
  }
  const body = (await response.json().catch(() => null)) as { code?: string; message?: string } | null
  if (!response.ok || body?.code !== 'Ok') {
    throw new TravelServiceError(`OSRM ${response.status}: ${body?.code ?? ''} ${body?.message ?? ''}`.trim())
  }
  return body as T
}

/** OSRM wants "lng,lat;lng,lat;…". */
const coordinateList = (points: LatLng[]) => points.map((p) => `${p.lng},${p.lat}`).join(';')

/**
 * Durations and distances between all `sources` and all `destinations`.
 * Large requests are split into blocks of at most 100 coordinates.
 */
export async function osrmTable(osrmUrl: string, sources: LatLng[], destinations: LatLng[]): Promise<OsrmTable> {
  const half = MAX_COORDINATES / 2
  const durations = sources.map(() => destinations.map((): number | null => null))
  const distances = sources.map(() => destinations.map((): number | null => null))

  for (let s = 0; s < sources.length; s += half) {
    for (let d = 0; d < destinations.length; d += half) {
      const src = sources.slice(s, s + half)
      const dst = destinations.slice(d, d + half)
      // One request lists the source block then the destination block.
      const query = new URLSearchParams({
        sources: src.map((_, i) => i).join(';'),
        destinations: dst.map((_, i) => src.length + i).join(';'),
        annotations: 'duration,distance',
      })
      const url = `${osrmUrl.replace(/\/$/, '')}/table/v1/driving/${coordinateList([...src, ...dst])}?${query}`
      const block = await osrmGet<{ durations: (number | null)[][]; distances: (number | null)[][] }>(url)
      block.durations.forEach((row, i) => row.forEach((value, j) => (durations[s + i][d + j] = value)))
      block.distances.forEach((row, i) => row.forEach((value, j) => (distances[s + i][d + j] = value)))
    }
  }
  return { durations, distances }
}

/** Road geometry through `points` in order, as [lng, lat] pairs (GeoJSON order). */
export async function osrmRouteGeometry(osrmUrl: string, points: LatLng[]): Promise<[number, number][]> {
  const url = `${osrmUrl.replace(/\/$/, '')}/route/v1/driving/${coordinateList(points)}?overview=full&geometries=geojson`
  const body = await osrmGet<{ routes: { geometry: { coordinates: [number, number][] } }[] }>(url)
  return body.routes[0].geometry.coordinates
}
