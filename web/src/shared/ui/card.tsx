import type { HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-surface)]/80 p-5 shadow-[var(--shadow-soft)] backdrop-blur-xl transition-shadow duration-300',
        className,
      )}
      {...props}
    />
  )
}
