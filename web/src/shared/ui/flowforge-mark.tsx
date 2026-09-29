import { cn } from '@/shared/lib/utils'

/** Shared product mark; the adjacent wordmark or parent link supplies its accessible name. */
export function FlowForgeMark({ className }: { className?: string }) {
  return <img src={`${import.meta.env.BASE_URL}favicon.svg?v=flowforge-1`} alt="" aria-hidden="true" width={64} height={64} className={cn('inline-block shrink-0 object-contain', className)} />
}
