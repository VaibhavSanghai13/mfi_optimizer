import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { jsonError, readJson } from '@/lib/http'
import { generateForBranch } from '@/lib/synthetic-server'
import { firstError, SyntheticOptionsSchema } from '@/lib/validation'

/**
 * POST /api/synthetic/generate — save generated groups (source = synthetic).
 * With replaceExisting, the branch's previous synthetic groups are removed first.
 * Manually entered groups are never touched.
 */
export async function POST(request: Request) {
  const { session, response } = await requireRole('manager')
  if (response) return response
  const parsed = SyntheticOptionsSchema.safeParse(await readJson(request))
  if (!parsed.success) return jsonError(400, firstError(parsed.error))

  const branchId = session.user.branchId
  let groups
  try {
    groups = await generateForBranch(branchId, session.user.id, parsed.data)
  } catch (error) {
    return jsonError(400, (error as Error).message)
  }

  const removed = await db.$transaction(async (tx) => {
    let removed = 0
    if (parsed.data.replaceExisting) {
      const synthetic = { branchId, source: 'synthetic' as const }
      // Groups that appear in a saved plan must stay for the plan history: deactivate those.
      const inPlans = { OR: [{ planStops: { some: {} } }, { planUnassigned: { some: {} } }] }
      removed += (await tx.jlgGroup.deleteMany({ where: { ...synthetic, NOT: inPlans } })).count
      removed += (await tx.jlgGroup.updateMany({ where: { ...synthetic, active: true, ...inPlans }, data: { active: false } })).count
    }
    await tx.jlgGroup.createMany({ data: groups.map((g) => ({ ...g, branchId })) })
    return removed
  })

  return NextResponse.json({ created: groups.length, removed })
}
