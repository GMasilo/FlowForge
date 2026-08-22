import type { HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/utils'

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lg bg-gradient-to-r from-[var(--color-accent)]/15 to-[var(--color-accent-2)]/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/20',
        className,
      )}
      {...props}
    />
  )
}
