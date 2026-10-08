'use client'

import { useEffect, useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { buttonClass, Field, inputClass, PageHeader, Spinner, Toggle, useToast } from '@/components/ui-kit'
import { getSettings, updateSettings } from '@/lib/api-client'
import type { Settings } from '@/lib/types'

export default function SettingsPage() {
  return <AppShell><SettingsForm /></AppShell>
}

function SettingsForm() {
  const [form, setForm] = useState<Settings | null>(null); const [saved, setSaved] = useState<Settings | null>(null); const [saving, setSaving] = useState(false); const [toast, showToast] = useToast()
  useEffect(() => { getSettings().then((s) => { setForm(s); setSaved(s) }) }, [])
  if (!form) return <p className="p-8 text-center text-sm text-muted-foreground">Loading settings…</p>
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setForm((f) => f && { ...f, [k]: v })
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)
  const error = form.defaultShiftEnd <= form.defaultShiftStart ? 'Shift end must be after shift start.' : !/^https?:\/\/\S+$/.test(form.osrmUrl) ? 'OSRM URL must start with http:// or https://.' : form.solverTimeLimitSec < 1 || form.solverTimeLimitSec > 60 ? 'Solver time limit must be between 1 and 60 seconds.' : ''
  const save = async () => { setSaving(true); try { const s = await updateSettings(form); setSaved(s); setForm(s); showToast('Settings saved.') } catch (e) { showToast((e as Error).message) } finally { setSaving(false) } }
  return <div className="mx-auto max-w-3xl space-y-6">
    <PageHeader eyebrow="Admin" title="Settings" description="Defaults used when adding officers and when optimizing routes." />
    <Card title="Working defaults" description="Pre-filled when you add a new officer or group.">
      <div className="grid gap-4 sm:grid-cols-3"><Field label="Shift start"><input type="time" className={inputClass} value={form.defaultShiftStart} onChange={(e) => set('defaultShiftStart', e.target.value)} /></Field><Field label="Shift end"><input type="time" className={inputClass} value={form.defaultShiftEnd} onChange={(e) => set('defaultShiftEnd', e.target.value)} /></Field><Field label="Default meeting (min)"><input type="number" className={inputClass} value={form.defaultMeetingDurationMin} onChange={(e) => set('defaultMeetingDurationMin', +e.target.value)} /></Field><Field label="Break start"><input type="time" className={inputClass} value={form.defaultBreakStart} onChange={(e) => set('defaultBreakStart', e.target.value)} /></Field><Field label="Break (min)"><input type="number" className={inputClass} value={form.defaultBreakDurationMin} onChange={(e) => set('defaultBreakDurationMin', +e.target.value)} /></Field></div>
    </Card>
    <Card title="Travel" description="Road travel times come from OSRM (OpenStreetMap routing).">
      <Field label="OSRM server URL" hint="Defaults to the public OSRM server. Point it at a self-hosted server any time."><input className={inputClass} value={form.osrmUrl} onChange={(e) => set('osrmUrl', e.target.value)} /></Field>
      <Field label={`Two-wheeler speed factor: ${form.speedFactor.toFixed(2)}×`} hint="Multiplies car travel times from OSRM. Below 1 means faster than a car, above 1 slower."><input type="range" min={0.5} max={1.5} step={0.05} value={form.speedFactor} onChange={(e) => set('speedFactor', +e.target.value)} className="w-full accent-primary" /><div className="flex justify-between text-[10px] font-normal"><span>0.5× faster</span><span>1.0× same as car</span><span>1.5× slower</span></div></Field>
      <Field label="Buffer between meetings (min)" hint="Extra time added after each meeting for parking, greetings and paperwork."><input type="number" min={0} max={30} className={`${inputClass} sm:w-40`} value={form.bufferMin} onChange={(e) => set('bufferMin', +e.target.value)} /></Field>
    </Card>
    <Card title="Optimization" description="How the solver trades off skipping meetings against travel.">
      <div><p className="text-xs font-medium text-muted-foreground">Penalty for skipping a meeting</p><div className="mt-1 grid gap-3 sm:grid-cols-3"><Field label="High priority"><input type="number" className={inputClass} value={form.penaltyHigh} onChange={(e) => set('penaltyHigh', +e.target.value)} /></Field><Field label="Medium priority"><input type="number" className={inputClass} value={form.penaltyMedium} onChange={(e) => set('penaltyMedium', +e.target.value)} /></Field><Field label="Low priority"><input type="number" className={inputClass} value={form.penaltyLow} onChange={(e) => set('penaltyLow', +e.target.value)} /></Field></div><p className="mt-1 text-xs text-muted-foreground">Higher numbers make the optimizer try harder to include that priority.</p></div>
      <Field label="Solver time limit (seconds)"><input type="number" min={1} max={60} className={`${inputClass} sm:w-40`} value={form.solverTimeLimitSec} onChange={(e) => set('solverTimeLimitSec', +e.target.value)} /></Field>
      <Row label="Allow late arrival" hint="Let meetings start up to 15 minutes after their window when it helps fit more meetings."><Toggle label="Allow late arrival" checked={form.allowLateArrival} onChange={(v) => set('allowLateArrival', v)} /></Row>
      <Row label="Balance workload" hint="Spread meetings evenly across officers instead of minimizing total travel only."><Toggle label="Balance workload" checked={form.balanceWorkload} onChange={(v) => set('balanceWorkload', v)} /></Row>
    </Card>
    {error && <p className="text-sm text-destructive">{error}</p>}
    <div className="sticky bottom-4 flex justify-end gap-2"><button disabled={!dirty || saving} onClick={() => saved && setForm(saved)} className={buttonClass.outline}>Discard</button><button disabled={!dirty || !!error || saving} onClick={save} className={buttonClass.primary}>{saving && <Spinner />}Save settings</button></div>
    {toast}
  </div>
}

function Card({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="space-y-4 rounded-xl border bg-card p-6"><div><h2 className="text-sm font-semibold">{title}</h2><p className="text-xs text-muted-foreground">{description}</p></div>{children}</section>
}
function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2.5"><div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{hint}</p></div>{children}</div>
}
