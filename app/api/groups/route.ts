import { NextResponse, type NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { jsonError, readJson } from '@/lib/http'
import { toGroup } from '@/lib/mappers'
import { firstError, GroupSchema } from '@/lib/validation'
import type { Priority, Weekday } from '@/lib/types'

/**
 * GET /api/groups — the branch's JLG groups. Optional filters:
 *   ?day=Mon  ?active=true|false  ?priority=high  ?source=synthetic|manual
 */
export async function GET(request: NextRequest) {
  const { session, response } = await requireRole('manager')
  if (response) return response

  const q = request.nextUrl.searchParams
  const where: Prisma.JlgGroupWhereInput = { branchId: session.user.branchId }
  if (q.get('day')) where.meetingDay = q.get('day') as Weekday
  if (q.get('active')) where.active = q.get('active') === 'true'
  if (q.get('priority')) where.priority = q.get('priority') as Priority
  if (q.get('source')) where.source = q.get('source') as 'synthetic' | 'manual'

  const rows = await db.jlgGroup.findMany({ where, orderBy: [{ centerCode: 'asc' }, { name: 'asc' }] })
  return NextResponse.json(rows.map(toGroup))
}

/** POST /api/groups — add a group by hand (source is always "manual"). */
export async function POST(request: Request) {
  const { session, response } = await requireRole('manager')
  if (response) return response
  const parsed = GroupSchema.safeParse(await readJson(request))
  if (!parsed.success) return jsonError(400, firstError(parsed.error))

  const officerId = parsed.data.assignedOfficerId
  if (officerId && !(await db.officer.findUnique({ where: { id: officerId } }))) return jsonError(400, 'Choose an existing officer.')

  const row = await db.jlgGroup.create({
    data: { ...parsed.data, branchId: session.user.branchId, source: 'manual', createdBy: session.user.id },
  })
  return NextResponse.json(toGroup(row), { status: 201 })
}
