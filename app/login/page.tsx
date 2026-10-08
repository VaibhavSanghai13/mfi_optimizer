'use client'

import { FormEvent, useState } from 'react'
import { useAuth } from '@/lib/auth'

// The reference pre-filled demo accounts and their password ("Sign in as" picker).
// Removed: credentials must never ship in the page; they are shared privately.
export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError('')
    const result = await login(email, password)
    setBusy(false)
    if (!result.ok) return setError(result.error)
    window.location.href = result.user.role === 'field_officer' ? '/my-day' : '/'
  }
  return <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10"><section className="w-full max-w-[400px] rounded-xl border bg-card p-7 shadow-sm"><div className="mb-8 flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">MFI</div><div><p className="font-semibold tracking-tight">MFI Route Optimizer</p><p className="text-xs text-muted-foreground">Operations workspace</p></div></div><div className="mb-6"><h1 className="text-xl font-semibold tracking-tight">Welcome back</h1><p className="mt-1 text-sm text-muted-foreground">Sign in to continue to your workspace.</p></div><form onSubmit={submit} className="space-y-4"><label className="block text-sm font-medium">Email<input value={email} onChange={e => { setEmail(e.target.value); setError('') }} type="email" className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring" required /></label><label className="block text-sm font-medium">Password<input value={password} onChange={e => { setPassword(e.target.value); setError('') }} type="password" className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring" required /></label>{error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}<button disabled={busy} className="h-10 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60">{busy ? 'Signing in…' : 'Sign in'}</button></form><p className="mt-4 text-center text-xs text-muted-foreground">Forgot your password? Ask your manager to reset it.</p><p className="mt-6 text-center text-xs text-muted-foreground">Demo environment — synthetic data</p></section></main>
}
