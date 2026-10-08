import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { jsonError, readPatch } from '@/lib/http'
import { toBranch } from '@/lib/mappers'
import { BranchSchema, firstError } from '@/lib/validation'

/** PATCH /api/branches/[id] — update some fields of a branch. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireRole('manager')
  if (response) return response
  const { id } = await params

  const existing = await db.branch.findUnique({ where: { id } })
  if (!existing) return jsonError(404, 'Branch not found.')

  // Validate the record as it will be after the change (zod drops `id` and unknown keys).
  const parsed = BranchSchema.safeParse({ ...toBranch(existing), ...(await readPatch(request)) })
  if (!parsed.success) return jsonError(400, firstError(parsed.error))

  const row = await db.branch.update({ where: { id }, data: parsed.data })
  return NextResponse.json(toBranch(row))
}
