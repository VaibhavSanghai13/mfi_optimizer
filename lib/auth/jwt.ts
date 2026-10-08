import { jwtVerify, SignJWT } from 'jose'
import type { UserRole } from '../types'

/**
 * Session tokens: a JWT signed with HS256 and the shared JWT_SECRET (the Python
 * optimizer verifies the same tokens with PyJWT). Kept free of database access so
 * proxy.ts can use it too.
 */

export const SESSION_COOKIE = 'session'
export const SESSION_HOURS = 8

export type SessionClaims = { sub: string; role: UserRole; officerId: string | null }

function secretKey() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not set. Add it to .env.')
  return new TextEncoder().encode(secret)
}

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ role: claims.role, officerId: claims.officerId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secretKey())
}

/** The token's claims, or null if it is missing, tampered with or expired. */
export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] })
    if (!payload.sub || (payload.role !== 'manager' && payload.role !== 'field_officer')) return null
    return { sub: payload.sub, role: payload.role, officerId: (payload.officerId as string | null) ?? null }
  } catch {
    return null
  }
}

/** Cookie settings for the session token (httpOnly: JavaScript in the page cannot read it). */
export const sessionCookie = (token: string) => ({
  name: SESSION_COOKIE,
  value: token,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_HOURS * 60 * 60,
})
