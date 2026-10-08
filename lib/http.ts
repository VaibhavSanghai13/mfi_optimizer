import { NextResponse } from 'next/server'

/** `{ error }` JSON response — every API error has this shape. */
export const jsonError = (status: number, message: string) => NextResponse.json({ error: message }, { status })

/** The request body as JSON, or null if it is missing or malformed. */
export const readJson = (request: Request): Promise<unknown> => request.json().catch(() => null)

/** A PATCH body: the changed fields as an object ({} if the body is not an object). */
export async function readPatch(request: Request): Promise<Record<string, unknown>> {
  const body = await readJson(request)
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {}
}
