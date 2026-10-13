'use client'

import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '@/lib/i18n'
import { languages } from '@/lib/i18n/config'

/**
 * Language picker, placed beside the dark/light button on every page.
 * `className` lets the landing page's dark hero override the default chrome.
 */
export function LanguageToggle({ className = 'rounded-md border px-2.5 py-1.5 text-xs' }: { className?: string }) {
  const { lang, setLang, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const current = languages.find((l) => l.code === lang) ?? languages[0]

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape) }
  }, [open])

  return (
    <div ref={root} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label={t('Change language')} className={className}>
        <span aria-hidden>⌘</span> {current.short}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-[1000] mt-1 w-32 rounded-md border bg-popover p-1 text-foreground shadow-lg">
          {languages.map((option) => (
            <button
              key={option.code}
              role="menuitemradio"
              aria-checked={option.code === lang}
              onClick={() => { setLang(option.code); setOpen(false) }}
              className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-xs hover:bg-muted ${option.code === lang ? 'font-medium' : ''}`}
            >
              {option.label}
              {option.code === lang && <span aria-hidden>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
