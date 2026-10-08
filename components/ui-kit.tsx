'use client'

import { useEffect, useState } from 'react'
import { priorityLabel, reasonLabel } from '@/lib/format'
import type { PlanStatus, Priority, PriorityReason } from '@/lib/types'

export const inputClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring'

const tones = {
  high: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  default: 'bg-muted text-muted-foreground',
}
export type Tone = keyof typeof tones

export function Badge({ children, tone = 'default' }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>{children}</span>
}
export const PriorityBadge = ({ priority }: { priority: Priority }) => <Badge tone={priority}>{priorityLabel[priority]}</Badge>
export const ReasonChip = ({ reason }: { reason: PriorityReason }) => <span className="inline-flex whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">{reasonLabel[reason]}</span>
const statusTone: Record<PlanStatus, Tone> = { optimal: 'success', feasible: 'info', partial: 'medium', infeasible: 'high' }
export const StatusBadge = ({ status }: { status: PlanStatus }) => <Badge tone={statusTone[status]}><span className="capitalize">{status}</span></Badge>

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description?: string; actions?: React.ReactNode }) {
  return <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{eyebrow}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}</div>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</header>
}

export function Stat({ label, value, note }: { label: string; value: React.ReactNode; note?: React.ReactNode }) {
  return <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>{note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}</div>
}

export function Field({ label, children, error, hint }: { label: string; children: React.ReactNode; error?: string; hint?: string }) {
  return <label className="grid gap-1 text-xs font-medium text-muted-foreground">{label}{children}{hint && !error && <span className="font-normal">{hint}</span>}{error && <span className="font-normal text-destructive">{error}</span>}</label>
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-primary' : 'bg-input'}`}><span className={`inline-block size-4 rounded-full bg-background shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} /></button>
}

export function Spinner() { return <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden /> }

/** Minimal toast: `const [toast, show] = useToast()` then render `{toast}`. */
export function useToast(): [React.ReactNode, (message: string) => void] {
  const [message, setMessage] = useState('')
  useEffect(() => { if (!message) return; const t = setTimeout(() => setMessage(''), 3000); return () => clearTimeout(t) }, [message])
  const node = message ? <div role="status" className="fixed bottom-4 right-4 z-[1200] rounded-lg border bg-popover px-4 py-3 text-sm shadow-lg">{message}</div> : null
  return [node, setMessage]
}

export function Dialog({ title, description, children, onClose, footer }: { title: string; description?: string; children: React.ReactNode; onClose: () => void; footer?: React.ReactNode }) {
  return <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/30 p-4" onClick={onClose}><div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-xl border bg-background p-6 shadow-xl" onClick={e => e.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">{title}</h2>{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}</div><button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">✕</button></div><div className="mt-5 space-y-4">{children}</div>{footer && <div className="mt-6 flex justify-end gap-2 border-t pt-4">{footer}</div>}</div></div>
}

export const buttonClass = {
  primary: 'inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50',
  outline: 'inline-flex h-9 items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm hover:bg-muted disabled:opacity-50',
}
