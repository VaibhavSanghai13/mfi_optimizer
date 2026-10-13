'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LANG_COOKIE, type Lang } from './config'
import { hi } from './hi'
import { mr } from './mr'

/**
 * Translation for the three languages a Baramati branch actually uses.
 *
 * Keys are the English source strings, so an untranslated string renders as
 * English instead of a missing-key placeholder, and adding a page needs no key
 * bookkeeping. `{name}` placeholders are interpolated from the second argument.
 *
 * The choice lives in a cookie (not localStorage) so the server renders the
 * right language on the first paint — the app would otherwise flash English.
 */

export { languages, LANG_COOKIE, isLang, type Lang } from './config'

const dictionaries: Record<Lang, Record<string, string>> = { en: {}, hi, mr }

export type Translate = (text: string, vars?: Record<string, string | number>) => string

type LanguageContextValue = { lang: Lang; setLang: (lang: Lang) => void; t: Translate }
const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ initial, children }: { initial: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial)

  // `<html lang>` is rendered from the cookie; keep it in step after a switch so
  // screen readers and the browser's own translation prompt stay correct.
  useEffect(() => { document.documentElement.lang = lang }, [lang])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    // A year, site-wide, and Lax so it is sent on normal navigations.
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
  }, [])

  const t = useCallback<Translate>(
    (text, vars) => {
      const translated = dictionaries[lang][text] ?? text
      if (!vars) return translated
      return translated.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match))
    },
    [lang],
  )

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider')
  return context
}

/** `const t = useT()` — the common case, where only the translate function is needed. */
export const useT = () => useLanguage().t
