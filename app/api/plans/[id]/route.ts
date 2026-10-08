import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { jsonError } from '@/lib/http'
import { getPlan } from '@/lib/plans'

/** GET /api/plans/[id] — one plan (saved or draft) with routes, stops and KPIs. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole('manager')
  if (response) return response
  const plan = await getPlan((await params).id, session.user.branchId)
  return plan ? NextResponse.json(plan) : jsonError(404, 'Plan not found.')
}
