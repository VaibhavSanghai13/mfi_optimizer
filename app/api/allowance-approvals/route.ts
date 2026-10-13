import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { jsonError, readJson } from '@/lib/http'
import { ApprovalSchema, firstError, WeekStartSchema } from '@/lib/validation'

/**
 * Travel-allowance sign-off, one row per officer per week.
 *
 * Only the fact of approval is stored — the rupee amounts are always recomputed
 * from the saved plans (lib/reports.ts), so editing a plan can never leave an
 * approved statement showing a stale figure.
 */

export type ApprovalDto = { officerId: string; weekStart: string; approvedAt: string; approvedByName: string }

const toDto = (row: { officerId: string; weekStart: Date; approvedAt: Date; approver: { name: string } }): ApprovalDto => ({
  officerId: row.officerId,
  weekStart: row.weekStart.toISOString().slice(0, 10),
  approvedAt: row.approvedAt.toISOString(),
  approvedByName: row.approver.name,
})

/** GET /api/allowance-approvals?weekStart=YYYY-MM-DD — approvals for that week. */
export async function GET(request: Request) {
  const { session, response } = await requireRole('manager')
  if (response) return response

  const parsed = WeekStartSchema.safeParse(new URL(request.url).searchParams.get('weekStart'))
  if (!parsed.success) return jsonError(400, firstError(parsed.error))

  const rows = await db.allowanceApproval.findMany({
    where: { branchId: session.user.branchId, weekStart: new Date(`${parsed.data}T00:00:00Z`) },
    include: { approver: { select: { name: true } } },
  })
  return NextResponse.json(rows.map(toDto))
}

/** POST /api/allowance-approvals — approve one officer's week. Approving twice is not an error. */
export async function POST(request: Request) {
  const { session, response } = await requireRole('manager')
  if (response) return response

  const parsed = ApprovalSchema.safeParse(await readJson(request))
  if (!parsed.success) return jsonError(400, firstError(parsed.error))
  const { officerId, weekStart } = parsed.data

  // An officer of another branch must not be approvable from this session.
  const officer = await db.officer.findFirst({ where: { id: officerId, branchId: session.user.branchId } })
  if (!officer) return jsonError(404, 'That officer is not in your branch.')

  const week = new Date(`${weekStart}T00:00:00Z`)
  const row = await db.allowanceApproval.upsert({
    where: { officerId_weekStart: { officerId, weekStart: week } },
    create: { officerId, weekStart: week, branchId: session.user.branchId, approvedBy: session.user.id },
    update: {},
    include: { approver: { select: { name: true } } },
  })
  return NextResponse.json(toDto(row), { status: 201 })
}

/** DELETE /api/allowance-approvals?officerId=…&weekStart=… — withdraw an approval. */
export async function DELETE(request: Request) {
  const { session, response } = await requireRole('manager')
  if (response) return response

  const params = new URL(request.url).searchParams
  const parsed = ApprovalSchema.safeParse({ officerId: params.get('officerId'), weekStart: params.get('weekStart') })
  if (!parsed.success) return jsonError(400, firstError(parsed.error))

  await db.allowanceApproval.deleteMany({
    where: { officerId: parsed.data.officerId, weekStart: new Date(`${parsed.data.weekStart}T00:00:00Z`), branchId: session.user.branchId },
  })
  return NextResponse.json({ ok: true })
}
