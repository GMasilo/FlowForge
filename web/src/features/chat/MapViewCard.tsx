import { ExternalLink, MapPin } from 'lucide-react'
import type { MapEmbedPayload } from '@/features/templates/mapEmbed'
import { cn } from '@/shared/lib/utils'

export function MapViewCard({
  map,
  className,
}: {
  map: MapEmbedPayload
  className?: string
}) {
  const pins = map.pins.filter((p) => p.label.trim() || (p.lat.trim() && p.lng.trim()))
  const embedUrl = map.embedUrl.trim()

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm',
        className,
      )}
    >
      {(map.title.trim() || map.intro.trim()) && (
        <div className="border-b border-[var(--color-border)] px-3 py-2.5">
          {map.title.trim() ? (
            <p className="text-sm font-semibold text-[var(--color-ink)]">{map.title}</p>
          ) : null}
          {map.intro.trim() ? (
            <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">{map.intro}</p>
          ) : null}
        </div>
      )}
      {embedUrl ? (
        <div className="relative h-52 w-full bg-[var(--color-surface-2)]">
          <iframe
            title={map.title || 'Map'}
            src={embedUrl}
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center gap-2 bg-[var(--color-surface-2)] text-sm text-[var(--color-ink-muted)]">
          <MapPin className="h-4 w-4" aria-hidden />
          Map unavailable
        </div>
      )}
      {pins.length ? (
        <ul className="divide-y divide-[var(--color-border)]">
          {pins.map((pin, i) => (
            <li key={`${pin.label}-${i}`} className="flex items-start gap-2 px-3 py-2.5">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--color-ink)]">
                  {pin.label.trim() || `Pin ${i + 1}`}
                </p>
                {pin.description.trim() ? (
                  <p className="text-xs text-[var(--color-ink-muted)]">{pin.description}</p>
                ) : null}
                {pin.lat.trim() && pin.lng.trim() ? (
                  <p className="font-mono text-[10px] text-[var(--color-ink-muted)]">
                    {pin.lat}, {pin.lng}
                  </p>
                ) : null}
              </div>
              {pin.link.trim() ? (
                <a
                  href={pin.link.trim()}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 rounded-lg p-1.5 text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-accent)]"
                  aria-label={`Open link for ${pin.label || `pin ${i + 1}`}`}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
