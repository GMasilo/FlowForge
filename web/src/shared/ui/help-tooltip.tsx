import type { ReactNode } from 'react'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Tooltip } from '@/shared/ui/tooltip'

type HelpTooltipProps = {
  content: ReactNode
  /** Accessible label when content is plain text. */
  label?: string
  className?: string
  side?: 'top' | 'bottom'
  /** Slightly larger trigger for section headings. */
  size?: 'sm' | 'md'
}

export function HelpTooltip({ content, label = 'Help', className, side = 'top', size = 'sm' }: HelpTooltipProps) {
  const iconClass = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'

  return (
    <Tooltip content={content} side={side}>
      <button
        type="button"
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full text-[var(--color-ink-muted)] transition hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40',
          className,
        )}
        aria-label={label}
        onClick={(e) => e.preventDefault()}
      >
        <HelpCircle className={iconClass} aria-hidden />
      </button>
    </Tooltip>
  )
}

type SectionHeadingProps = {
  title: string
  help?: ReactNode
  className?: string
  /** Use text-lg for primary sections (Agent console, etc.). */
  size?: 'sm' | 'lg'
}

export function SectionHeading({ title, help, className, size = 'sm' }: SectionHeadingProps) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <h2 className={size === 'lg' ? 'text-lg font-medium text-[var(--color-ink)]' : 'text-sm font-semibold text-[var(--color-ink)]'}>
        {title}
      </h2>
      {help ? <HelpTooltip content={help} size={size === 'lg' ? 'md' : 'sm'} label={`Help: ${title}`} /> : null}
    </div>
  )
}
