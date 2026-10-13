/**
 * Language constants shared by the server (root layout, reading the cookie) and
 * the client provider. Kept out of index.tsx because that file is `'use client'`
 * and a server component cannot call functions from a client module.
 */

export const languages = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'hi', label: 'हिंदी', short: 'हिं' },
  { code: 'mr', label: 'मराठी', short: 'मरा' },
] as const

export type Lang = (typeof languages)[number]['code']

export const LANG_COOKIE = 'mfi-lang'
export const isLang = (value: unknown): value is Lang => languages.some((l) => l.code === value)
