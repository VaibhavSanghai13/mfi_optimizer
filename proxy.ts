import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySession } from '@/lib/auth/jwt'
import type { UserRole } from '@/lib/types'

/**
 * Runs before every page and API request (Next.js 16 "proxy", formerly middleware).
 *
 *  - No valid session → pages redirect to /login, API calls get 401.
 *  - Role routing: a Field Officer only gets /my-day; a Manager gets everything else.
 *
 * It only checks the JWT (no database). API routes additionally call requireRole(),
 * which re-checks that the user is still active.
 */

/** Reachable without signing in. */
const PUBLIC_API = ['/api/auth/login', '/api/auth/logout']
/** The Python optimizer verifies the JWT itself (S8). */
const OPTIMIZER_API = '/api/optimize'
/** The only API routes a Field Officer may call (the routes check ownership themselves). */
const FIELD_OFFICER_API = ['/api/auth/me', '/api/plans/mine']
const FIELD_OFFICER_DAY_SHEET = /^\/api\/plans\/[^/]+\/day-sheet\/[^/]+$/

const home = (role: UserRole) => (role === 'field_officer' ? '/my-day' : '/')
const matches = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`)

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  const isApi = path.startsWith('/api/')

  if (PUBLIC_API.includes(path) || matches(path, OPTIMIZER_API)) return NextResponse.next()

  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value)

  if (path === '/login') {
    // Already signed in → go to your home page instead of the login form.
    return session ? NextResponse.redirect(new URL(home(session.role), request.url)) : NextResponse.next()
  }

  if (!session) {
    if (isApi) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isApi) {
    const allowed =
      session.role === 'manager' || FIELD_OFFICER_API.some((p) => matches(path, p)) || FIELD_OFFICER_DAY_SHEET.test(path)
    return allowed ? NextResponse.next() : NextResponse.json({ error: 'You do not have access to this.' }, { status: 403 })
  }

  // Pages: each role has its own area.
  const onMyDay = matches(path, '/my-day')
  if (session.role === 'field_officer' && !onMyDay) return NextResponse.redirect(new URL('/my-day', request.url))
  if (session.role === 'manager' && onMyDay) return NextResponse.redirect(new URL('/', request.url))
  return NextResponse.next()
}

export const config = {
  // Everything except Next.js internals and files in public/ (icons, images).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|ico|webp)$).*)'],
}
