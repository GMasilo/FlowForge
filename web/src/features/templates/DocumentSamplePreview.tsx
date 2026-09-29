import { useEffect, useRef } from 'react'
import { ExternalLink, X } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import type { DocumentGallerySample } from './documentGallery'

export function DocumentSamplePreview({ sample, onClose }: { sample: DocumentGallerySample; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const url = `${import.meta.env.BASE_URL}samples/documents/${sample.id}.pdf`
  useEffect(() => {
    const element = dialog.current
    const previousOverflow = document.body.style.overflow
    element?.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      element?.close()
      document.body.style.overflow = previousOverflow
    }
  }, [])
  return <dialog ref={dialog} aria-labelledby="document-preview-title" onCancel={onClose}
    className="fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none border-0 bg-[var(--color-surface)] p-0 text-[var(--color-ink)] backdrop:bg-black/60">
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--color-border)] p-3">
        <h2 id="document-preview-title" className="min-w-0 flex-1 font-semibold">{sample.name}</h2>
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm underline"><ExternalLink className="h-4 w-4" />Open in browser tab</a>
        <a href={url} download className="text-sm underline">Download PDF</a>
        <Button type="button" variant="secondary" size="sm" onClick={onClose} autoFocus><X className="h-4 w-4" />Close preview</Button>
      </header>
      <p className="shrink-0 px-3 py-2 text-xs text-[var(--color-ink-muted)]">Full document preview. Use the PDF toolbar to zoom or navigate pages. If your browser cannot display PDFs here, open it in a browser tab or download it.</p>
      <iframe src={`${url}#view=FitH`} title={`${sample.name} — full PDF document`} className="min-h-0 w-full flex-1 border-0 bg-slate-200" />
    </div>
  </dialog>
}
