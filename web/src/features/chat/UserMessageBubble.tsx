import { useEffect, useState } from 'react'
import { ExternalLink, Phone } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { ChatMessage } from '@/features/designer/preview/previewRuntime'
import { ChatMediaAttachments } from '@/features/chat/ChatMediaAttachments'

function ensureHref(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  return `https://${url}`
}

function telHref(phone: string): string {
  const compact = phone.trim().replace(/[\s()-]/g, '')
  return `tel:${compact}`
}

const linkClassName =
  'inline-flex max-w-full items-center gap-1.5 break-all text-sm font-medium text-[var(--color-accent-fg)] underline decoration-[var(--color-accent-fg)]/50 underline-offset-2 transition hover:decoration-[var(--color-accent-fg)]'

export function UserMessageBubble({
  message,
  className,
}: {
  message: ChatMessage
  className?: string
}) {
  const link = message.link
  const tel = message.tel?.trim() || null
  const [iconFailed, setIconFailed] = useState(false)

  useEffect(() => {
    setIconFailed(false)
  }, [link?.icon])

  if (tel && !link?.url) {
    return (
      <div className={cn(className)}>
        <a href={telHref(tel)} className={linkClassName}>
          <Phone className="h-3.5 w-3.5 shrink-0 opacity-80" />
          <span className="min-w-0">{message.text || tel}</span>
        </a>
      </div>
    )
  }

  if (!link?.url) {
    const color =
      typeof message.text === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(message.text.trim())
        ? message.text.trim()
        : null
    return (
      <div className={cn('space-y-2', className)}>
        {color ? (
          <span className="inline-flex items-center gap-2">
            <span
              className="h-5 w-5 shrink-0 rounded-md ring-1 ring-[var(--color-accent-fg)]/40"
              style={{ background: color }}
              aria-hidden
            />
            <span className="font-mono text-sm">{message.text}</span>
          </span>
        ) : message.text ? (
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
        ) : null}
        <ChatMediaAttachments items={message.media} variant="user" className="mt-0" />
      </div>
    )
  }

  const href = ensureHref(link.url)
  const description = link.description?.trim() || null
  const title = link.title?.trim() || null
  const site = link.siteName?.trim() || null
  const icon = !iconFailed && link.icon?.trim() ? link.icon.trim() : null
  const hasMeta = !!(description || title || site || icon)

  return (
    <div className={cn('space-y-2', className)}>
      {link.loading ? (
        <p className="text-[11px] leading-snug text-[var(--color-accent-fg)]/70">Fetching page description…</p>
      ) : null}

      {!link.loading && hasMeta ? (
        <div className="flex items-start gap-2.5">
          {icon ? (
            <img
              src={icon}
              alt=""
              width={20}
              height={20}
              className="mt-0.5 h-5 w-5 shrink-0 rounded-md bg-[var(--color-accent-fg)]/15 object-contain ring-1 ring-[var(--color-accent-fg)]/20"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setIconFailed(true)}
            />
          ) : null}
          <div className="min-w-0 space-y-0.5">
            {title ? <p className="text-[13px] font-semibold leading-snug text-[var(--color-accent-fg)]">{title}</p> : null}
            {description ? (
              <p className="text-[12px] leading-snug text-[var(--color-accent-fg)]/85">{description}</p>
            ) : null}
            {site ? (
              <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-accent-fg)]/55">{site}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {!link.loading && link.error && !description && !title ? (
        <p className="text-[11px] leading-snug text-[var(--color-accent-fg)]/65">{link.error}</p>
      ) : null}

      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClassName}
      >
        <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" />
        <span className="min-w-0">{message.text || link.url}</span>
      </a>
    </div>
  )
}
