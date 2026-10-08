import type { Branch, BranchInput, GroupInput, JLGGroup, Officer, OfficerInput, OptimizeRequest, Plan, Settings, SettingsInput, SyntheticOptions, User, UserInput } from './types'

/**
 * Typed wrappers around the real /api routes, used by the pages. Function names
 * match the reference frontend's mock lib/api.ts so ported components work unchanged.
 * Errors throw an Error whose message comes from the server's `{ error }` body.
 */

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    cache: 'no-store',
  })
  if (res.status === 401) {
    // Session expired or the account was deactivated. A full page load (not the
    // router) is intended: it clears all client state. This module has no router.
    window.location.assign('/login') // eslint-disable-line @next/next/no-location-assign-relative-destination
    throw new Error('Please sign in again.')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? 'Something went wrong. Try again.')
  return body as T
}

const post = <T,>(url: string, data: unknown) => request<T>(url, { method: 'POST', body: JSON.stringify(data) })
const patch = <T,>(url: string, data: unknown) => request<T>(url, { method: 'PATCH', body: JSON.stringify(data) })

// ---------- Branches ----------
export const getBranches = () => request<Branch[]>('/api/branches')
export const createBranch = (input: BranchInput) => post<Branch>('/api/branches', input)
export const updateBranch = (id: string, input: Partial<BranchInput>) => patch<Branch>(`/api/branches/${id}`, input)

// ---------- Groups ----------
export const getGroups = () => request<JLGGroup[]>('/api/groups')
export const createGroup = (input: GroupInput) => post<JLGGroup>('/api/groups', input)
export const updateGroup = (id: string, input: Partial<GroupInput>) => patch<JLGGroup>(`/api/groups/${id}`, input)

// ---------- Officers ----------
export const getOfficers = () => request<Officer[]>('/api/officers')
export const createOfficer = (input: OfficerInput) => post<Officer>('/api/officers', input)
export const updateOfficer = (id: string, input: Partial<OfficerInput>) => patch<Officer>(`/api/officers/${id}`, input)

// ---------- Plans ----------
export const getPlans = () => request<Plan[]>('/api/plans')
export const getPlan = (id: string) => request<Plan>(`/api/plans/${id}`)
/** The server uses the saved settings and the manager's branch; `settings`/`branchId` in the request are ignored. */
export const optimizeRoutes = (req: OptimizeRequest) => post<Plan>('/api/plans/optimize', req)
export const savePlan = (id: string) => post<Plan>(`/api/plans/${id}/save`, {})
/** Branch, officer and route groups for one officer's day sheet (works for managers and for the officer). */
export const getDaySheetData = (planId: string, officerId: string) =>
  request<{ branch: Branch; officer: Officer; groups: JLGGroup[] }>(`/api/plans/${planId}/day-sheet/${officerId}`)
/** Field Officer: their latest saved plan. The officer comes from the session, not the argument. */
export const getMyLatestPlan = (_officerId?: string) => request<Plan | null>('/api/plans/mine').then((p) => p ?? undefined)

// ---------- Users ----------
export const getUsers = () => request<User[]>('/api/users')
export const createUser = (input: UserInput) => post<User>('/api/users', input)
export const updateUser = (id: string, input: Partial<Omit<User, 'id'>>) => patch<User>(`/api/users/${id}`, input)
export const resetUserPassword = (id: string, password: string) => post<{ ok: true }>(`/api/users/${id}/reset-password`, { password })

// ---------- Settings ----------
export const getSettings = () => request<Settings>('/api/settings')
export const updateSettings = (input: SettingsInput) => request<Settings>('/api/settings', { method: 'PUT', body: JSON.stringify(input) })

// ---------- Villages ----------
export type KnownVillage = { name: string; lat: number; lng: number }
export const getVillages = () => request<KnownVillage[]>('/api/villages')

// ---------- Synthetic data ----------
export const previewSyntheticGroups = (options: SyntheticOptions) => post<JLGGroup[]>('/api/synthetic/preview', options)
export const generateSyntheticGroups = (options: SyntheticOptions) =>
  post<{ created: number; removed: number }>('/api/synthetic/generate', options)
