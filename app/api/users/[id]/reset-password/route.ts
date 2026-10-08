import { NextResponse } from 'next/server'
import { hashPassword } from '@/lib/auth/password'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { jsonError, readJson } from '@/lib/http'
import { firstError, PasswordSchema } from '@/lib/validation'

/** POST /api/users/[id]/reset-password — the manager sets a new password (there is no email flow). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireRole('manager')
  if (response) return response
  const { id } = await params
  const parsed = PasswordSchema.safeParse(await readJson(request))
  if (!parsed.success) return jsonError(400, firstError(parsed.error))

  if (!(await db.user.findUnique({ where: { id } }))) return jsonError(404, 'User not found.')
  await db.user.update({ where: { id }, data: { passwordHash: await hashPassword(parsed.data.password) } })
  return NextResponse.json({ ok: true })
}
