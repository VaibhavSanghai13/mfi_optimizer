import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { jsonError, readPatch } from '@/lib/http'
import { loadSettings } from '@/lib/settings'
import { firstError, SettingsSchema } from '@/lib/validation'

/** GET /api/settings — the branch settings (forms also use them as defaults). */
export async function GET() {
  const { session, response } = await requireRole('manager')
  if (response) return response
  return NextResponse.json(await loadSettings(session.user.branchId))
}

/** PUT /api/settings — save settings; the result is validated as a whole. */
export async function PUT(request: Request) {
  const { session, response } = await requireRole('manager')
  if (response) return response
  const branchId = session.user.branchId

  const parsed = SettingsSchema.safeParse({ ...(await loadSettings(branchId)), ...(await readPatch(request)) })
  if (!parsed.success) return jsonError(400, firstError(parsed.error))

  await db.settings.update({ where: { branchId }, data: parsed.data })
  return NextResponse.json(await loadSettings(branchId))
}
