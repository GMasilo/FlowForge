import { ExternalLink } from 'lucide-react'
import type { SocialShareEmbedPayload } from '@/features/templates/socialShareEmbed'
import { cn } from '@/shared/lib/utils'

function BrandIcon({ id, className }: { id: string; className?: string }) {
  const common = { className, viewBox: '0 0 24 24', 'aria-hidden': true as const, fill: 'currentColor' }
  switch (id) {
    case 'x':
      return (
        <svg {...common}>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.99 2.25h7.54l4.261 5.669L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
        </svg>
      )
    case 'linkedin':
      return (
        <svg {...common}>
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      )
    case 'facebook':
      return (
        <svg {...common}>
          <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.931-1.956 1.887v2.265h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
        </svg>
      )
    case 'instagram':
      return (
        <svg {...common}>
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      )
    case 'tiktok':
      return (
        <svg {...common}>
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.95-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
        </svg>
      )
    case 'youtube':
      return (
        <svg {...common}>
          <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      )
    case 'twitch':
      return (
        <svg {...common}>
          <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
        </svg>
      )
    case 'threads':
      return (
        <svg {...common}>
          <path d="M12.186 24h-.007c-3.447-.026-5.92-1.464-7.396-3.314-1.265-1.589-1.93-3.621-1.8-5.67.16-2.528 1.356-4.49 3.556-5.833.47-.288.96-.525 1.468-.715C6.87 5.71 8.596 2.97 12.18 2.97c.75 0 1.5.09 2.22.27 3.22.8 5.2 3.3 5.47 6.9.06.8.05 1.58-.04 2.36-.5 4.4-3.35 7.3-7.64 7.5zm4.95-12.7c-.12-1.7-.9-3.1-2.35-3.85-.6-.31-1.25-.47-1.95-.47-2.05 0-3.35 1.35-3.55 3.65-.08.95.15 1.85.67 2.55.55.75 1.35 1.25 2.25 1.4.15.02.3.03.45.03 1.5 0 2.75-.85 3.3-2.25.25-.6.3-1.25.18-1.96z" />
        </svg>
      )
    case 'pinterest':
      return (
        <svg {...common}>
          <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.174-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741a.297.297 0 01.069.288c-.074.303-.24.969-.272 1.104-.043.183-.145.222-.334.134-1.249-.581-2.03-2.407-2.03-3.874 0-3.154 2.292-6.052 6.608-6.052 3.469 0 6.165 2.473 6.165 5.776 0 3.447-2.173 6.22-5.19 6.22-1.013 0-1.966-.525-2.291-1.148l-.623 2.378c-.226.869-.835 1.958-1.244 2.621.937.29 1.931.446 2.962.446 6.624 0 11.99-5.367 11.99-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
        </svg>
      )
  }
}

function platformTone(id: string): string {
  switch (id) {
    case 'x':
      return 'bg-neutral-900/10 text-neutral-900 ring-neutral-900/20 hover:bg-neutral-900/15 dark:text-neutral-100'
    case 'linkedin':
      return 'bg-[#0A66C2]/15 text-[#0A66C2] ring-[#0A66C2]/25 hover:bg-[#0A66C2]/25'
    case 'facebook':
      return 'bg-[#1877F2]/15 text-[#1877F2] ring-[#1877F2]/25 hover:bg-[#1877F2]/25'
    case 'instagram':
      return 'bg-[#E4405F]/15 text-[#E4405F] ring-[#E4405F]/25 hover:bg-[#E4405F]/25'
    case 'tiktok':
      return 'bg-neutral-900/10 text-neutral-900 ring-neutral-900/20 hover:bg-neutral-900/15 dark:text-neutral-100'
    case 'youtube':
      return 'bg-[#FF0000]/15 text-[#FF0000] ring-[#FF0000]/25 hover:bg-[#FF0000]/25'
    case 'twitch':
      return 'bg-[#9146FF]/15 text-[#9146FF] ring-[#9146FF]/25 hover:bg-[#9146FF]/25'
    case 'threads':
      return 'bg-neutral-900/10 text-neutral-900 ring-neutral-900/20 hover:bg-neutral-900/15 dark:text-neutral-100'
    case 'pinterest':
      return 'bg-[#E60023]/15 text-[#E60023] ring-[#E60023]/25 hover:bg-[#E60023]/25'
    default:
      return 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] ring-[var(--color-accent)]/25'
  }
}

export function SocialShareCard({
  share,
  className,
}: {
  share: SocialShareEmbedPayload
  className?: string
}) {
  if (!share.platforms.length && !share.title.trim() && !share.text.trim()) return null

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm',
        className,
      )}
    >
      {(share.title.trim() || share.text.trim()) && (
        <div className="border-b border-[var(--color-border)] px-3.5 py-2.5">
          {share.title.trim() ? (
            <p className="text-sm font-semibold text-[var(--color-ink)]">{share.title}</p>
          ) : null}
          {share.text.trim() ? (
            <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">{share.text}</p>
          ) : null}
        </div>
      )}
      <div className="flex flex-col gap-2 px-3.5 py-3">
        {share.platforms.map((p) => (
          <a
            key={p.id}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'inline-flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ring-1 transition',
              platformTone(p.id),
            )}
          >
            <span className="inline-flex items-center gap-2">
              <BrandIcon id={p.id} className="h-4 w-4 shrink-0" />
              {p.label}
            </span>
            <ExternalLink className="h-3.5 w-3.5 opacity-70" />
          </a>
        ))}
        {!share.platforms.length ? (
          <p className="text-xs text-[var(--color-ink-muted)]">No networks enabled.</p>
        ) : null}
      </div>
    </div>
  )
}