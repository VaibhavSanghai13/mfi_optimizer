import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { listSavedPlans } from '@/lib/plans'

/** GET /api/plans — saved plans of the branch, newest first (drafts are not listed). */
export async function GET() {
  const { session, response } = await requireRole('manager')
  if (response) return response
  return NextResponse.json(await listSavedPlans(session.user.branchId))
}
