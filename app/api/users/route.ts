import { NextResponse } from 'next/server'
import { hashPassword } from '@/lib/auth/password'
import { requireRole, toUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { jsonError, readJson } from '@/lib/http'
import { userConflict } from '@/lib/users'
import { firstError, NewUserSchema } from '@/lib/validation'

/** GET /api/users — all users (never their password hashes). */
export async function GET() {
  const { response } = await requireRole('manager')
  if (response) return response
  const rows = await db.user.findMany({ orderBy: [{ role: 'asc' }, { name: 'asc' }] })
  return NextResponse.json(rows.map(toUser))
}

/** POST /api/users — add a user with an initial password (bcrypt-hashed, random salt). */
export async function POST(request: Request) {
  const { response } = await requireRole('manager')
  if (response) return response
  const parsed = NewUserSchema.safeParse(await readJson(request))
  if (!parsed.success) return jsonError(400, firstError(parsed.error))

  const { password, ...user } = parsed.data
  const officerId = user.role === 'field_officer' ? user.officerId : null // managers are never linked
  const conflict = await userConflict({ ...user, officerId })
  if (conflict) return jsonError(400, conflict)

  const row = await db.user.create({ data: { ...user, officerId, passwordHash: await hashPassword(password) } })
  return NextResponse.json(toUser(row), { status: 201 })
}
