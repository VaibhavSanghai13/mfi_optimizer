import { notFound } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { DataWorkspace } from '@/components/data-workspace'

/** The Data section pages share one route, as in the reference. */
const kinds = {
  'jlg-groups': 'groups',
  officers: 'officers',
  branches: 'branches',
  'generate-data': 'generate',
} as const

export default async function DataPage({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params
  const kind = kinds[page as keyof typeof kinds]
  if (!kind) notFound()
  return (
    <AppShell>
      <DataWorkspace kind={kind} />
    </AppShell>
  )
}
