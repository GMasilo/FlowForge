import { ExternalLink } from 'lucide-react'
import {
  socialEmbedAspectClass,
  socialEmbedIframeSrc,
  type SocialEmbedPayload,
} from '@/features/chat/socialEmbed'
import { cn } from '@/shared/lib/utils'

const PROVIDER_LABEL: Record<SocialEmbedPayload['provider'], string> = {
  youtube: 'YouTube',
  x: 'X',
  vimeo: 'Vimeo',
  spotify: 'Spotify',
  tiktok: 'TikTok',
}

export function SocialEmbedCard({
  embed,
  className,
}: {
  embed: SocialEmbedPayload
  className?: string
}) {
  const src = socialEmbedIframeSrc(embed)
  const label = PROVIDER_LABEL[embed.provider]

  return (
    <figure
      className={cn(
        'w-full min-w-0 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm',
        className,
      )}
    >
      {src ? (
        <div className={cn('relative w-full bg-slate-950/5', socialEmbedAspectClass(embed))}>
          <iframe
            title={embed.title || `${label} embed`}
            src={src}
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
          />
        </div>
      ) : null}
      <figcaption className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] px-2.5 py-1.5 text-[11px] text-[var(--color-ink-muted)]">
        <span className="truncate font-medium text-[var(--color-ink)]">{label}</span>
        <a
          href={embed.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-teal-800 hover:underline"
        >
          Open
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      </figcaption>
    </figure>
  )
}
