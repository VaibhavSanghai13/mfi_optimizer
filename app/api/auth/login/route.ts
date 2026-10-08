import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { sessionCookie, signSession } from '@/lib/auth/jwt'
import { verifyPassword } from '@/lib/auth/password'
import { toUser } from '@/lib/auth/session'

const LoginBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
})

// A real bcrypt hash of a random string: comparing against it when the email is
// unknown makes "no such user" take as long as "wrong password".
const DUMMY_HASH = '$2b$10$lFSQnHGegUOF6SL.BmseW.Fawf3Pek/9LplFHpkoUtb7wG06Gab3a'

/** POST /api/auth/login — email + password → session cookie. */
export async function POST(request: Request) {
  const parsed = LoginBody.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid email and password.' }, { status: 400 })
  }
  const { email, password } = parsed.data

  const user = await db.user.findUnique({ where: { email } })
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH)
  if (!user || !passwordOk) {
    return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 })
  }
  // Checked only after the password, so strangers cannot probe which accounts are deactivated.
  if (!user.active) {
    return NextResponse.json({ error: 'This account has been deactivated.' }, { status: 403 })
  }

  const token = await signSession({ sub: user.id, role: user.role, officerId: user.officerId })
  const response = NextResponse.json({ user: toUser(user) })
  response.cookies.set(sessionCookie(token))
  return response
}
