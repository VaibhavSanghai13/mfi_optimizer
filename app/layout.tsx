import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import './globals.css'
import { isLang, LANG_COOKIE } from '@/lib/i18n/config'
import Providers from './providers'

export const metadata: Metadata = {
  title: 'MFI Route Optimizer',
  description: 'Plan field officer routes for JLG meetings in rural Maharashtra.',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Read on the server so the first paint is already in the chosen language.
  const saved = (await cookies()).get(LANG_COOKIE)?.value
  const lang = isLang(saved) ? saved : 'en'
  return (
    <html lang={lang}>
      <body className="antialiased">
        <Providers lang={lang}>{children}</Providers>
        <Analytics />
      </body>
    </html>
  )
}
