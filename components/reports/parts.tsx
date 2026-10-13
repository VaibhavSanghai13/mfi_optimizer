'use client'

import { buttonClass } from '@/components/ui-kit'
import { useT } from '@/lib/i18n'

/** Pieces shared by the three report tabs. */

export function Panel({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 md:p-5">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
      </header>
      {children}
    </section>
  )
}

/** Label and note are English source strings; the card translates them. */
export function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  const t = useT()
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{t(label)}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</p>
      {note && <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{t(note)}</p>}
    </div>
  )
}

/**
 * The branch is fixed by the session (a manager administers one branch), so it is
 * shown rather than offered as a choice. "Print / PDF" opens the browser's print
 * dialog, where the report can be saved as a PDF.
 */
export function ReportActions({ branchName, onExportCsv, children }: { branchName?: string; onExportCsv: () => void; children?: React.ReactNode }) {
  const t = useT()
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      {children}
      {branchName && (
        <span className="mr-1 text-xs text-muted-foreground">
          {t('Branch')} · <span className="font-medium text-foreground">{branchName}</span>
        </span>
      )}
      <button onClick={onExportCsv} className={buttonClass.outline}>{t('Export CSV')}</button>
      <button onClick={() => window.print()} className={buttonClass.primary}>{t('Print / PDF')}</button>
    </div>
  )
}

export function EmptyReport({ message }: { message: string }) {
  return (
    <div className="rounded-xl border bg-card p-12 text-center">
      <p className="text-sm font-medium">{message}</p>
    </div>
  )
}
