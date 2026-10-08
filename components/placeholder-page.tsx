import { PageHeader } from '@/components/ui-kit'

/** Temporary page body until the real page is ported in a later slice. */
export function PlaceholderPage({ eyebrow, title, slice, children }: { eyebrow: string; title: string; slice: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader eyebrow={eyebrow} title={title} description={`This page is built in slice ${slice}.`} />
      {children}
      <div className="rounded-xl border bg-card p-10 text-center">
        <p className="text-sm font-medium">Workspace coming soon</p>
      </div>
    </div>
  )
}
