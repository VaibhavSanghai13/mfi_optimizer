import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { jsonError } from '@/lib/http'
import { toBranch, toGroup, toOfficer } from '@/lib/mappers'

/**
 * GET /api/plans/[id]/day-sheet/[officerId] — what a day sheet shows besides the plan:
 * the branch, the officer and the groups on that officer's route.
 *
 *  - Manager: any officer's sheet on a plan of their branch.
 *  - Field Officer: only their own sheet, and only on a saved plan (My Day).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; officerId: string }> }) {
  const { session, response } = await requireRole('manager', 'field_officer')
  if (response) return response
  const { id, officerId } = await params

  const plan = await db.plan.findUnique({
    where: { id },
    include: { branch: true, routes: { where: { officerId }, include: { officer: true, stops: { include: { group: true } } } } },
  })
  const route = plan?.routes[0]
  const allowed =
    session.user.role === 'manager'
      ? plan?.branchId === session.user.branchId
      : plan?.saved && session.user.officerId === officerId
  if (!plan || !route || !allowed) return jsonError(404, 'Day sheet not found.')

  return NextResponse.json({
    branch: toBranch(plan.branch),
    officer: toOfficer(route.officer),
    groups: route.stops.map((s) => toGroup(s.group)),
  })
}
