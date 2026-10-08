import { NextResponse } from 'next/server'
import { requireRole, toUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { jsonError, readPatch } from '@/lib/http'
import { userConflict } from '@/lib/users'
import { firstError, UserSchema } from '@/lib/validation'

/**
 * PATCH /api/users/[id] — edit role, branch, officer link or active status.
 * Self-protection: the signed-in manager cannot deactivate themselves or change their
 * own role, so the app can never be left without a manager.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole('manager')
  if (response) return response
  const { id } = await params

  const existing = await db.user.findUnique({ where: { id } })
  if (!existing) return jsonError(404, 'User not found.')

  const parsed = UserSchema.safeParse({ ...toUser(existing), ...(await readPatch(request)) })
  if (!parsed.success) return jsonError(400, firstError(parsed.error))
  const user = { ...parsed.data, officerId: parsed.data.role === 'field_officer' ? parsed.data.officerId : null }

  if (id === session.user.id) {
    if (!user.active) return jsonError(400, 'You cannot deactivate your own account.')
    if (user.role !== existing.role) return jsonError(400, 'You cannot change your own role.')
  }
  const conflict = await userConflict(user, id)
  if (conflict) return jsonError(400, conflict)

  const row = await db.user.update({ where: { id }, data: user })
  return NextResponse.json(toUser(row))
}
