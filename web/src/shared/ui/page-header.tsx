import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('ff-page-enter flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="max-w-2xl">
        <h1 className="bg-gradient-to-br from-[var(--color-ink)] via-[var(--color-ink)] to-[var(--color-accent)] bg-clip-text text-3xl font-semibold text-transparent">
          {title}
        </h1>
        {description ? <p className="mt-1.5 text-sm text-[var(--color-ink-muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
