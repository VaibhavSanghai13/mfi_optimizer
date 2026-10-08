'use client'

import { useEffect, useState } from 'react'
import { Copy, KeyRound, Pencil, Plus, Power, RefreshCw } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Badge, buttonClass, Dialog, Field, inputClass, PageHeader, Spinner, useToast } from '@/components/ui-kit'
import { createUser, getBranches, getOfficers, getUsers, resetUserPassword, updateUser } from '@/lib/api-client'
import { useAuth } from '@/lib/auth'
import type { Branch, Officer, User, UserRole } from '@/lib/types'

const roleLabel: Record<UserRole, string> = { manager: 'Manager', field_officer: 'Field Officer' }
const generatePassword = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => 'abcdefghjkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 55]).join('')

export default function UsersPage() {
  return <AppShell><Users /></AppShell>
}

function Users() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<User[] | null>(null); const [branches, setBranches] = useState<Branch[]>([]); const [officers, setOfficers] = useState<Officer[]>([])
  const [adding, setAdding] = useState(false); const [editing, setEditing] = useState<User | null>(null); const [resetting, setResetting] = useState<User | null>(null); const [toast, showToast] = useToast()
  useEffect(() => { getUsers().then(setUsers); getBranches().then(setBranches); getOfficers().then(setOfficers) }, [])
  const upsert = (u: User) => setUsers((v) => v && (v.some((x) => x.id === u.id) ? v.map((x) => x.id === u.id ? u : x) : [...v, u]))
  const toggleActive = async (u: User) => { try { upsert(await updateUser(u.id, { active: !u.active })); showToast(`${u.name} ${u.active ? 'deactivated' : 'reactivated'}.`) } catch (e) { showToast((e as Error).message) } }
  return <div className="mx-auto max-w-7xl space-y-6">
    <PageHeader eyebrow="Admin" title="Users" description="Managers plan routes and manage data; field officers see only their own day." actions={<button onClick={() => setAdding(true)} className={buttonClass.primary}><Plus size={16} />Add user</button>} />
    <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr>{['User', 'Role', 'Branch', 'Linked officer', 'Status', ''].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
      <tbody>{!users && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Loading users…</td></tr>}
        {users?.map((u) => { const self = u.id === me?.id; return <tr key={u.id} className={`border-t ${u.active ? '' : 'opacity-60'}`}><td className="px-4 py-3"><div className="font-medium">{u.name}{self && <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>}</div><div className="text-xs text-muted-foreground">{u.email}</div></td><td className="px-4 py-3"><Badge tone={u.role === 'manager' ? 'info' : 'default'}>{roleLabel[u.role]}</Badge></td><td className="px-4 py-3 text-muted-foreground">{branches.find((b) => b.id === u.branchId)?.name ?? '—'}</td><td className="px-4 py-3">{officers.find((o) => o.id === u.officerId)?.name ?? <span className="text-muted-foreground">—</span>}</td><td className="px-4 py-3">{u.active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}</td>
          <td className="px-4 py-3"><div className="flex justify-end gap-1"><Action label="Edit user" onClick={() => setEditing(u)}><Pencil size={15} /></Action><Action label="Reset password" onClick={() => setResetting(u)}><KeyRound size={15} /></Action><Action label={self ? 'You cannot deactivate your own account' : u.active ? 'Deactivate user' : 'Reactivate user'} disabled={self} onClick={() => toggleActive(u)}><Power size={15} /></Action></div></td></tr> })}</tbody></table></div>
    {(adding || editing) && <UserDialog user={editing} self={editing?.id === me?.id} branches={branches} defaultBranchId={me?.branchId} officers={officers} users={users ?? []} onClose={() => { setAdding(false); setEditing(null) }} onSaved={(u, created) => { upsert(u); setAdding(false); setEditing(null); showToast(created ? `${u.name} added.` : `${u.name} updated.`) }} />}
    {resetting && <ResetDialog user={resetting} onClose={() => setResetting(null)} onDone={() => { showToast(`Password reset for ${resetting.name}.`); setResetting(null) }} />}
    {toast}
  </div>
}

function UserDialog({ user, self, branches, defaultBranchId, officers, users, onClose, onSaved }: { user: User | null; self: boolean; branches: Branch[]; defaultBranchId?: string; officers: Officer[]; users: User[]; onClose: () => void; onSaved: (u: User, created: boolean) => void }) {
  const [form, setForm] = useState({ name: user?.name ?? '', email: user?.email ?? '', role: user?.role ?? 'field_officer' as UserRole, branchId: user?.branchId ?? defaultBranchId ?? branches[0]?.id ?? '', officerId: user?.officerId ?? '', active: user?.active ?? true, password: user ? '' : generatePassword() })
  const [show, setShow] = useState(false); const [errors, setErrors] = useState<Record<string, string>>({}); const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))
  const linked = new Set(users.filter((u) => u.id !== user?.id && u.officerId).map((u) => u.officerId))
  const save = async () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required.'
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Enter a valid email.'
    if (form.role === 'field_officer' && !form.officerId) e.officer = 'Field officers must be linked to an officer.'
    if (!user && form.password.length < 8) e.password = 'At least 8 characters.'
    setErrors(e); if (Object.keys(e).length) return
    setSaving(true)
    const base = { name: form.name, email: form.email, role: form.role, branchId: form.branchId, officerId: form.role === 'field_officer' ? form.officerId : undefined, active: form.active }
    try { onSaved(user ? await updateUser(user.id, base) : await createUser({ ...base, password: form.password }), !user) }
    catch (err) { setErrors({ email: (err as Error).message }); setSaving(false) }
  }
  return <Dialog title={user ? 'Edit user' : 'Add user'} description={user ? undefined : 'Share the email and initial password with the user.'} onClose={onClose} footer={<><button onClick={onClose} className={buttonClass.outline}>Cancel</button><button disabled={saving} onClick={save} className={buttonClass.primary}>{saving && <Spinner />}{user ? 'Save changes' : 'Add user'}</button></>}>
    <Field label="Full name *" error={errors.name}><input className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
    <Field label="Email *" error={errors.email}><input type="email" className={inputClass} value={form.email} onChange={(e) => set('email', e.target.value)} /></Field>
    <div className="grid grid-cols-2 gap-3"><Field label="Role" hint={self ? 'You cannot change your own role.' : undefined}><select disabled={self} className={`${inputClass} disabled:opacity-60`} value={form.role} onChange={(e) => set('role', e.target.value)}><option value="manager">Manager</option><option value="field_officer">Field Officer</option></select></Field><Field label="Branch"><select className={inputClass} value={form.branchId} onChange={(e) => set('branchId', e.target.value)}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field></div>
    {form.role === 'field_officer' && <Field label="Linked officer *" error={errors.officer}><select className={inputClass} value={form.officerId} onChange={(e) => set('officerId', e.target.value)}><option value="">Choose an officer</option>{officers.map((o) => <option key={o.id} value={o.id} disabled={linked.has(o.id)}>{o.name}{linked.has(o.id) ? ' (already linked)' : ''}</option>)}</select></Field>}
    {!user && <Field label="Initial password *" error={errors.password}><div className="flex gap-2"><input type={show ? 'text' : 'password'} className={inputClass} value={form.password} onChange={(e) => set('password', e.target.value)} /><button type="button" onClick={() => setShow(!show)} className="h-9 rounded-md border px-2 text-xs">{show ? 'Hide' : 'Show'}</button><button type="button" onClick={() => { set('password', generatePassword()); setShow(true) }} className="h-9 rounded-md border px-2" aria-label="Generate password"><RefreshCw size={14} /></button></div></Field>}
  </Dialog>
}

function ResetDialog({ user, onClose, onDone }: { user: User; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState(''); const [copied, setCopied] = useState(false); const [saving, setSaving] = useState(false)
  const valid = password.length >= 8
  const copy = async () => { await navigator.clipboard.writeText(password); setCopied(true) }
  const [error, setError] = useState('')
  const save = async () => { setSaving(true); setError(''); try { await resetUserPassword(user.id, password); onDone() } catch (e) { setError((e as Error).message); setSaving(false) } }
  return <Dialog title="Reset password" description={`Passwords are stored encrypted, so ${user.name}'s current password cannot be shown. Type a new one or generate one, copy it, then press Reset password — their old password stops working immediately. Cancel keeps the old password.`} onClose={onClose} footer={<><button onClick={onClose} className={buttonClass.outline}>Cancel</button><button disabled={!valid || saving} onClick={save} className={buttonClass.primary}>{saving && <Spinner />}Reset password</button></>}>
    <Field label="New password" error={valid || !password ? error || undefined : 'At least 8 characters.'}><div className="flex gap-2"><input className={`${inputClass} font-mono`} placeholder="Type or generate a new password" value={password} onChange={(e) => { setPassword(e.target.value); setCopied(false) }} /><button type="button" onClick={() => { setPassword(generatePassword()); setCopied(false) }} className="h-9 rounded-md border px-2" aria-label="Generate password"><RefreshCw size={14} /></button><button type="button" onClick={copy} disabled={!password} className="inline-flex h-9 items-center gap-1 rounded-md border px-2 text-xs"><Copy size={13} />{copied ? 'Copied' : 'Copy'}</button></div></Field>
  </Dialog>
}

function Action({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return <button onClick={onClick} disabled={disabled} aria-label={label} title={label} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40">{children}</button>
}
