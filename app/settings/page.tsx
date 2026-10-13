'use client'

import { useEffect, useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { buttonClass, Field, inputClass, PageHeader, Spinner, Toggle, useToast } from '@/components/ui-kit'
import { getSettings, updateSettings } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import type { Settings } from '@/lib/types'

export default function SettingsPage() {
  return <AppShell><SettingsForm /></AppShell>
}

function SettingsForm() {
  const t = useT()
  const [form, setForm] = useState<Settings | null>(null); const [saved, setSaved] = useState<Settings | null>(null); const [saving, setSaving] = useState(false); const [toast, showToast] = useToast()
  useEffect(() => { getSettings().then((s) => { setForm(s); setSaved(s) }) }, [])
  if (!form) return <p className="p-8 text-center text-sm text-muted-foreground">{t('Loading settings')}…</p>
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setForm((f) => f && { ...f, [k]: v })
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)
  const error = form.defaultShiftEnd <= form.defaultShiftStart ? 'Shift end must be after shift start.' : !/^https?:\/\/\S+$/.test(form.osrmUrl) ? 'OSRM URL must start with http:// or https://.' : form.solverTimeLimitSec < 1 || form.solverTimeLimitSec > 60 ? 'Solver time limit must be between 1 and 60 seconds.' : form.travelAllowancePerKm < 0 || form.travelAllowancePerKm > 100 ? 'Travel allowance must be between ₹0 and ₹100 per km.' : ''
  const save = async () => { setSaving(true); try { const s = await updateSettings(form); setSaved(s); setForm(s); showToast(t('Settings saved.')) } catch (e) { showToast((e as Error).message) } finally { setSaving(false) } }
  return <div className="mx-auto max-w-3xl space-y-6">
    <PageHeader eyebrow={t('Admin')} title={t('Settings')} description={t('Defaults used when adding officers and when optimizing routes.')} />
    <Card title={t('Working defaults')} description={t('Pre-filled when you add a new officer or group.')}>
      <div className="grid gap-4 sm:grid-cols-3"><Field label={t('Shift start')}><input type="time" className={inputClass} value={form.defaultShiftStart} onChange={(e) => set('defaultShiftStart', e.target.value)} /></Field><Field label={t('Shift end')}><input type="time" className={inputClass} value={form.defaultShiftEnd} onChange={(e) => set('defaultShiftEnd', e.target.value)} /></Field><Field label={t('Default meeting (min)')}><input type="number" className={inputClass} value={form.defaultMeetingDurationMin} onChange={(e) => set('defaultMeetingDurationMin', +e.target.value)} /></Field><Field label={t('Break start')}><input type="time" className={inputClass} value={form.defaultBreakStart} onChange={(e) => set('defaultBreakStart', e.target.value)} /></Field><Field label={t('Break (min)')}><input type="number" className={inputClass} value={form.defaultBreakDurationMin} onChange={(e) => set('defaultBreakDurationMin', +e.target.value)} /></Field></div>
    </Card>
    <Card title={t('Travel')} description={t('Road travel times come from OSRM (OpenStreetMap routing).')}>
      <Field label={t('OSRM server URL')} hint={t('Defaults to the public OSRM server. Point it at a self-hosted server any time.')}><input className={inputClass} value={form.osrmUrl} onChange={(e) => set('osrmUrl', e.target.value)} /></Field>
      <Field label={t('Two-wheeler speed factor: {factor}×', { factor: form.speedFactor.toFixed(2) })} hint={t('Multiplies car travel times from OSRM. Below 1 means faster than a car, above 1 slower.')}><input type="range" min={0.5} max={1.5} step={0.05} value={form.speedFactor} onChange={(e) => set('speedFactor', +e.target.value)} className="w-full accent-primary" /><div className="flex justify-between text-[10px] font-normal"><span>{t('0.5× faster')}</span><span>{t('1.0× same as car')}</span><span>{t('1.5× slower')}</span></div></Field>
      <Field label={t('Buffer between meetings (min)')} hint={t('Extra time added after each meeting for parking, greetings and paperwork.')}><input type="number" min={0} max={30} className={`${inputClass} sm:w-40`} value={form.bufferMin} onChange={(e) => set('bufferMin', +e.target.value)} /></Field>
      <Field label={t('Travel allowance (₹ per km)')} hint={t('Applied to planned road kilometres in the Reports travel-allowance statements.')}><input type="number" min={0} max={100} step={0.5} className={`${inputClass} sm:w-40`} value={form.travelAllowancePerKm} onChange={(e) => set('travelAllowancePerKm', +e.target.value)} /></Field>
    </Card>
    <Card title={t('Optimization')} description={t('How the solver trades off skipping meetings against travel.')}>
      <div><p className="text-xs font-medium text-muted-foreground">{t('Penalty for skipping a meeting')}</p><div className="mt-1 grid gap-3 sm:grid-cols-3"><Field label={t('High priority')}><input type="number" className={inputClass} value={form.penaltyHigh} onChange={(e) => set('penaltyHigh', +e.target.value)} /></Field><Field label={t('Medium priority')}><input type="number" className={inputClass} value={form.penaltyMedium} onChange={(e) => set('penaltyMedium', +e.target.value)} /></Field><Field label={t('Low priority')}><input type="number" className={inputClass} value={form.penaltyLow} onChange={(e) => set('penaltyLow', +e.target.value)} /></Field></div><p className="mt-1 text-xs text-muted-foreground">{t('Higher numbers make the optimizer try harder to include that priority.')}</p></div>
      <Field label={t('Solver time limit (seconds)')}><input type="number" min={1} max={60} className={`${inputClass} sm:w-40`} value={form.solverTimeLimitSec} onChange={(e) => set('solverTimeLimitSec', +e.target.value)} /></Field>
      <Row label={t('Allow late arrival')} hint={t('Let meetings start up to 15 minutes after their window when it helps fit more meetings.')}><Toggle label={t('Allow late arrival')} checked={form.allowLateArrival} onChange={(v) => set('allowLateArrival', v)} /></Row>
      <Row label={t('Balance workload')} hint={t('Spread meetings evenly across officers instead of minimizing total travel only.')}><Toggle label={t('Balance workload')} checked={form.balanceWorkload} onChange={(v) => set('balanceWorkload', v)} /></Row>
    </Card>
    {error && <p className="text-sm text-destructive">{t(error)}</p>}
    <div className="sticky bottom-4 flex justify-end gap-2"><button disabled={!dirty || saving} onClick={() => saved && setForm(saved)} className={buttonClass.outline}>{t('Discard')}</button><button disabled={!dirty || !!error || saving} onClick={save} className={buttonClass.primary}>{saving && <Spinner />}{t('Save settings')}</button></div>
    {toast}
  </div>
}

function Card({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="space-y-4 rounded-xl border bg-card p-6"><div><h2 className="text-sm font-semibold">{title}</h2><p className="text-xs text-muted-foreground">{description}</p></div>{children}</section>
}
function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2.5"><div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{hint}</p></div>{children}</div>
}
