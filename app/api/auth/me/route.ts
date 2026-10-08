import { NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth/session'

/** GET /api/auth/me — the signed-in user and their branch name. */
export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()
  return NextResponse.json(session)
}
