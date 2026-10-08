import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { jsonError, readPatch } from '@/lib/http'
import { toOfficer } from '@/lib/mappers'
import { firstError, OfficerSchema } from '@/lib/validation'

/** PATCH /api/officers/[id] — edit an officer, or (de)activate with `{ active }`. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireRole('manager')
  if (response) return response
  const { id } = await params

  const existing = await db.officer.findUnique({ where: { id } })
  if (!existing) return jsonError(404, 'Officer not found.')

  const parsed = OfficerSchema.safeParse({ ...toOfficer(existing), ...(await readPatch(request)) })
  if (!parsed.success) return jsonError(400, firstError(parsed.error))
  if (!(await db.branch.findUnique({ where: { id: parsed.data.branchId } }))) return jsonError(400, 'Choose a branch.')

  const row = await db.officer.update({ where: { id }, data: parsed.data })
  return NextResponse.json(toOfficer(row))
}
