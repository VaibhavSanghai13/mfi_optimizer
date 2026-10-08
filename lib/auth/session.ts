import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { db } from '../db'
import type { User, UserRole } from '../types'
import { SESSION_COOKIE, verifySession } from './jwt'

/**
 * Server-side session helpers for API routes.
 *
 * proxy.ts already rejects requests without a valid token, but only API routes can
 * reach the database — so they re-check that the user still exists and is active.
 * Deactivating a user therefore takes effect on their very next request.
 */

export type Session = { user: User; branchName: string }

export function toUser(row: { id: string; name: string; email: string; role: UserRole; branchId: string; officerId: string | null; active: boolean }): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    branchId: row.branchId,
    officerId: row.officerId ?? undefined,
    active: row.active,
  }
}

/** The signed-in, active user — or null. */
export async function getSession(): Promise<Session | null> {
  const claims = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!claims) return null
  const row = await db.user.findUnique({ where: { id: claims.sub }, include: { branch: { select: { name: true } } } })
  if (!row || !row.active) return null
  return { user: toUser(row), branchName: row.branch.name }
}

/**
 * Use at the top of every protected API route:
 *
 *   const { session, response } = await requireRole('manager')
 *   if (response) return response
 *
 * `response` is a ready 401 (not signed in / deactivated) or 403 (wrong role).
 */
export async function requireRole(
  ...roles: UserRole[]
): Promise<{ session: Session; response?: never } | { session?: never; response: NextResponse }> {
  const session = await getSession()
  if (!session) return { response: unauthorized() }
  if (!roles.includes(session.user.role)) {
    return { response: NextResponse.json({ error: 'You do not have access to this.' }, { status: 403 }) }
  }
  return { session }
}

/** 401 that also removes the cookie, so the browser is sent back to /login. */
export function unauthorized(message = 'Please sign in again.') {
  const response = NextResponse.json({ error: message }, { status: 401 })
  response.cookies.delete(SESSION_COOKIE)
  return response
}
