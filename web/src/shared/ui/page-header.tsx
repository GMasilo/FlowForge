import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import { HelpTooltip } from '@/shared/ui/help-tooltip'

interface PageHeaderProps {
  title: string
  description?: string
  /** Short help shown on hover/focus — use PAGE_HELP constants or custom text. */
  help?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, description, help, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('ff-page-enter flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="max-w-2xl">
        <div className="flex items-center gap-2">
          <h1 className="ff-gradient-text text-3xl font-semibold tracking-tight">{title}</h1>
          {help ? <HelpTooltip content={help} size="md" label={`Help: ${title}`} side="bottom" /> : null}
        </div>
        {description ? <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-ink-muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 animate-[ff-fade-in_0.35s_var(--ease-spring)_both]">{actions}</div> : null}
    </div>
  )
}
