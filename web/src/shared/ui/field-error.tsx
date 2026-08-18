import type { HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/utils'

export function FieldError({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-1 text-xs text-[var(--color-danger)]', className)} {...props} />
}
