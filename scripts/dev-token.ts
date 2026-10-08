/**
 * Development helper: prints a session JWT for testing the Python optimizer with curl.
 *
 *   npm run dev:token                  → a manager token
 *   npm run dev:token -- field_officer → a field-officer token
 *
 * It is signed with JWT_SECRET from .env, exactly like a real login, but for a
 * made-up user. Only useful locally; never share the output.
 */
import { signSession } from '@/lib/auth/jwt'
import type { UserRole } from '@/lib/types'

const role = (process.argv[2] ?? 'manager') as UserRole
if (role !== 'manager' && role !== 'field_officer') {
  console.error('Usage: npm run dev:token -- [manager|field_officer]')
  process.exit(1)
}

signSession({ sub: 'dev-token', role, officerId: null }).then((token) => console.log(token))
