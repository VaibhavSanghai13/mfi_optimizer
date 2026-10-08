import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { jsonError, readJson } from '@/lib/http'
import { toBranch } from '@/lib/mappers'
import { BranchSchema, firstError } from '@/lib/validation'

/** GET /api/branches — all branches. */
export async function GET() {
  const { response } = await requireRole('manager')
  if (response) return response
  const rows = await db.branch.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(rows.map(toBranch))
}

/** POST /api/branches — create a branch (with default settings). */
export async function POST(request: Request) {
  const { response } = await requireRole('manager')
  if (response) return response
  const parsed = BranchSchema.safeParse(await readJson(request))
  if (!parsed.success) return jsonError(400, firstError(parsed.error))

  // Every branch needs a settings row; all its columns have database defaults.
  const row = await db.branch.create({ data: { ...parsed.data, settings: { create: {} } } })
  return NextResponse.json(toBranch(row), { status: 201 })
}
