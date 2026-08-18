import { useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Loader2, Trash2, Upload } from 'lucide-react'
import {
  DESIGNER_MEDIA_ACCEPT,
  mediaInsert,
  mediaKindOf,
  mediaKeyFromFilename,
  type ChatbotMediaFile,
} from '@/features/designer/model/chatbotMedia'
import {
  absoluteInstanceFileUrl,
  isFlowForgeApiConfigured,
  uploadDesignerMedia,
} from '@/shared/lib/flowforgeApi'
import { useChatbotMedia } from '@/features/designer/MediaLibraryPanel'
import { Button } from '@/shared/ui/button'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'

export function StepMediaPicker({
  instanceId,
  chatbotId,
  filenames,
  disabled,
  onChange,
}: {
  instanceId: string
  chatbotId: string
  filenames: string[]
  disabled?: boolean
  onChange: (next: string[]) => void
}) {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const media = useChatbotMedia(instanceId, chatbotId)
  const files = media.data ?? []
  const byName = new Map(files.map((f) => [f.filename, f]))
  const unused = files.filter((f) => !filenames.includes(f.filename))

  const upload = useMutation({
    mutationFn: (file: File) => uploadDesignerMedia({ instanceId, chatbotId, file }),
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ['chatbot-media', instanceId, chatbotId] })
      if (result.filename && !filenames.includes(result.filename)) {
        onChange([...filenames, result.filename])
      }
    },
  })

  if (!isFlowForgeApiConfigured()) {
    return (
      <p className="text-[11px] text-[var(--color-ink-muted)]">
        Media uploads need the FlowForge API URL configured.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <Label>Attached media</Label>
      <p className="text-[11px] text-[var(--color-ink-muted)]">
        Shown with this step in chat. To show a file inside the message text, insert{' '}
        {`{{renderFile(media.key)}}`}.
      </p>
      {filenames.length ? (
        <ul className="space-y-1.5">
          {filenames.map((name) => {
            const file = byName.get(name)
            return (
              <MediaChip
                key={name}
                filename={name}
                file={file}
                disabled={disabled}
                onRemove={() => onChange(filenames.filter((f) => f !== name))}
              />
            )
          })}
        </ul>
      ) : (
        <p className="text-[11px] text-slate-400">None attached.</p>
      )}
      {!disabled ? (
        <div className="flex flex-wrap items-center gap-2">
          {unused.length ? (
            <Select
              value=""
              onChange={(e) => {
                const name = e.target.value
                if (name) onChange([...filenames, name])
              }}
            >
              <option value="">Add from library…</option>
              {unused.map((f) => (
                <option key={f.filename} value={f.filename}>
                  {f.filename}
                </option>
              ))}
            </Select>
          ) : null}
          <input
            ref={inputRef}
            type="file"
            accept={DESIGNER_MEDIA_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) upload.mutate(file)
            }}
          />
          <Button size="sm" variant="secondary" disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
            {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Upload
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function MediaChip({
  filename,
  file,
  disabled,
  onRemove,
}: {
  filename: string
  file?: ChatbotMediaFile
  disabled?: boolean
  onRemove: () => void
}) {
  const key = file?.key || mediaKeyFromFilename(filename)
  const kind = file ? mediaKindOf(file) : 'file'
  const url = file ? absoluteInstanceFileUrl(file.url) : ''
  return (
    <li className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-2 py-1.5">
      <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md bg-slate-100">
        {kind === 'image' && url ? (
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <FileText className="h-3.5 w-3.5 text-slate-400" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-slate-800">{filename}</p>
        <p className="truncate font-mono text-[10px] text-teal-700">{mediaInsert(key)}</p>
      </div>
      {!disabled ? (
        <button
          type="button"
          aria-label={`Remove ${filename}`}
          className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </li>
  )
}
