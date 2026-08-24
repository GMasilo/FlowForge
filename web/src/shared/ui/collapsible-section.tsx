import { useId, useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

type CollapsibleSectionProps = {
  title: ReactNode
  description?: ReactNode
  /** Extra content in the header row (e.g. action buttons). Clicks do not toggle. */
  actions?: ReactNode
  /** Count or status chip next to the title. */
  badge?: ReactNode
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: ReactNode
  className?: string
  /** Wrap in Card-like styles (default true). */
  asCard?: boolean
  /** Compact nested section (attributes, records). */
  nested?: boolean
}

export function CollapsibleSection({
  title,
  description,
  actions,
  badge,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  children,
  className,
  asCard = true,
  nested = false,
}: CollapsibleSectionProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const open = controlledOpen ?? uncontrolledOpen
  const panelId = useId()

  function setOpen(next: boolean) {
    if (controlledOpen === undefined) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }

  return (
    <div
      className={cn(
        asCard &&
          'rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-surface)]/85 p-5 shadow-[var(--shadow-soft)] backdrop-blur-xl transition-shadow duration-300',
        nested &&
          'rounded-xl border border-[var(--color-border)]/90 bg-[var(--color-surface-2)]/60 p-3',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
          className={cn(
            'group flex min-w-0 flex-1 items-start gap-2 rounded-lg text-left outline-none',
            'focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40',
          )}
        >
          <ChevronRight
            className={cn(
              'mt-1 h-4 w-4 shrink-0 text-[var(--color-ink-muted)] transition-transform duration-200',
              open && 'rotate-90 text-[var(--color-accent)]',
            )}
            aria-hidden
          />
          <span className="min-w-0">
            <span
              className={cn(
                'flex flex-wrap items-center gap-2 font-medium text-[var(--color-ink)]',
                nested ? 'text-sm font-semibold' : 'text-lg',
              )}
            >
              {title}
              {badge}
            </span>
            {description ? (
              <span className="mt-1 block text-sm text-[var(--color-ink-muted)]">{description}</span>
            ) : null}
          </span>
        </button>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      {open ? (
        <div id={panelId} className={cn(nested ? 'mt-3 space-y-2' : 'mt-4 space-y-4')}>
          {children}
        </div>
      ) : null}
    </div>
  )
}
