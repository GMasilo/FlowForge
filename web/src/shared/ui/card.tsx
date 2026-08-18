import type { HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/60 bg-white/80 p-5 shadow-[var(--shadow-soft)] backdrop-blur-xl transition-shadow duration-300',
        className,
      )}
      {...props}
    />
  )
}
