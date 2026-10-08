import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { jsonError, readPatch } from '@/lib/http'
import { toGroup } from '@/lib/mappers'
import { firstError, GroupSchema } from '@/lib/validation'

/** PATCH /api/groups/[id] — edit a group, or (de)activate with `{ active }`. Source and creator never change. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole('manager')
  if (response) return response
  const { id } = await params

  const existing = await db.jlgGroup.findUnique({ where: { id } })
  if (!existing || existing.branchId !== session.user.branchId) return jsonError(404, 'Group not found.')

  const parsed = GroupSchema.safeParse({ ...toGroup(existing), ...(await readPatch(request)) })
  if (!parsed.success) return jsonError(400, firstError(parsed.error))

  const officerId = parsed.data.assignedOfficerId
  if (officerId && !(await db.officer.findUnique({ where: { id: officerId } }))) return jsonError(400, 'Choose an existing officer.')

  const row = await db.jlgGroup.update({ where: { id }, data: parsed.data })
  return NextResponse.json(toGroup(row))
}
