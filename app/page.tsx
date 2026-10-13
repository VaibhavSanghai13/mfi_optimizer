'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { LanguageToggle } from '@/components/language-toggle'
import { RouteGraphic } from '@/components/landing/route-graphic'
import { CsvThumb, MapThumb, NotScheduledThumb, TimelineThumb } from '@/components/landing/thumbnails'
import { ThemeToggle } from '@/components/theme-toggle'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'

/**
 * Public landing page. The signed-in app lives at /planner; this page is the
 * only route a visitor can reach without a session, so it carries the sign-in form.
 *
 * TODO: fill in before launch — the design left these as placeholders.
 */
const contact = { email: '', ctaLabel: 'Talk to us' }

/** Headline figures, from a real planner run on the demo branch. Update when the demo data is regenerated. */
const heroRun = { meetings: '8 / 8', distance: '231.1 km', solved: '10.0 s', date: '06 Oct 2026' }

const sections = [
  { id: 'what-changes', label: 'What changes' },
  { id: 'inside-a-plan', label: 'Inside a plan' },
  { id: 'in-the-field', label: 'In the field' },
]

export default function LandingPage() {
  const t = useT()
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Hero />
      <WhatChanges />
      <InsideAPlan />
      <InTheField />
      <CallToAction />
      <footer className="border-t px-6 py-6 md:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{t('MFI Route Optimizer')} · {t('Map data © OpenStreetMap contributors')}</p>
          <p>{contact.email && <><a href={`mailto:${contact.email}`} className="hover:text-foreground">{contact.email}</a> · </>}{t('Privacy')}</p>
        </div>
      </footer>
    </div>
  )
}

function Header() {
  const t = useT()
  const { user } = useAuth()
  return (
    <header className="bg-neutral-950 text-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6 md:px-10">
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white text-[10px] font-bold text-neutral-950">MFI</div>
          <span className="text-sm font-semibold tracking-tight">{t('Route Optimizer')}</span>
        </div>
        <nav className="hidden items-center gap-7 text-sm text-white/70 md:flex">
          {sections.map((section) => (
            <a key={section.id} href={`#${section.id}`} className="transition-colors hover:text-white">{t(section.label)}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle className="rounded-md border border-white/20 px-2.5 py-1.5 text-xs text-white hover:bg-white/10" />
          <LanguageToggle className="rounded-md border border-white/20 px-2.5 py-1.5 text-xs text-white hover:bg-white/10" />
          <Link href={user ? '/planner' : '#sign-in'} className="rounded-md bg-white px-4 py-1.5 text-sm font-medium text-neutral-950 transition-opacity hover:opacity-90">
            {user ? t('Open workspace') : t('Sign in')}
          </Link>
        </div>
      </div>
    </header>
  )
}

function Hero() {
  const t = useT()
  const stats = [
    { label: 'Meetings planned', value: heroRun.meetings },
    { label: 'Total distance', value: heroRun.distance },
    { label: 'Solved in', value: heroRun.solved },
  ]
  return (
    <section className="relative overflow-hidden bg-neutral-950 text-white">
      <RouteGraphic />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-16 md:px-10 md:py-24 lg:grid-cols-[1fr_380px]">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/50">{t('Joint liability group visits · Route planning')}</p>
          <h1 className="mt-6 text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl">
            {t('Who goes where,')}<br />{t('in what order,')}<br />{t('at what time.')}
          </h1>
          <p className="mt-6 max-w-lg text-sm leading-relaxed text-white/70">
            {t('The planner answers all three for every officer at a branch — inside each group’s meeting window, the shift and lunch — and keeps road kilometres as low as it can.')}
          </p>
          <dl className="mt-10 flex flex-wrap gap-3">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-lg border border-white/15 bg-white/5 px-4 py-3">
                <dt className="text-[10px] uppercase tracking-wider text-white/50">{t(stat.label)}</dt>
                <dd className="mt-1 font-mono text-lg font-semibold">{stat.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-xs text-white/40">{t('Figures from a real planner run on the demo branch, {date}.', { date: heroRun.date })}</p>
        </div>
        <SignInCard />
      </div>
    </section>
  )
}

function SignInCard() {
  const t = useT()
  const { user, login } = useAuth()
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
    window.location.href = result.user.role === 'field_officer' ? '/my-day' : '/planner'
  }

  if (user) {
    return (
      <aside id="sign-in" className="h-fit rounded-xl bg-white p-7 text-neutral-950 shadow-xl">
        <h2 className="text-lg font-semibold tracking-tight">{t('You are signed in')}</h2>
        <p className="mt-1 text-sm text-neutral-500">{t('Continue as {name}.', { name: user.name })}</p>
        <Link href={user.role === 'field_officer' ? '/my-day' : '/planner'} className="mt-5 flex h-10 w-full items-center justify-center rounded-md bg-neutral-900 text-sm font-medium text-white transition-opacity hover:opacity-90">
          {t('Open workspace')}
        </Link>
      </aside>
    )
  }

  return (
    <aside id="sign-in" className="h-fit rounded-xl bg-white p-7 text-neutral-950 shadow-xl">
      <h2 className="text-lg font-semibold tracking-tight">{t('Sign in')}</h2>
      <p className="mt-1 text-sm text-neutral-500">{t('Accounts are issued by your branch manager.')}</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          {t('Email')}
          <input value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} type="email" autoComplete="username" placeholder="name@yourmfi.org" required
            className="mt-1.5 h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-900" />
        </label>
        <label className="block text-sm font-medium">
          {t('Password')}
          <input value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} type="password" autoComplete="current-password" required
            className="mt-1.5 h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-neutral-900" />
        </label>
        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="h-10 w-full rounded-md bg-neutral-900 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60">
          {busy ? t('Signing in…') : t('Sign in')}
        </button>
      </form>
      <p className="mt-4 text-xs text-neutral-500">{t('Forgot your password? Ask your manager to reset it.')}</p>
    </aside>
  )
}

function WhatChanges() {
  const t = useT()
  const byHand = [
    'Villages split between officers from memory',
    'Meeting windows and lunch checked in your head',
    'No record of which groups were left out, or why',
    'Kilometres claimed after the fact',
  ]
  const withApp = [
    'Groups assigned and ordered in about 10 seconds',
    'Every window, shift, lunch and 5-meeting cap checked',
    'Unscheduled groups listed with a reason',
    'Planned km and travel time saved per officer, per stop',
  ]
  return (
    <section id="what-changes" className="border-t bg-muted/30 px-6 py-16 md:px-10 md:py-20">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow="What changes" title="The same branch day, two ways." />
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <div className="rounded-xl border bg-card p-6">
            <p className="text-sm font-medium text-muted-foreground">{t('Assigned by hand')}</p>
            <ul className="mt-5 space-y-3.5">
              {byHand.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-muted-foreground">
                  <span aria-hidden className="text-muted-foreground/60">—</span>{t(item)}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border-2 border-foreground bg-card p-6">
            <p className="text-sm font-medium">{t('With Route Optimizer')}</p>
            <ul className="mt-5 space-y-3.5">
              {withApp.map((item) => (
                <li key={item} className="flex gap-3 text-sm">
                  <span aria-hidden className="text-emerald-600">✓</span>{t(item)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

function InsideAPlan() {
  const t = useT()
  const views = [
    { thumb: <MapThumb />, title: 'Route map', body: 'Colour per officer on real roads; toggle each route.' },
    { thumb: <TimelineThumb />, title: 'Shift timeline', body: 'Meetings, travel, waiting and lunch against each shift.' },
    { thumb: <NotScheduledThumb />, title: 'Not-scheduled list', body: 'Every group left out, with the reason — nothing silently dropped.' },
    { thumb: <CsvThumb />, title: 'CSV export & print', body: 'One row per stop: arrival, wait, meeting, travel, km.' },
  ]
  return (
    <section id="inside-a-plan" className="border-t bg-muted/30 px-6 py-16 md:px-10 md:py-20">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow="Inside a saved plan" title="One plan, four views — all from the same stop records." />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {views.map((view) => (
            <article key={view.title} className="overflow-hidden rounded-xl border bg-card">
              <div className="h-28 border-b bg-muted/40 p-3">{view.thumb}</div>
              <div className="p-4">
                <h3 className="text-sm font-semibold">{t(view.title)}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{t(view.body)}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function InTheField() {
  const t = useT()
  const points = [
    { title: 'Runs in the phone browser', body: 'Officers open My Day from a link — nothing to install. Large Navigate and Mark visited buttons for use on the move.' },
    { title: 'Pin a group to an officer', body: 'Where a relationship matters, pin the group. The planner treats it as a hard rule and routes everyone else around it.' },
    { title: 'Access follows the org chart', body: 'Managers create every login and link it to an officer record. Officers only ever see their own day.' },
  ]
  return (
    <section id="in-the-field" className="border-t bg-background px-6 py-16 md:px-10 md:py-20">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-3">
        {points.map((point, index) => (
          <div key={point.title}>
            <span className="inline-flex size-7 items-center justify-center rounded-md border font-mono text-[11px] text-muted-foreground">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className="mt-4 text-sm font-semibold">{t(point.title)}</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t(point.body)}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function CallToAction() {
  const t = useT()
  return (
    <section className="border-t bg-muted/30 px-6 py-14 md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-6 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{t('Bring your branch on.')}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{t('Talk to us about setting up your branches, officers and groups.')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
              {t(contact.ctaLabel)}
            </a>
          )}
          <a href="#sign-in" className="inline-flex h-10 items-center rounded-md border bg-background px-5 text-sm font-medium hover:bg-muted">{t('Sign in')}</a>
        </div>
      </div>
    </section>
  )
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  const t = useT()
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{t(eyebrow)}</p>
      <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight">{t(title)}</h2>
    </div>
  )
}
