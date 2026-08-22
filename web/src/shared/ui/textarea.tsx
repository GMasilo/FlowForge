import type { TextareaHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/utils'

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-24 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/90 px-3 py-2 text-sm text-[var(--color-ink)] shadow-sm placeholder:text-[var(--color-ink-muted)] transition-all duration-200 hover:border-[var(--color-accent)]/35 focus-visible:border-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-accent)]/15',
        className,
      )}
      {...props}
    />
  )
}
