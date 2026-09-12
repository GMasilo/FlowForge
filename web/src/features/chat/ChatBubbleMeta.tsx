import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { stripFileEmbeds } from '@/features/designer/model/chatbotMedia'
import type { ChatMessage } from '@/features/designer/preview/previewRuntime'
import { cn } from '@/shared/lib/utils'

/** Plain text suitable for clipboard from a chat message. */
export function messageCopyText(
  message: Pick<ChatMessage, 'text' | 'link' | 'tel'>,
): string {
  if (message.link?.url) {
    const label = (message.text ?? '').trim()
    return label && label !== message.link.url ? `${label}\n${message.link.url}` : message.link.url
  }
  if (message.tel?.trim()) {
    const label = (message.text ?? '').trim()
    const phone = message.tel.trim()
    return label && label !== phone ? `${label}\n${phone}` : phone
  }
  return stripFileEmbeds(message.text ?? '').trim()
}

export function ChatBubbleMeta({
  createdAt,
  copyText,
  align = 'start',
  formatTime,
  className,
}: {
  createdAt?: string | null
  copyText?: string | null
  align?: 'start' | 'end' | 'center'
  formatTime?: (iso: string) => string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const text = (copyText ?? '').trim()
  const canCopy = text.length > 0

  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(id)
  }, [copied])

  async function onCopy() {
    if (!canCopy) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      // Fallback for older browsers / insecure contexts
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        setCopied(true)
      } catch {
        /* ignore */
      }
    }
  }

  if (!createdAt && !canCopy) return null

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-1',
        align === 'end' && 'justify-end',
        align === 'center' && 'justify-center',
        align === 'start' && 'justify-start',
        className,
      )}
    >
      {createdAt && formatTime ? (
        <time dateTime={createdAt} className="text-[10px] font-medium tracking-wide text-slate-400">
          {formatTime(createdAt)}
        </time>
      ) : null}
      {canCopy ? (
        <button
          type="button"
          onClick={() => void onCopy()}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[10px] font-medium transition',
            copied
              ? 'text-teal-600'
              : 'text-slate-400 hover:bg-slate-100/80 hover:text-slate-600',
          )}
          aria-label={copied ? 'Copied' : 'Copy message'}
          title={copied ? 'Copied' : 'Copy'}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      ) : null}
    </div>
  )
}
