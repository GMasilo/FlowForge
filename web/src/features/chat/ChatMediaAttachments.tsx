import { Download, FileText } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { mediaKindOf, type ChatbotMediaFile } from '@/features/designer/model/chatbotMedia'
import { MediaPlayCard } from '@/features/chat/ChatMediaPlayer'

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
                  user ? 'ring-1 ring-white/30' : 'ring-1 ring-slate-200/80',
                )}
              />
            </a>
          )
        }
        if (kind === 'video' || kind === 'audio') {
          return <MediaPlayCard key={file.filename} file={file} kind={kind} />
        }
        return (
          <a
            key={file.filename}
            href={file.url}
            target="_blank"
            rel="noreferrer"
            className={cn(
              'inline-flex max-w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium',
              user
                ? 'bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/20'
                : 'bg-slate-50 text-slate-700 ring-1 ring-slate-200/80 hover:bg-slate-100',
            )}
          >
            <FileText className={cn('h-3.5 w-3.5 shrink-0', user ? 'text-white/70' : 'text-slate-400')} />
            <span className="min-w-0 truncate">{file.filename}</span>
            <Download className="h-3.5 w-3.5 shrink-0 opacity-50" />
          </a>
        )
      })}
    </div>
  )
}
