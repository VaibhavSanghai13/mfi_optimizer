import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { jsonError, readJson } from '@/lib/http'
import { generateForBranch } from '@/lib/synthetic-server'
import type { JLGGroup } from '@/lib/types'
import { firstError, SyntheticOptionsSchema } from '@/lib/validation'

/** POST /api/synthetic/preview — generated groups for the map preview. Nothing is saved. */
export async function POST(request: Request) {
  const { session, response } = await requireRole('manager')
  if (response) return response
  const parsed = SyntheticOptionsSchema.safeParse(await readJson(request))
  if (!parsed.success) return jsonError(400, firstError(parsed.error))

  try {
    const groups = await generateForBranch(session.user.branchId, session.user.id, parsed.data)
    const now = new Date().toISOString()
    // Temporary ids so the page can key and show them; real ids are made on Generate.
    return NextResponse.json(groups.map((g, i): JLGGroup => ({ ...g, id: `preview-${i + 1}`, updatedAt: now })))
  } catch (error) {
    return jsonError(400, (error as Error).message)
  }
}
