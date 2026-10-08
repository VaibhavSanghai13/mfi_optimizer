'use client'

import { useEffect, useMemo, useState } from 'react'
import { Copy, Pencil, Plus, Power, Search, Sparkles, X } from 'lucide-react'
import { createBranch, createGroup, createOfficer, generateSyntheticGroups, getBranches, getGroups, getOfficers, getSettings, getVillages, type KnownVillage, previewSyntheticGroups, updateBranch, updateGroup, updateOfficer } from '@/lib/api-client'
import { useAuth } from '@/lib/auth'
import { officerPalette } from '@/lib/constants'
import { fmtTime, reasonLabel } from '@/lib/format'
import type { Branch, BranchInput, GroupInput, JLGGroup, MeetingFrequency, Officer, OfficerInput, Priority, PriorityReason, Settings, SyntheticOptions, Weekday } from '@/lib/types'
import { RouteMap } from './maps'
import { MapPicker } from './map-picker'
import { Badge, Field, inputClass, PageHeader, PriorityBadge, Spinner, Stat, Toggle, useToast } from './ui-kit'

const days: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const priorities: Priority[] = ['high', 'medium', 'low']
const reasons: PriorityReason[] = ['overdue', 'disbursement', 'new_group', 'routine']
const frequencies: MeetingFrequency[] = ['weekly', 'fortnightly', 'monthly']
const priorityColor: Record<Priority, string> = { high: '#dc2626', medium: '#d97706', low: '#64748b' }
const PAGE_SIZE = 10
const inMaharashtra = (lat: number, lng: number) => lat >= 15.5 && lat <= 22.1 && lng >= 72.5 && lng <= 80.9

export function DataWorkspace({ kind }: { kind: 'groups' | 'officers' | 'branches' | 'generate' }) {
  if (kind === 'generate') return <GenerateData />
  if (kind === 'officers') return <OfficersView />
  if (kind === 'branches') return <BranchesView />
  return <GroupsView />
}

// ---------------- JLG groups ----------------
function GroupsView() {
  const [groups, setGroups] = useState<JLGGroup[] | null>(null); const [officers, setOfficers] = useState<Officer[]>([]); const [branches, setBranches] = useState<Branch[]>([])
  const [search, setSearch] = useState(''); const [priority, setPriority] = useState(''); const [day, setDay] = useState(''); const [source, setSource] = useState(''); const [status, setStatus] = useState('active')
  const [page, setPage] = useState(0); const [editing, setEditing] = useState<JLGGroup | GroupInput | null>(null); const [defaults, setDefaults] = useState<Settings | null>(null); const [toast, showToast] = useToast()
  const [villages, setVillages] = useState<KnownVillage[]>([]); const { user } = useAuth()
  useEffect(() => { getGroups().then(setGroups); getOfficers().then(setOfficers); getBranches().then(setBranches); getSettings().then(setDefaults); getVillages().then(setVillages) }, [])
  const filtered = useMemo(() => (groups ?? []).filter((g) =>
    `${g.name} ${g.village} ${g.centerCode}`.toLowerCase().includes(search.toLowerCase())
    && (!priority || g.priority === priority) && (!day || g.meetingDay === day) && (!source || g.source === source)
    && (!status || (status === 'active' ? g.active : !g.active))), [groups, search, priority, day, source, status])
  // Changing a filter goes back to page 1.
  const resetting = (set: (value: string) => void) => (value: string) => { set(value); setPage(0) }
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const rows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  const upsert = (g: JLGGroup) => setGroups((v) => v && (v.some((x) => x.id === g.id) ? v.map((x) => x.id === g.id ? g : x) : [...v, g]))
  const toggleActive = async (g: JLGGroup) => { try { upsert(await updateGroup(g.id, { active: !g.active })); showToast(`${g.name} ${g.active ? 'deactivated' : 'reactivated'}.`) } catch (e) { showToast((e as Error).message) } }
  const duplicate = (g: JLGGroup) => { const { id, updatedAt, ...rest } = g; setEditing({ ...rest, name: `${g.name} (copy)`, centerCode: '', source: 'manual' }) }
  const home = branches.find(b => b.id === user?.branchId) ?? branches[0]
  // createdBy is set by the server from the session.
  const blank: GroupInput = { name: '', centerCode: '', memberCount: 8, village: '', taluka: home?.taluka ?? 'Baramati', district: home?.district ?? 'Pune', lat: home?.lat ?? 18.151, lng: home?.lng ?? 74.577, meetingDay: 'Mon', meetingFrequency: 'weekly', windowStart: '09:00', windowEnd: '10:30', meetingDurationMin: defaults?.defaultMeetingDurationMin ?? 30, priority: 'medium', priorityReason: 'routine', assignedOfficerId: null, active: true, source: 'manual', createdBy: '' }
  const all = groups ?? []
  return <div className="mx-auto max-w-7xl space-y-6">
    <PageHeader eyebrow="Data management" title="JLG Groups" description="Manage operational records and keep your branch data current." actions={<button onClick={() => setEditing(blank)} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"><Plus size={16} /> Add group</button>} />
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <div className="grid content-start gap-4 sm:grid-cols-2"><Stat label="Total groups" value={groups ? all.length : '—'} /><Stat label="Active" value={groups ? all.filter(g => g.active).length : '—'} /><Stat label="High priority" value={groups ? all.filter(g => g.priority === 'high').length : '—'} /><Stat label="By source" value={groups ? <span className="text-base">{all.filter(g => g.source === 'synthetic').length} synthetic · {all.filter(g => g.source === 'manual').length} manual</span> : '—'} /></div>
      <div className="overflow-hidden rounded-xl border bg-card"><div className="flex items-center justify-between border-b px-4 py-2.5"><p className="text-sm font-semibold">Data overview</p><span className="flex gap-3 text-[11px] text-muted-foreground">{priorities.map(p => <span key={p} className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: priorityColor[p] }} />{p}</span>)}</span></div><div className="h-44">{home && <RouteMap className="h-44 w-full" branch={home} fitKey={`${all.length}`} points={all.filter(g => g.active).map(g => ({ id: g.id, lat: g.lat, lng: g.lng, color: priorityColor[g.priority], popup: <GroupPopup g={g} /> }))} />}</div></div>
    </div>
    <div className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b p-3"><div className="relative min-w-56 flex-1"><Search size={15} className="absolute left-3 top-2.5 text-muted-foreground" /><input className={`${inputClass} pl-9`} placeholder="Search groups, villages, codes" value={search} onChange={e => resetting(setSearch)(e.target.value)} /></div>
        <FilterSelect label="Priority" value={priority} onChange={resetting(setPriority)} options={priorities.map(p => [p, p[0].toUpperCase() + p.slice(1)])} />
        <FilterSelect label="Meeting day" value={day} onChange={resetting(setDay)} options={days.map(d => [d, d])} />
        <FilterSelect label="Source" value={source} onChange={resetting(setSource)} options={[['synthetic', 'Synthetic'], ['manual', 'Manual']]} />
        <FilterSelect label="Status" value={status} onChange={resetting(setStatus)} options={[['active', 'Active'], ['inactive', 'Inactive']]} allLabel="All statuses" />
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr>{['Group', 'Village', 'Schedule', 'Priority', 'Officer', 'Source', 'Status', ''].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
        <tbody>{!groups && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">Loading groups…</td></tr>}{groups && !rows.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">No groups match these filters.</td></tr>}
          {rows.map(g => <tr key={g.id} className={`border-t ${g.active ? '' : 'opacity-60'}`}><td className="px-4 py-3"><div className="font-medium">{g.name}</div><div className="text-xs text-muted-foreground">{g.centerCode || '—'} · {g.memberCount} members</div></td><td className="px-4 py-3">{g.village}<div className="text-xs text-muted-foreground">{g.taluka}</div></td><td className="px-4 py-3">{g.meetingDay} · <span className="capitalize">{g.meetingFrequency}</span><div className="text-xs text-muted-foreground">{fmtTime(g.windowStart)}–{fmtTime(g.windowEnd)} · {g.meetingDurationMin} min</div></td><td className="px-4 py-3"><PriorityBadge priority={g.priority} /><div className="mt-1 text-[11px] text-muted-foreground">{reasonLabel[g.priorityReason]}</div></td><td className="px-4 py-3 text-xs">{officers.find(o => o.id === g.assignedOfficerId)?.name ?? <span className="text-muted-foreground">Any officer</span>}</td><td className="px-4 py-3"><Badge>{g.source}</Badge></td><td className="px-4 py-3">{g.active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}</td>
            <td className="px-4 py-3"><div className="flex justify-end gap-1"><IconButton label="Edit group" onClick={() => setEditing(g)}><Pencil size={15} /></IconButton><IconButton label="Duplicate group" onClick={() => duplicate(g)}><Copy size={15} /></IconButton><IconButton label={g.active ? 'Deactivate group' : 'Reactivate group'} onClick={() => toggleActive(g)}><Power size={15} /></IconButton></div></td></tr>)}</tbody></table></div>
      <div className="flex items-center justify-between border-t px-4 py-2.5 text-xs text-muted-foreground"><span>{filtered.length} group{filtered.length === 1 ? '' : 's'}</span><div className="flex items-center gap-2"><button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="rounded-md border px-2 py-1 disabled:opacity-40">Previous</button><span>Page {page + 1} of {pages}</span><button disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)} className="rounded-md border px-2 py-1 disabled:opacity-40">Next</button></div></div>
    </div>
    {editing && <GroupSheet item={editing} officers={officers} villages={villages} onClose={() => setEditing(null)} onSaved={(g, created) => { upsert(g); setEditing(null); showToast(created ? 'Group added.' : 'Group saved.') }} />}
    {toast}
  </div>
}

function GroupPopup({ g }: { g: JLGGroup }) { return <div className="text-xs"><strong>{g.name}</strong><br />{g.village} · {g.meetingDay} {fmtTime(g.windowStart)}–{fmtTime(g.windowEnd)}<br />Priority: {g.priority}</div> }

function GroupSheet({ item, officers, villages, onClose, onSaved }: { item: JLGGroup | GroupInput; officers: Officer[]; villages: KnownVillage[]; onClose: () => void; onSaved: (g: JLGGroup, created: boolean) => void }) {
  const existing = 'id' in item ? item : null
  const [form, setForm] = useState<GroupInput>(() => { if (!existing) return item as GroupInput; const { id, updatedAt, ...rest } = existing; return rest })
  const [errors, setErrors] = useState<Record<string, string>>({}); const [saving, setSaving] = useState(false)
  const set = <K extends keyof GroupInput>(key: K, value: GroupInput[K]) => setForm(f => ({ ...f, [key]: value }))
  const pickVillage = (name: string) => { const v = villages.find(x => x.name.toLowerCase() === name.toLowerCase()); setForm(f => ({ ...f, village: name, ...(v ? { lat: v.lat, lng: v.lng } : {}) })) }
  const save = async () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required.'
    if (!form.village.trim()) e.village = 'Village is required.'
    if (form.windowEnd <= form.windowStart) e.window = 'Window end must be after start.'
    if (!inMaharashtra(form.lat, form.lng)) e.location = 'Pin must be within Maharashtra.'
    if (form.meetingDurationMin < 10 || form.meetingDurationMin > 120) e.duration = 'Duration must be between 10 and 120 minutes.'
    if (form.memberCount < 1 || form.memberCount > 20) e.members = 'Members must be between 1 and 20.'
    setErrors(e); if (Object.keys(e).length) return
    setSaving(true)
    try { onSaved(existing ? await updateGroup(existing.id, form) : await createGroup(form), !existing) }
    catch (err) { setErrors({ form: (err as Error).message }); setSaving(false) }
  }
  return <SideSheet title={`${existing ? 'Edit' : 'Add'} JLG group`} onClose={onClose} onSave={save} saving={saving} error={errors.form}>
    <Section title="Basic"><Field label="Name *" error={errors.name}><input className={inputClass} value={form.name} onChange={e => set('name', e.target.value)} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Center code"><input className={inputClass} value={form.centerCode} onChange={e => set('centerCode', e.target.value)} /></Field><Field label="Member count" error={errors.members}><input type="number" className={inputClass} value={form.memberCount} onChange={e => set('memberCount', +e.target.value)} /></Field></div></Section>
    <Section title="Location"><div className="grid grid-cols-3 gap-3"><Field label="Village *" error={errors.village} hint="Pick a known village to jump the map"><input list="village-list" className={inputClass} value={form.village} onChange={e => pickVillage(e.target.value)} /><datalist id="village-list">{villages.map(v => <option key={v.name} value={v.name} />)}</datalist></Field><Field label="Taluka"><input className={inputClass} value={form.taluka} onChange={e => set('taluka', e.target.value)} /></Field><Field label="District"><input className={inputClass} value={form.district} onChange={e => set('district', e.target.value)} /></Field></div>
      <MapPicker lat={form.lat} lng={form.lng} onChange={(lat, lng) => setForm(f => ({ ...f, lat, lng }))} />
      <div className="grid grid-cols-2 gap-3"><Field label="Latitude" error={errors.location}><input type="number" step="0.0001" className={inputClass} value={form.lat} onChange={e => set('lat', +e.target.value)} /></Field><Field label="Longitude"><input type="number" step="0.0001" className={inputClass} value={form.lng} onChange={e => set('lng', +e.target.value)} /></Field></div></Section>
    <Section title="Schedule"><div className="grid grid-cols-2 gap-3"><Field label="Meeting day"><select className={inputClass} value={form.meetingDay} onChange={e => set('meetingDay', e.target.value as Weekday)}>{days.map(x => <option key={x}>{x}</option>)}</select></Field><Field label="Frequency"><select className={inputClass} value={form.meetingFrequency} onChange={e => set('meetingFrequency', e.target.value as MeetingFrequency)}>{frequencies.map(x => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}</select></Field></div><div className="grid grid-cols-3 gap-3"><Field label="Window start" error={errors.window}><input type="time" className={inputClass} value={form.windowStart} onChange={e => set('windowStart', e.target.value)} /></Field><Field label="Window end"><input type="time" className={inputClass} value={form.windowEnd} onChange={e => set('windowEnd', e.target.value)} /></Field><Field label="Duration (min)" error={errors.duration}><input type="number" className={inputClass} value={form.meetingDurationMin} onChange={e => set('meetingDurationMin', +e.target.value)} /></Field></div></Section>
    <Section title="Priority"><div className="grid grid-cols-2 gap-3"><Field label="Priority"><select className={inputClass} value={form.priority} onChange={e => set('priority', e.target.value as Priority)}>{priorities.map(x => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}</select></Field><Field label="Reason"><select className={inputClass} value={form.priorityReason} onChange={e => set('priorityReason', e.target.value as PriorityReason)}>{reasons.map(x => <option key={x} value={x}>{reasonLabel[x]}</option>)}</select></Field></div></Section>
    <Section title="Assignment"><Field label="Officer" hint="Leave as “Any officer” to let the optimizer decide."><select className={inputClass} value={form.assignedOfficerId ?? ''} onChange={e => set('assignedOfficerId', e.target.value || null)}><option value="">Any officer</option>{officers.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field><div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"><span>Active</span><Toggle label="Active" checked={form.active} onChange={v => set('active', v)} /></div></Section>
  </SideSheet>
}

// ---------------- Officers ----------------
function OfficersView() {
  const [officers, setOfficers] = useState<Officer[] | null>(null); const [branches, setBranches] = useState<Branch[]>([]); const [editing, setEditing] = useState<Officer | OfficerInput | null>(null); const [defaults, setDefaults] = useState<Settings | null>(null); const [toast, showToast] = useToast()
  useEffect(() => { getOfficers().then(setOfficers); getBranches().then(setBranches); getSettings().then(setDefaults) }, [])
  const upsert = (o: Officer) => setOfficers(v => v && (v.some(x => x.id === o.id) ? v.map(x => x.id === o.id ? o : x) : [...v, o]))
  const toggleActive = async (o: Officer) => { try { upsert(await updateOfficer(o.id, { active: !o.active })); showToast(`${o.name} ${o.active ? 'deactivated' : 'reactivated'}.`) } catch (e) { showToast((e as Error).message) } }
  const { user } = useAuth()
  const home = branches.find(b => b.id === user?.branchId) ?? branches[0]
  const blank = (): OfficerInput => ({ name: '', branchId: home?.id ?? '', startLat: home?.lat ?? 18.151, startLng: home?.lng ?? 74.577, shiftStart: defaults?.defaultShiftStart ?? '08:30', shiftEnd: defaults?.defaultShiftEnd ?? '17:30', breakStart: defaults?.defaultBreakStart ?? '13:00', breakDurationMin: defaults?.defaultBreakDurationMin ?? 30, maxMeetingsPerDay: 5, vehicle: 'two_wheeler', color: officerPalette[(officers?.length ?? 0) % officerPalette.length], active: true })
  return <div className="mx-auto max-w-7xl space-y-6">
    <PageHeader eyebrow="Data management" title="Officers" description="Field officers, their shifts and where their day starts." actions={<button onClick={() => setEditing(blank())} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"><Plus size={16} /> Add officer</button>} />
    <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr>{['Officer', 'Branch', 'Shift', 'Break', 'Max meetings', 'Status', ''].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
      <tbody>{!officers && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Loading officers…</td></tr>}{officers?.map(o => <tr key={o.id} className={`border-t ${o.active ? '' : 'opacity-60'}`}><td className="px-4 py-3"><div className="flex items-center gap-2 font-medium"><span className="size-2.5 rounded-full" style={{ background: o.color }} />{o.name}</div><div className="text-xs text-muted-foreground">Two-wheeler</div></td><td className="px-4 py-3 text-muted-foreground">{branches.find(b => b.id === o.branchId)?.name ?? '—'}</td><td className="px-4 py-3">{fmtTime(o.shiftStart)}–{fmtTime(o.shiftEnd)}</td><td className="px-4 py-3">{fmtTime(o.breakStart)} · {o.breakDurationMin} min</td><td className="px-4 py-3">{o.maxMeetingsPerDay}</td><td className="px-4 py-3">{o.active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}</td><td className="px-4 py-3"><div className="flex justify-end gap-1"><IconButton label="Edit officer" onClick={() => setEditing(o)}><Pencil size={15} /></IconButton><IconButton label={o.active ? 'Deactivate officer' : 'Reactivate officer'} onClick={() => toggleActive(o)}><Power size={15} /></IconButton></div></td></tr>)}</tbody></table></div>
    {editing && <OfficerSheet item={editing} branches={branches} onClose={() => setEditing(null)} onSaved={(o, created) => { upsert(o); setEditing(null); showToast(created ? 'Officer added.' : 'Officer saved.') }} />}
    {toast}
  </div>
}

function OfficerSheet({ item, branches, onClose, onSaved }: { item: Officer | OfficerInput; branches: Branch[]; onClose: () => void; onSaved: (o: Officer, created: boolean) => void }) {
  const existing = 'id' in item ? item : null
  const [form, setForm] = useState<OfficerInput>(() => { if (!existing) return item as OfficerInput; const { id, ...rest } = existing; return rest })
  const [errors, setErrors] = useState<Record<string, string>>({}); const [saving, setSaving] = useState(false)
  const set = <K extends keyof OfficerInput>(key: K, value: OfficerInput[K]) => setForm(f => ({ ...f, [key]: value }))
  const branch = branches.find(b => b.id === form.branchId)
  const atBranch = !!branch && branch.lat === form.startLat && branch.lng === form.startLng
  const save = async () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required.'
    if (form.shiftEnd <= form.shiftStart) e.shift = 'Shift end must be after start.'
    if (form.breakStart < form.shiftStart || form.breakStart >= form.shiftEnd) e.break = 'Break must be within the shift.'
    if (form.maxMeetingsPerDay < 1 || form.maxMeetingsPerDay > 15) e.max = 'Between 1 and 15.'
    setErrors(e); if (Object.keys(e).length) return
    setSaving(true)
    try { onSaved(existing ? await updateOfficer(existing.id, form) : await createOfficer(form), !existing) }
    catch (err) { setErrors({ form: (err as Error).message }); setSaving(false) }
  }
  return <SideSheet title={`${existing ? 'Edit' : 'Add'} officer`} onClose={onClose} onSave={save} saving={saving} error={errors.form}>
    <Section title="Basic"><Field label="Name *" error={errors.name}><input className={inputClass} value={form.name} onChange={e => set('name', e.target.value)} /></Field><Field label="Branch"><select className={inputClass} value={form.branchId} onChange={e => { const b = branches.find(x => x.id === e.target.value); setForm(f => ({ ...f, branchId: e.target.value, ...(b ? { startLat: b.lat, startLng: b.lng } : {}) })) }}>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
      <Field label="Route color"><div className="flex flex-wrap gap-2">{officerPalette.map(c => <button key={c} type="button" onClick={() => set('color', c)} aria-label={`Color ${c}`} className={`size-7 rounded-full border-2 ${form.color === c ? 'border-foreground' : 'border-transparent'}`} style={{ background: c }} />)}</div></Field></Section>
    <Section title="Start location"><p className="text-xs text-muted-foreground">{atBranch ? 'Starts and ends the day at the branch.' : 'Custom start location.'} {!atBranch && branch && <button type="button" onClick={() => setForm(f => ({ ...f, startLat: branch.lat, startLng: branch.lng }))} className="font-medium text-foreground underline">Reset to branch</button>}</p><MapPicker lat={form.startLat} lng={form.startLng} onChange={(lat, lng) => setForm(f => ({ ...f, startLat: lat, startLng: lng }))} /></Section>
    <Section title="Working hours"><div className="grid grid-cols-2 gap-3"><Field label="Shift start" error={errors.shift}><input type="time" className={inputClass} value={form.shiftStart} onChange={e => set('shiftStart', e.target.value)} /></Field><Field label="Shift end"><input type="time" className={inputClass} value={form.shiftEnd} onChange={e => set('shiftEnd', e.target.value)} /></Field><Field label="Break start" error={errors.break}><input type="time" className={inputClass} value={form.breakStart} onChange={e => set('breakStart', e.target.value)} /></Field><Field label="Break (min)"><input type="number" className={inputClass} value={form.breakDurationMin} onChange={e => set('breakDurationMin', +e.target.value)} /></Field><Field label="Max meetings per day" error={errors.max}><input type="number" className={inputClass} value={form.maxMeetingsPerDay} onChange={e => set('maxMeetingsPerDay', +e.target.value)} /></Field></div><div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"><span>Active</span><Toggle label="Active" checked={form.active} onChange={v => set('active', v)} /></div></Section>
  </SideSheet>
}

// ---------------- Branches ----------------
function BranchesView() {
  const [branches, setBranches] = useState<Branch[] | null>(null); const [editing, setEditing] = useState<Branch | BranchInput | null>(null); const [toast, showToast] = useToast()
  useEffect(() => { getBranches().then(setBranches) }, [])
  const upsert = (b: Branch) => setBranches(v => v && (v.some(x => x.id === b.id) ? v.map(x => x.id === b.id ? b : x) : [...v, b]))
  const blank: BranchInput = { name: '', district: 'Pune', taluka: '', address: '', lat: 18.151, lng: 74.577 }
  return <div className="mx-auto max-w-7xl space-y-6">
    <PageHeader eyebrow="Data management" title="Branches" description="Branch offices are where officers’ routes start and end." actions={<button onClick={() => setEditing(blank)} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"><Plus size={16} /> Add branch</button>} />
    <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr>{['Branch', 'Location', 'Address', ''].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
      <tbody>{!branches && <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">Loading branches…</td></tr>}{branches?.map(b => <tr key={b.id} className="border-t"><td className="px-4 py-3 font-medium">{b.name}</td><td className="px-4 py-3">{b.taluka}, {b.district}<div className="text-xs text-muted-foreground">{b.lat.toFixed(4)}, {b.lng.toFixed(4)}</div></td><td className="px-4 py-3 text-muted-foreground">{b.address}</td><td className="px-4 py-3 text-right"><IconButton label="Edit branch" onClick={() => setEditing(b)}><Pencil size={15} /></IconButton></td></tr>)}</tbody></table></div>
    {editing && <BranchSheet item={editing} onClose={() => setEditing(null)} onSaved={(b, created) => { upsert(b); setEditing(null); showToast(created ? 'Branch added.' : 'Branch saved.') }} />}
    {toast}
  </div>
}

function BranchSheet({ item, onClose, onSaved }: { item: Branch | BranchInput; onClose: () => void; onSaved: (b: Branch, created: boolean) => void }) {
  const existing = 'id' in item ? item : null
  const [form, setForm] = useState<BranchInput>(() => { if (!existing) return item as BranchInput; const { id, ...rest } = existing; return rest })
  const [errors, setErrors] = useState<Record<string, string>>({}); const [saving, setSaving] = useState(false)
  const set = <K extends keyof BranchInput>(key: K, value: BranchInput[K]) => setForm(f => ({ ...f, [key]: value }))
  const save = async () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required.'
    if (!form.taluka.trim()) e.taluka = 'Taluka is required.'
    if (!inMaharashtra(form.lat, form.lng)) e.location = 'Pin must be within Maharashtra.'
    setErrors(e); if (Object.keys(e).length) return
    setSaving(true)
    try { onSaved(existing ? await updateBranch(existing.id, form) : await createBranch(form), !existing) }
    catch (err) { setErrors({ form: (err as Error).message }); setSaving(false) }
  }
  return <SideSheet title={`${existing ? 'Edit' : 'Add'} branch`} onClose={onClose} onSave={save} saving={saving} error={errors.form}>
    <Section title="Basic"><Field label="Name *" error={errors.name}><input className={inputClass} value={form.name} onChange={e => set('name', e.target.value)} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Taluka *" error={errors.taluka}><input className={inputClass} value={form.taluka} onChange={e => set('taluka', e.target.value)} /></Field><Field label="District"><input className={inputClass} value={form.district} onChange={e => set('district', e.target.value)} /></Field></div><Field label="Address"><input className={inputClass} value={form.address} onChange={e => set('address', e.target.value)} /></Field></Section>
    <Section title="Location"><MapPicker lat={form.lat} lng={form.lng} onChange={(lat, lng) => setForm(f => ({ ...f, lat, lng }))} /><div className="grid grid-cols-2 gap-3"><Field label="Latitude" error={errors.location}><input type="number" step="0.0001" className={inputClass} value={form.lat} onChange={e => set('lat', +e.target.value)} /></Field><Field label="Longitude"><input type="number" step="0.0001" className={inputClass} value={form.lng} onChange={e => set('lng', +e.target.value)} /></Field></div></Section>
  </SideSheet>
}

// ---------------- Synthetic data ----------------
function GenerateData() {
  const [branch, setBranch] = useState<Branch | null>(null); const [existing, setExisting] = useState<JLGGroup[]>([])
  const [opts, setOpts] = useState<SyntheticOptions>({ count: 20, radiusKm: 15, highPct: 25, mediumPct: 40, windowFrom: '08:30', windowTo: '16:30', durationMin: 30, durationMax: 45, seed: 2026, replaceExisting: false })
  const [preview, setPreview] = useState<JLGGroup[] | null>(null); const [busy, setBusy] = useState(false); const [result, setResult] = useState('')
  const { user } = useAuth()
  useEffect(() => { getBranches().then(b => setBranch(b.find(x => x.id === user?.branchId) ?? b[0])); getGroups().then(setExisting) }, [user?.branchId])
  const set = <K extends keyof SyntheticOptions>(key: K, value: SyntheticOptions[K]) => { setOpts(o => ({ ...o, [key]: value })); setPreview(null); setResult('') }
  const invalid = opts.count < 1 || opts.count > 500 ? 'Number of groups must be between 1 and 500.' : opts.highPct + opts.mediumPct > 100 ? 'High + medium cannot exceed 100%.' : opts.durationMax < opts.durationMin ? 'Maximum duration must be at least the minimum.' : opts.windowTo <= opts.windowFrom ? 'Latest time must be after earliest time.' : ''
  const [error, setError] = useState('')
  const generate = async () => { setBusy(true); setError(''); try { const r = await generateSyntheticGroups(opts); setPreview(null); setResult(`${r.created} synthetic groups generated${r.removed ? `, ${r.removed} previous synthetic groups replaced` : ''}.`); getGroups().then(setExisting) } catch (e) { setError((e as Error).message) } finally { setBusy(false) } }
  const showPreview = async () => { setBusy(true); setError(''); try { setPreview(await previewSyntheticGroups(opts)) } catch (e) { setError((e as Error).message) } finally { setBusy(false) } }
  const counts = preview && { high: preview.filter(g => g.priority === 'high').length, medium: preview.filter(g => g.priority === 'medium').length, low: preview.filter(g => g.priority === 'low').length }
  return <div className="mx-auto max-w-3xl space-y-6">
    <PageHeader eyebrow="Data management" title="Generate Synthetic Data" description="Create realistic test JLG groups around the branch without touching manual data." />
    <div className="space-y-5 rounded-xl border bg-card p-6">
      <div className="grid gap-4 md:grid-cols-3"><Field label="Number of groups"><input type="number" min={1} max={500} className={inputClass} value={opts.count} onChange={e => set('count', +e.target.value)} /></Field><Field label="Radius from branch (km)"><input type="number" min={1} max={50} className={inputClass} value={opts.radiusKm} onChange={e => set('radiusKm', +e.target.value)} /></Field><Field label="Random seed" hint="Same seed, same data"><input type="number" className={inputClass} value={opts.seed} onChange={e => set('seed', +e.target.value)} /></Field></div>
      <div className="grid gap-4 md:grid-cols-3"><Field label="High priority (%)"><input type="number" min={0} max={100} className={inputClass} value={opts.highPct} onChange={e => set('highPct', +e.target.value)} /></Field><Field label="Medium priority (%)"><input type="number" min={0} max={100} className={inputClass} value={opts.mediumPct} onChange={e => set('mediumPct', +e.target.value)} /></Field><Field label="Low priority (%)"><input disabled className={`${inputClass} opacity-70`} value={Math.max(0, 100 - opts.highPct - opts.mediumPct)} /></Field></div>
      <div className="grid gap-4 md:grid-cols-4"><Field label="Earliest meeting"><input type="time" className={inputClass} value={opts.windowFrom} onChange={e => set('windowFrom', e.target.value)} /></Field><Field label="Latest meeting end"><input type="time" className={inputClass} value={opts.windowTo} onChange={e => set('windowTo', e.target.value)} /></Field><Field label="Min duration (min)"><input type="number" className={inputClass} value={opts.durationMin} onChange={e => set('durationMin', +e.target.value)} /></Field><Field label="Max duration (min)"><input type="number" className={inputClass} value={opts.durationMax} onChange={e => set('durationMax', +e.target.value)} /></Field></div>
      <div className="flex items-center justify-between rounded-md border px-3 py-2.5 text-sm"><div><p className="font-medium">Replace existing synthetic data</p><p className="text-xs text-muted-foreground">{existing.filter(g => g.source === 'synthetic').length} synthetic groups currently exist.</p></div><Toggle label="Replace existing synthetic data" checked={opts.replaceExisting} onChange={v => set('replaceExisting', v)} /></div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">Synthetic records are tagged “synthetic”. Manually entered data is never overwritten.</div>
      {(invalid || error) && <p className="text-sm text-destructive">{invalid || error}</p>}
      {result && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">{result}</div>}
      <div className="flex justify-end gap-2"><button disabled={!!invalid || !branch || busy} onClick={showPreview} className="h-9 rounded-md border px-3 text-sm disabled:opacity-50">Preview</button><button disabled={!!invalid || busy} onClick={generate} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">{busy ? <Spinner /> : <Sparkles size={15} />} Generate</button></div>
      {preview && counts && branch && <div className="overflow-hidden rounded-lg border"><div className="bg-muted px-4 py-3 text-sm"><strong>{preview.length} groups ready</strong><p className="mt-1 text-muted-foreground">High: {counts.high} · Medium: {counts.medium} · Low: {counts.low} · Within {opts.radiusKm} km of {branch.name}</p></div><RouteMap className="h-64 w-full" branch={branch} fitKey={`${opts.seed}-${opts.count}-${opts.radiusKm}`} points={preview.map(g => ({ id: g.id, lat: g.lat, lng: g.lng, color: priorityColor[g.priority], popup: <GroupPopup g={g} /> }))} /></div>}
    </div>
  </div>
}

// ---------------- Shared bits ----------------
function SideSheet({ title, onClose, onSave, saving, error, children }: { title: string; onClose: () => void; onSave: () => void; saving: boolean; error?: string; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[1100] bg-black/30" onClick={onClose}><aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l bg-background p-6 shadow-xl" onClick={e => e.stopPropagation()}><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">{title}</h2><p className="text-sm text-muted-foreground">Fields marked * are required.</p></div><button onClick={onClose} aria-label="Close"><X size={18} /></button></div><div className="mt-6 space-y-6">{children}{error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2 border-t pt-4"><button onClick={onClose} className="h-9 rounded-md border px-3 text-sm">Cancel</button><button disabled={saving} onClick={onSave} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-60">{saving && <Spinner />}Save changes</button></div></div></aside></div>
}
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="space-y-3"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>{children}</section> }
function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) { return <button onClick={onClick} aria-label={label} title={label} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">{children}</button> }
function FilterSelect({ label, value, onChange, options, allLabel }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; allLabel?: string }) {
  return <select aria-label={label} value={value} onChange={e => onChange(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm"><option value="">{allLabel ?? `All ${label.toLowerCase()}`}</option>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
}
