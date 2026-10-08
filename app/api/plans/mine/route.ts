import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { latestPlanForOfficer } from '@/lib/plans'

/** GET /api/plans/mine — Field Officer: the latest saved plan with a route for them, or null. */
export async function GET() {
  const { session, response } = await requireRole('field_officer')
  if (response) return response
  // Field-officer users always have an officer (database check constraint).
  return NextResponse.json(await latestPlanForOfficer(session.user.officerId!))
}
