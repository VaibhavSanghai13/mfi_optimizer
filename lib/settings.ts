import { db } from './db'
import type { Settings } from './types'

/** Branch settings in the UI contract shape (lib/types.ts). */
export async function loadSettings(branchId: string): Promise<Settings> {
  // The Prisma model uses the same field names as the Settings type, minus the key.
  const settings = await db.settings.findUnique({ where: { branchId }, omit: { branchId: true } })
  if (!settings) throw new Error(`No settings row for branch ${branchId}. Run supabase/seed.sql.`)
  return settings
}
