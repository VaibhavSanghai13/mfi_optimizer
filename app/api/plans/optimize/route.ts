import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { SESSION_COOKIE } from '@/lib/auth/jwt'
import { requireRole } from '@/lib/auth/session'
import { jsonError, readJson } from '@/lib/http'
import { OptimizerError, optimizePlan, PlanInputError } from '@/lib/plans'
import { TravelServiceError } from '@/lib/travel/osrm'
import { firstError } from '@/lib/validation'

// Travel matrix + solver time limit + route geometry can take a while.
export const maxDuration = 60

// The planner also sends branchId and settings (reference contract); the server uses
// the signed-in manager's branch and the saved settings instead, so they are ignored.
const Body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date.'),
  officerIds: z.array(z.uuid()),
  groupIds: z.array(z.uuid()),
})

/** POST /api/plans/optimize — optimize the selected meetings and officers; saved as a draft. */
export async function POST(request: Request) {
  const { session, response } = await requireRole('manager')
  if (response) return response
  const parsed = Body.safeParse(await readJson(request))
  if (!parsed.success) return jsonError(400, firstError(parsed.error))

  try {
    const plan = await optimizePlan({
      ...parsed.data,
      branchId: session.user.branchId,
      userId: session.user.id,
      token: (await cookies()).get(SESSION_COOKIE)!.value,
    })
    return NextResponse.json(plan, { status: 201 })
  } catch (error) {
    if (error instanceof PlanInputError) return jsonError(400, error.message)
    if (error instanceof TravelServiceError || error instanceof OptimizerError) {
      console.error(error.message, error.cause)
      return jsonError(503, error.message)
    }
    throw error
  }
}
