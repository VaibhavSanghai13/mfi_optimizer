import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { loadVillages } from '@/lib/villages'

/** GET /api/villages — known villages for the "Village" picker in the group form. */
export async function GET() {
  const { response } = await requireRole('manager')
  if (response) return response
  return NextResponse.json(loadVillages().map(({ name, lat, lng }) => ({ name, lat, lng })))
}
