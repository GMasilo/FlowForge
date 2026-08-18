import { Shield } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

/** Distinctive mark for FlowForge platform superadmins (not org owner/admin). */
export function SuperuserBadge({
  className,
  compact = false,
}: {
  className?: string
  compact?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300 ring-1 ring-amber-400/40',
        compact && 'px-1 tracking-[0.08em]',
        className,
      )}
      title="FlowForge superadmin"
    >
      <Shield className={cn('shrink-0', compact ? 'h-2.5 w-2.5' : 'h-3 w-3')} aria-hidden />
      {compact ? 'FF' : 'Superadmin'}
    </span>
  )
}
