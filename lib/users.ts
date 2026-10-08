import { db } from './db'

/**
 * Checks shared by "add user" and "edit user" that need the database. Returns a
 * message to show, or null when everything is fine. (The unique indexes on
 * users.email / users.officer_id stay as the last line of defence.)
 */
export async function userConflict(user: { email: string; branchId: string; officerId?: string | null }, excludeId?: string) {
  const notMe = excludeId ? { NOT: { id: excludeId } } : {}
  if (await db.user.findFirst({ where: { email: user.email, ...notMe } })) return 'A user with this email already exists.'
  if (!(await db.branch.findUnique({ where: { id: user.branchId } }))) return 'Choose a branch.'
  if (user.officerId) {
    if (!(await db.officer.findUnique({ where: { id: user.officerId } }))) return 'Choose an existing officer.'
    if (await db.user.findFirst({ where: { officerId: user.officerId, ...notMe } })) return 'This officer is already linked to another user.'
  }
  return null
}
