import { useRef, useState } from 'react'
import { FileText, Loader2, Paperclip, Trash2 } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'
import {
  fileAnswerForSubmit,
  htmlAcceptFor,
  isAllowedConversationFile,
  normalizeFileAccept,
  storeAnswerFiles,
  type AnswerFileStoreCtx,
} from '@/features/designer/model/conversationFiles'
import type { FileAcceptKind } from '@/features/designer/model/flowSchema'

export function FileAnswerField({
  accept = 'any',
  maxFiles = 1,
  disabled,
  className,
  storeCtx,
  onSubmit,
}: {
  accept?: FileAcceptKind | string
  maxFiles?: number
  disabled?: boolean
  className?: string
  storeCtx: AnswerFileStoreCtx
  onSubmit: (value: Record<string, unknown> | Record<string, unknown>[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [picked, setPicked] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const kind = normalizeFileAccept(accept)
  const limit = Math.min(5, Math.max(1, maxFiles))
  const multiple = limit > 1

  function addFiles(list: FileList | null) {
    if (!list?.length) return
    setError(null)
    const next = [...picked]
    for (const file of Array.from(list)) {
      if (!isAllowedConversationFile(file, kind)) {
        setError(`“${file.name}” is not an allowed type.`)
        continue
      }
      if (next.length >= limit) {
        setError(`You can attach at most ${limit} file${limit === 1 ? '' : 's'}.`)
        break
      }
      next.push(file)
    }
    setPicked(next)
  }

  async function submit() {
    if (!picked.length || busy) return
    setBusy(true)
    setError(null)
    try {
      const stored = await storeAnswerFiles(picked, storeCtx)
      onSubmit(fileAnswerForSubmit(stored))
      setPicked([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('flex min-w-0 flex-1 flex-col gap-2', className)}>
      {picked.length ? (
        <ul className="space-y-1.5">
          {picked.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm"
            >
              <FileText className="h-4 w-4 shrink-0 text-[var(--color-ink-muted)]" />
              <span className="min-w-0 flex-1 truncate font-medium text-[var(--color-ink)]">{file.name}</span>
              <button
                type="button"
                disabled={disabled || busy}
                aria-label={`Remove ${file.name}`}
                className="rounded-md p-1 text-[var(--color-ink-muted)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)] disabled:opacity-50"
                onClick={() => setPicked(picked.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-end gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={htmlAcceptFor(kind)}
          multiple={multiple}
          disabled={disabled || busy}
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <Button
          type="button"
          variant="secondary"
          className="h-11 flex-1 rounded-2xl"
          disabled={disabled || busy || picked.length >= limit}
          onClick={() => inputRef.current?.click()}
        >
          <Paperclip className="h-4 w-4" />
          {picked.length ? (multiple ? 'Add another file' : 'Replace file') : 'Choose file'}
        </Button>
        <Button
          type="button"
          className="h-11 rounded-2xl"
          disabled={disabled || busy || !picked.length}
          onClick={() => void submit()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
        </Button>
      </div>
      {error ? <p className="text-[11px] text-[var(--color-danger)]">{error}</p> : null}
    </div>
  )
}
