'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from './types'

/**
 * Who is signed in, for client components. The session itself is an httpOnly
 * cookie the page cannot read; this context asks the server via /api/auth/me.
 */

type AuthContextValue = {
  user: User | null
  branchName: string
  ready: boolean
  login: (email: string, password: string) => Promise<{ ok: true; user: User } | { ok: false; error: string }>
  logout: () => void
}
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [branchName, setBranchName] = useState('')
  const [ready, setReady] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  // Re-checked on every navigation, so a deactivated user is signed out on their next page change.
  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((session: { user: User; branchName: string } | null) => {
        if (cancelled) return
        setUser(session?.user ?? null)
        setBranchName(session?.branchName ?? '')
        setReady(true)
      })
      .catch(() => !cancelled && setReady(true))
    return () => {
      cancelled = true
    }
  }, [pathname])

  const login: AuthContextValue['login'] = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: body.error ?? 'Could not sign in. Try again.' }
    setUser(body.user)
    return { ok: true, user: body.user }
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    router.replace('/login')
  }

  return <AuthContext.Provider value={{ user, branchName, ready, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used inside AuthProvider'); return context }
