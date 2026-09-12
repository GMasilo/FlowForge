import type { HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/utils'

export function Card({
  className,
  interactive = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-surface)]/85 p-5 shadow-[var(--shadow-soft)] backdrop-blur-xl transition-[box-shadow,border-color,transform] duration-300',
        interactive &&
          'ff-hover-lift cursor-pointer hover:border-[var(--color-accent)]/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
        className,
      )}
      {...props}
    />
  )
}
