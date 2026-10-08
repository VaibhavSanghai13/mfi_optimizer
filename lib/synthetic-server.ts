import { db } from './db'
import { buildSyntheticGroups } from './synthetic'
import type { GroupInput, SyntheticOptions } from './types'
import { loadVillages } from './villages'

/**
 * Server side of the Generate Synthetic Data page: runs the pure generator for the
 * signed-in manager's branch, pinning a few groups to that branch's active officers.
 */
export async function generateForBranch(branchId: string, userId: string, options: SyntheticOptions): Promise<GroupInput[]> {
  const [branch, officers] = await Promise.all([
    db.branch.findUniqueOrThrow({ where: { id: branchId } }),
    db.officer.findMany({ where: { branchId, active: true }, select: { id: true }, orderBy: { name: 'asc' } }),
  ])
  return buildSyntheticGroups(loadVillages(), options, {
    branch,
    officerIds: officers.map((o) => o.id),
    createdBy: userId,
    // e.g. "SYN-2026-001": the seed in the code tells batches apart.
    codePrefix: `SYN-${options.seed}`,
  })
}
