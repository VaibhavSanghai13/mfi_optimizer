'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useT } from '@/lib/i18n'

/**
 * Dark/light switch, shared by the app shell and the public pages.
 *
 * The saved choice lives in localStorage, which the server cannot read, so it is
 * subscribed to as an external store: React hydrates with the server snapshot and
 * swaps in the real value afterwards instead of reporting a markup mismatch.
 */

const STORAGE_KEY = 'mfi-theme'
type Theme = 'dark' | 'light'

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  // `storage` fires when another tab switches theme.
  window.addEventListener('storage', onChange)
  return () => { listeners.delete(onChange); window.removeEventListener('storage', onChange) }
}

function getSnapshot(): Theme {
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (saved === 'dark' || saved === 'light') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Before hydration there is no device preference to read; the real value arrives on the next render. */
const getServerSnapshot = (): Theme => 'light'

export function setTheme(theme: Theme) {
  window.localStorage.setItem(STORAGE_KEY, theme)
  notify()
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  // Set both classes so the CSS variables and Tailwind's `dark:` variants always agree.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.classList.toggle('light', theme !== 'dark')
  }, [theme])
  return { dark: theme === 'dark', toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark') }
}

export function ThemeToggle({ className = 'rounded-md border px-2.5 py-1.5 text-xs' }: { className?: string }) {
  const { dark, toggle } = useTheme()
  const t = useT()
  return (
    <button type="button" onClick={toggle} className={className} aria-label={t('Toggle theme')}>
      {dark ? t('Light') : t('Dark')}
    </button>
  )
}
