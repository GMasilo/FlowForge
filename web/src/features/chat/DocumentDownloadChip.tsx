import { useState } from 'react'
import { Download, ExternalLink, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import type { FilledDocument } from '@/features/templates/documentFill'
import { documentFileBlob, generateDocumentFile } from '@/features/templates/documentGenerate'
import { downloadBlob } from '@/shared/lib/downloadJson'
import { cn } from '@/shared/lib/utils'

function FormatIcon({ format }: { format: FilledDocument['format'] }) {
  if (format === 'xlsx') return <FileSpreadsheet className="h-4 w-4 shrink-0 text-[var(--color-accent)]" />
  return <FileText className="h-4 w-4 shrink-0 text-[var(--color-accent)]" />
}

async function buildDocument(doc: FilledDocument) {
  const file = await generateDocumentFile(doc)
  return {
    file,
    blob: documentFileBlob(file.bytes, file.mime),
  }
}

export function DocumentDownloadChip({
  document: doc,
  className,
}: {
  document: FilledDocument
  className?: string
}) {
  const [busy, setBusy] = useState<'view' | 'download' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const canView = doc.format === 'pdf'

  async function onDownload() {
    if (busy) return
    setBusy('download')
    setError(null)
    try {
      const { file, blob } = await buildDocument(doc)
      downloadBlob(file.filename, blob)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the file')
    } finally {
      setBusy(null)
    }
  }

  async function onView() {
    if (busy || !canView) return
    setBusy('view')
    setError(null)
    try {
      const { blob } = await buildDocument(doc)
      const url = URL.createObjectURL(blob)
      const opened = window.open(url, '_blank', 'noopener,noreferrer')
      if (!opened) {
        URL.revokeObjectURL(url)
        throw new Error('Popup blocked — allow popups to view the PDF')
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the file')
    } finally {
      setBusy(null)
    }
  }

  const label = doc.format === 'pdf' ? 'PDF' : doc.format === 'docx' ? 'Word' : 'Excel'

  return (
    <div className={cn('space-y-1', className)}>
      <div className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-xl bg-[var(--color-surface-2)] px-2 py-1.5 text-xs font-medium text-[var(--color-ink)] ring-1 ring-[var(--color-border)]/80">
        {busy ? (
          <Loader2 className="ml-1 h-4 w-4 shrink-0 animate-spin text-[var(--color-accent)]" />
        ) : (
          <span className="ml-1">
            <FormatIcon format={doc.format} />
          </span>
        )}
        <span className="min-w-0 max-w-[10rem] truncate sm:max-w-[14rem]" title={doc.filename}>
          {doc.filename}
        </span>
        <span className="shrink-0 rounded-md bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)] ring-1 ring-[var(--color-border)]/80">
          {label}
        </span>
        {canView ? (
          <button
            type="button"
            onClick={() => void onView()}
            disabled={!!busy}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-[var(--color-surface)] disabled:opacity-60"
          >
            <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
            View
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void onDownload()}
          disabled={!!busy}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-[var(--color-surface)] disabled:opacity-60"
        >
          <Download className="h-3 w-3 shrink-0 opacity-70" />
          Download
        </button>
      </div>
      {error ? <p className="text-[11px] text-[var(--color-danger)]">{error}</p> : null}
    </div>
  )
}
