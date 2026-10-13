'use client'
import { AuthProvider } from '@/lib/auth'
import { LanguageProvider } from '@/lib/i18n'
import type { Lang } from '@/lib/i18n/config'
export default function Providers({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LanguageProvider initial={lang}><AuthProvider>{children}</AuthProvider></LanguageProvider>
}
