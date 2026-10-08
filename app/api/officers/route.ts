import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { jsonError, readJson } from '@/lib/http'
import { toOfficer } from '@/lib/mappers'
import { firstError, OfficerSchema } from '@/lib/validation'

/** GET /api/officers — all officers (active and inactive). */
export async function GET() {
  const { response } = await requireRole('manager')
  if (response) return response
  const rows = await db.officer.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(rows.map(toOfficer))
}

/** POST /api/officers — add an officer. */
export async function POST(request: Request) {
  const { response } = await requireRole('manager')
  if (response) return response
  const parsed = OfficerSchema.safeParse(await readJson(request))
  if (!parsed.success) return jsonError(400, firstError(parsed.error))

  if (!(await db.branch.findUnique({ where: { id: parsed.data.branchId } }))) return jsonError(400, 'Choose a branch.')
  const row = await db.officer.create({ data: parsed.data })
  return NextResponse.json(toOfficer(row), { status: 201 })
}
