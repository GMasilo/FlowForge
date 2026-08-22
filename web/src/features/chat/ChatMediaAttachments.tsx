import { Download, ExternalLink, FileText } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import {
  isPdfMediaFile,
  mediaFileDownloadUrl,
  mediaKindOf,
  type ChatbotMediaFile,
} from '@/features/designer/model/chatbotMedia'
import { MediaPlayCard } from '@/features/chat/ChatMediaPlayer'

function FileActionChip({
  file,
  user,
}: {
  file: ChatbotMediaFile
  user: boolean
}) {
  const canView = isPdfMediaFile(file)
  const downloadUrl = mediaFileDownloadUrl(file.url)

  return (
    <div
      className={cn(
        'inline-flex max-w-full flex-wrap items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-medium',
        user
          ? 'bg-[var(--color-accent-fg)]/15 text-[var(--color-accent-fg)] ring-1 ring-[var(--color-accent-fg)]/25'
          : 'bg-[var(--color-surface-2)] text-[var(--color-ink)] ring-1 ring-[var(--color-border)]/80',
      )}
    >
      <FileText
        className={cn(
          'ml-1 h-3.5 w-3.5 shrink-0',
          user ? 'text-[var(--color-accent-fg)]/70' : 'text-[var(--color-ink-muted)]',
        )}
      />
      <span className="min-w-0 max-w-[10rem] truncate sm:max-w-[14rem]" title={file.filename}>
        {file.filename}
      </span>
      {canView ? (
        <a
          href={file.url}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'inline-flex items-center gap-1 rounded-lg px-2 py-1',
            user ? 'hover:bg-[var(--color-accent-fg)]/15' : 'hover:bg-[var(--color-surface)]',
          )}
        >
          <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
          View
        </a>
      ) : null}
      <a
        href={downloadUrl}
        download={file.filename}
        className={cn(
          'inline-flex items-center gap-1 rounded-lg px-2 py-1',
          user ? 'hover:bg-[var(--color-accent-fg)]/15' : 'hover:bg-[var(--color-surface)]',
        )}
      >
        <Download className="h-3 w-3 shrink-0 opacity-70" />
        Download
      </a>
    </div>
  )
}

export function ChatMediaAttachments({
  items,
  className,
  variant = 'bot',
}: {
  items?: ChatbotMediaFile[] | null
  className?: string
  variant?: 'bot' | 'user'
}) {
  if (!items?.length) return null
  const user = variant === 'user'

  return (
    <div className={cn('mt-2 space-y-2', className)}>
      {items.map((file) => {
        const kind = mediaKindOf(file)
        if (kind === 'image') {
          return (
            <a key={file.filename} href={file.url} target="_blank" rel="noreferrer" className="block">
              <img
                src={file.url}
                alt={file.filename}
                className={cn(
                  'max-h-56 max-w-full rounded-xl object-contain',
                  user ? 'ring-1 ring-[var(--color-accent-fg)]/30' : 'ring-1 ring-[var(--color-border)]/80',
                )}
              />
            </a>
          )
        }
        if (kind === 'video' || kind === 'audio') {
          return <MediaPlayCard key={file.filename} file={file} kind={kind} />
        }
        return <FileActionChip key={file.filename} file={file} user={user} />
      })}
    </div>
  )
}
