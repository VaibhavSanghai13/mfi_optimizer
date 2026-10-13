'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { DaySheet } from '@/components/day-sheet'
import { getPlan } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import type { Plan } from '@/lib/types'

export default function OfficerDaySheetPage() {
  const { id, officerId } = useParams<{ id: string; officerId: string }>()
  const t = useT()
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined)
  useEffect(() => { getPlan(id).then((p) => setPlan(p ?? null)).catch(() => setPlan(null)) }, [id])
  return <AppShell><div className="space-y-4">
    <Link href={`/plans/${id}`} className="text-sm text-muted-foreground hover:text-foreground print:hidden">← {t('Back to plan')}</Link>
    {plan === undefined && <p className="p-8 text-center text-sm text-muted-foreground">{t('Loading')}…</p>}
    {plan === null && <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">{t('Plan not found')}.</p>}
    {plan && <DaySheet plan={plan} officerId={officerId} />}
  </div></AppShell>
}
