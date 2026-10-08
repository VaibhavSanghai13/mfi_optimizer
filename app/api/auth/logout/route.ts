import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth/jwt'

/** POST /api/auth/logout — clears the session cookie. */
export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(SESSION_COOKIE)
  return response
}
