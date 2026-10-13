'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LanguageToggle } from '@/components/language-toggle'
import { ThemeToggle } from '@/components/theme-toggle'
import { useAuth } from '@/lib/auth'
import { fmtDate, todayIso } from '@/lib/format'
import { useT, type Translate } from '@/lib/i18n'
import type { UserRole } from '@/lib/types'

type NavItem = { label: string; href: string; icon: string }
const primary: NavItem[] = [{ label: 'Planner', href: '/planner', icon: '▦' }, { label: 'Plans', href: '/plans', icon: '↗' }, { label: 'Reports', href: '/reports', icon: '◫' }]
const data: NavItem[] = [{ label: 'JLG Groups', href: '/jlg-groups', icon: '•' }, { label: 'Officers', href: '/officers', icon: '•' }, { label: 'Branches', href: '/branches', icon: '•' }, { label: 'Generate Synthetic Data', href: '/generate-data', icon: '•' }]
const admin: NavItem[] = [{ label: 'Users', href: '/users', icon: '○' }, { label: 'Settings', href: '/settings', icon: '⚙' }]
const field: NavItem[] = [{ label: 'My Day', href: '/my-day', icon: '◷' }]
const titles: Record<string, string> = { '/planner': 'Planner', '/plans': 'Plans', '/reports': 'Reports', '/jlg-groups': 'JLG Groups', '/officers': 'Officers', '/branches': 'Branches', '/generate-data': 'Generate Synthetic Data', '/users': 'Users', '/settings': 'Settings', '/my-day': 'My Day' }

/** Authenticated layout. `allow` lists the roles that may open the page; others are sent to their home page. */
export function AppShell({ children, allow = ['manager'] }: { children: React.ReactNode; allow?: UserRole[] }) {
  const { user, branchName, ready, logout } = useAuth()
  const pathname = usePathname()
  const t = useT()
  const [collapsed, setCollapsed] = useState(false); const [menu, setMenu] = useState(false); const [mobileNav, setMobileNav] = useState(false)
  const permitted = !!user && allow.includes(user.role)
  useEffect(() => {
    if (!ready) return
    if (!user) window.location.replace('/login')
    else if (!allow.includes(user.role)) window.location.replace(user.role === 'field_officer' ? '/my-day' : '/planner')
  }, [ready, user, allow.join()]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!ready || !user || !permitted) return null
  const isField = user.role === 'field_officer'
  const pageName = titles[pathname] ?? (pathname.startsWith('/plans/') ? (pathname.includes('/officer/') ? 'Day sheet' : 'Plan detail') : 'Workspace')
  const navContent = (isCollapsed: boolean) => <nav className="flex-1 space-y-6 p-3">{isField ? <NavGroup items={field} collapsed={isCollapsed} pathname={pathname} t={t} /> : <><NavGroup items={primary} collapsed={isCollapsed} pathname={pathname} t={t} /><NavGroup title="Data" items={data} collapsed={isCollapsed} pathname={pathname} t={t} /><NavGroup title="Admin" items={admin} collapsed={isCollapsed} pathname={pathname} t={t} /></>}</nav>
  return <div className="flex min-h-screen bg-muted/30"><aside className={`${collapsed ? 'w-[68px]' : 'w-60'} hidden shrink-0 border-r bg-card transition-all md:flex md:flex-col`}><div className="flex h-16 items-center gap-3 border-b px-4"><div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">MFI</div>{!collapsed && <span className="text-sm font-semibold tracking-tight">{t('Route Optimizer')}</span>}</div>{navContent(collapsed)}<button onClick={() => setCollapsed(!collapsed)} className="m-3 rounded-md border py-2 text-xs text-muted-foreground hover:bg-muted">{collapsed ? '→' : `← ${t('Collapse')}`}</button></aside>
    {mobileNav && <div className="fixed inset-0 z-[1100] bg-black/30 md:hidden" onClick={() => setMobileNav(false)}><aside className="flex h-full w-64 flex-col border-r bg-card" onClick={e => e.stopPropagation()}><div className="flex h-16 items-center justify-between gap-3 border-b px-4"><div className="flex items-center gap-3"><div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">MFI</div><span className="text-sm font-semibold tracking-tight">{t('Route Optimizer')}</span></div><button onClick={() => setMobileNav(false)} className="text-sm text-muted-foreground" aria-label={t('Close menu')}>✕</button></div><div onClick={() => setMobileNav(false)}>{navContent(false)}</div></aside></div>}
    <div className="flex min-w-0 flex-1 flex-col"><header className="flex h-16 items-center justify-between border-b bg-card px-4 md:px-6"><div className="flex items-center gap-3"><button onClick={() => setMobileNav(true)} className="rounded-md border px-2 py-1 text-sm md:hidden" aria-label={t('Open menu')}>☰</button><div><p className="text-sm font-semibold">{t(pageName)}</p><p className="hidden text-xs text-muted-foreground sm:block">{branchName} · {fmtDate(todayIso())}</p></div></div><div className="flex items-center gap-2"><ThemeToggle /><LanguageToggle /><div className="relative"><button onClick={() => setMenu(!menu)} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-left"><span className="hidden text-xs sm:block"><span className="block font-medium">{user.name}</span><span className="block capitalize text-muted-foreground">{t(user.role.replace('_', ' '))}</span></span><span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">{user.name.split(' ').map(n => n[0]).join('')}</span></button>{menu && <div className="absolute right-0 top-11 z-[1000] w-40 rounded-md border bg-popover p-1 shadow-lg"><button onClick={logout} className="w-full rounded px-3 py-2 text-left text-xs hover:bg-muted">{t('Log out')}</button></div>}</div></div></header><main className="flex-1 p-4 md:p-6">{children}</main></div></div>
}
function NavGroup({ title, items, collapsed, pathname, t }: { title?: string; items: NavItem[]; collapsed: boolean; pathname: string; t: Translate }) {
  if (!items.length) return null
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  return <div>{title && !collapsed && <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t(title)}</p>}<div className="space-y-0.5">{items.map(item => <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-md px-2.5 py-2 text-sm hover:bg-muted hover:text-foreground ${isActive(item.href) ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground'}`}><span className="w-4 text-center text-xs">{item.icon}</span>{!collapsed && t(item.label)}</Link>)}</div></div>
}
