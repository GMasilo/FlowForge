import { useState } from 'react'
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import type { FilledDocument } from '@/features/templates/documentFill'
import { documentFileBlob, generateDocumentFile } from '@/features/templates/documentGenerate'
import { downloadBlob } from '@/shared/lib/downloadJson'
import { cn } from '@/shared/lib/utils'

function FormatIcon({ format }: { format: FilledDocument['format'] }) {
  if (format === 'xlsx') return <FileSpreadsheet className="h-4 w-4 shrink-0 text-teal-700" />
  return <FileText className="h-4 w-4 shrink-0 text-teal-700" />
}

export function DocumentDownloadChip({
  document: doc,
  className,
}: {
  document: FilledDocument
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onDownload() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const file = await generateDocumentFile(doc)
      downloadBlob(file.filename, documentFileBlob(file.bytes, file.mime))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the file')
    } finally {
      setBusy(false)
    }
  }

  const label = doc.format === 'pdf' ? 'PDF' : doc.format === 'docx' ? 'Word' : 'Excel'

  return (
    <div className={cn('space-y-1', className)}>
      <button
        type="button"
        onClick={() => void onDownload()}
        disabled={busy}
        className="inline-flex max-w-full items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 ring-1 ring-slate-200/80 transition hover:bg-teal-50 hover:text-teal-900 hover:ring-teal-200 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-teal-700" /> : <FormatIcon format={doc.format} />}
        <span className="min-w-0 truncate">{doc.filename}</span>
        <span className="shrink-0 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200/80">
          {label}
        </span>
        <Download className="h-3.5 w-3.5 shrink-0 opacity-50" />
      </button>
      {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}
    </div>
  )
}
