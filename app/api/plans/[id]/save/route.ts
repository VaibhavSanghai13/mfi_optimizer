import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { jsonError } from '@/lib/http'
import { savePlan } from '@/lib/plans'

/** POST /api/plans/[id]/save — keep a draft: it then appears in Plans and on My Day. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole('manager')
  if (response) return response
  const plan = await savePlan((await params).id, session.user.branchId)
  return plan ? NextResponse.json(plan) : jsonError(404, 'Plan not found.')
}
