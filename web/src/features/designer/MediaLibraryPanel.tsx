import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Download, ExternalLink, ImageIcon, Loader2, Trash2, Upload } from 'lucide-react'
import {
  DESIGNER_MEDIA_ACCEPT,
  mediaInsert,
  mediaKindOf,
  mediaKeyFromFilename,
  type ChatbotMediaFile,
} from '@/features/designer/model/chatbotMedia'
import {
  absoluteInstanceFileUrl,
  deleteDesignerMedia,
  isFlowForgeApiConfigured,
  listDesignerMedia,
  uploadDesignerMedia,
} from '@/shared/lib/flowforgeApi'
import { createDocumentHandlers } from '@/shared/lib/documents'
import { canEdit } from '@/shared/types/database'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { Button } from '@/shared/ui/button'
import { CollapsibleSection } from '@/shared/ui/collapsible-section'
import { cn } from '@/shared/lib/utils'

export function useChatbotMedia(instanceId?: string, chatbotId?: string) {
  return useQuery({
    queryKey: ['chatbot-media', instanceId, chatbotId],
    enabled: !!instanceId && !!chatbotId && isFlowForgeApiConfigured(),
    queryFn: () => listDesignerMedia({ instanceId: instanceId!, chatbotId: chatbotId! }),
  })
}

export function MediaLibraryPanel({
  instanceId,
  chatbotId,
}: {
  instanceId: string
  chatbotId: string
}) {
  const { role } = useRequiredInstance()
  const editable = canEdit(role)
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [busyFile, setBusyFile] = useState<string | null>(null)

  const docs = createDocumentHandlers({ instanceId, chatbotId, kind: 'media' })

  const media = useChatbotMedia(instanceId, chatbotId)

  const upload = useMutation({
    mutationFn: (file: File) => uploadDesignerMedia({ instanceId, chatbotId, file }),
    onSuccess: async () => {
      setError(null)
      await qc.invalidateQueries({ queryKey: ['chatbot-media', instanceId, chatbotId] })
    },
    onError: (e: Error) => setError(e.message),
  })

  const remove = useMutation({
    mutationFn: (filename: string) => deleteDesignerMedia({ instanceId, chatbotId, filename }),
    onSuccess: async () => {
      setError(null)
      await qc.invalidateQueries({ queryKey: ['chatbot-media', instanceId, chatbotId] })
    },
    onError: (e: Error) => setError(e.message),
  })

  function onFiles(files: FileList | null) {
    if (!files?.length) return
    for (const file of Array.from(files)) {
      upload.mutate(file)
    }
  }

  async function copyInsert(file: ChatbotMediaFile) {
    const key = file.key || mediaKeyFromFilename(file.filename)
    const text = mediaInsert(key)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(file.filename)
      window.setTimeout(() => setCopied(null), 1200)
    } catch {
      setError('Could not copy to clipboard')
    }
  }

  async function openFile(filename: string) {
    setBusyFile(filename)
    setError(null)
    try {
      docs.open(filename)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open file')
    } finally {
      setBusyFile(null)
    }
  }

  async function downloadFile(filename: string) {
    setBusyFile(filename)
    setError(null)
    try {
      await docs.download(filename)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not download file')
    } finally {
      setBusyFile(null)
    }
  }

  if (!isFlowForgeApiConfigured()) {
    return (
      <CollapsibleSection
        title="Media"
        description="Configure VITE_FLOWFORGE_API_URL to upload chatbot media."
        badge={
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            Offline
          </span>
        }
      />
    )
  }

  const files = media.data ?? []

  return (
    <CollapsibleSection
      title="Media"
      description="Upload files for this chatbot, then attach them on steps or insert {{renderFile(media.key)}} in a message."
      defaultOpen={false}
      badge={
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          {files.length}
        </span>
      }
      actions={
        editable ? (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={DESIGNER_MEDIA_ACCEPT}
              className="hidden"
              onChange={(e) => {
                onFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={upload.isPending}
              onClick={() => inputRef.current?.click()}
            >
              {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Upload
            </Button>
          </>
        ) : null
      }
    >
      {error ? <p className="mb-3 text-xs text-rose-600">{error}</p> : null}
      {media.isLoading ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Loading media…</p>
      ) : files.length ? (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {files.map((file) => {
            const kind = mediaKindOf(file)
            const url = absoluteInstanceFileUrl(file.url)
            const insert = mediaInsert(file.key || mediaKeyFromFilename(file.filename))
            return (
              <li
                key={file.filename}
                className="flex gap-2 rounded-xl border border-slate-200/80 bg-white/80 p-2"
              >
                <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200/70">
                  {kind === 'image' ? (
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-slate-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-800" title={file.filename}>
                    {file.filename}
                  </p>
                  <p className="truncate font-mono text-[10px] text-teal-700">{insert}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <button
                      type="button"
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                        copied === file.filename
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
                      )}
                      onClick={() => void copyInsert(file)}
                    >
                      <Copy className="h-3 w-3" />
                      {copied === file.filename ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      disabled={busyFile === file.filename}
                      onClick={() => void openFile(file.filename)}
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      disabled={busyFile === file.filename}
                      onClick={() => void downloadFile(file.filename)}
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </button>
                    {editable ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-rose-600 hover:bg-rose-50"
                        disabled={remove.isPending}
                        onClick={() => {
                          if (!window.confirm(`Delete ${file.filename}? Steps that attach it will lose the file.`)) return
                          remove.mutate(file.filename)
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-[var(--color-ink-muted)]">No media yet. Upload images, audio, video, or documents.</p>
      )}
    </CollapsibleSection>
  )
}
