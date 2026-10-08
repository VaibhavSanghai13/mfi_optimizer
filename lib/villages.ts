import { readFileSync } from 'node:fs'
import path from 'node:path'

/** A real Baramati-taluka village from data/villages_baramati.csv (built in S3). */
export type Village = {
  name: string
  lat: number
  lng: number
  censusCode: string | null
  /** Census 2011 population; null for places that are not in the census. */
  population: number | null
}

const VILLAGES_CSV = path.join(process.cwd(), 'data', 'villages_baramati.csv')

let cache: Village[] | null = null

/** Server-only: reads the village CSV once and keeps it in memory. */
export function loadVillages(): Village[] {
  if (cache) return cache
  const [header, ...lines] = readFileSync(VILLAGES_CSV, 'utf-8').trim().split(/\r?\n/)
  const columns = header.split(',')
  const col = (name: string) => columns.indexOf(name)

  // The CSV has no quoted fields (village names contain no commas), so a split is enough.
  cache = lines.map((line) => {
    const cells = line.split(',')
    return {
      name: cells[col('name')],
      lat: Number(cells[col('lat')]),
      lng: Number(cells[col('lng')]),
      censusCode: cells[col('census_code')] || null,
      population: cells[col('population')] ? Number(cells[col('population')]) : null,
    }
  })
  return cache
}
