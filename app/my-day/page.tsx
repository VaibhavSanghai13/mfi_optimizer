'use client'

import { useEffect, useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { DaySheet } from '@/components/day-sheet'
import { getMyLatestPlan } from '@/lib/api-client'
import { useAuth } from '@/lib/auth'
import type { Plan } from '@/lib/types'

export default function MyDayPage() {
  return <AppShell allow={['field_officer']}><MyDay /></AppShell>
}

function MyDay() {
  const { user } = useAuth()
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined)
  useEffect(() => { if (user?.officerId) getMyLatestPlan(user.officerId).then((p) => setPlan(p ?? null)) }, [user?.officerId])
  if (!user?.officerId) return <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Your account is not linked to an officer. Ask your manager to link it.</p>
  if (plan === undefined) return <p className="p-8 text-center text-sm text-muted-foreground">Loading your route…</p>
  if (plan === null) return <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center"><p className="font-medium">No route planned yet</p><p className="mt-1 text-sm text-muted-foreground">Your manager hasn’t saved a plan with meetings for you. Check back later.</p></div>
  return <DaySheet plan={plan} officerId={user.officerId} />
}
