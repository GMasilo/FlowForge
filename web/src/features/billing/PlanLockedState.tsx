import { Link } from 'react-router-dom'
import { Lock, ArrowUpRight } from 'lucide-react'
import { PLAN_UPGRADE_HINT } from '@/features/billing/planCatalog'
import type { InstanceFeatureFlag } from '@/shared/types/database'
import { buttonVariants } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { cn } from '@/shared/lib/utils'

export function PlanLockedState({
  feature,
  title,
  className,
}: {
  feature: InstanceFeatureFlag
  title?: string
  className?: string
}) {
  return (
    <Card className={cn('flex flex-col items-start gap-3 p-6', className)}>
      <span className="inline-flex rounded-xl bg-[var(--color-accent-soft)] p-2.5 text-[var(--color-accent)]">
        <Lock className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
          {title ?? 'Not on your plan'}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-ink-muted)]">
          {PLAN_UPGRADE_HINT[feature]}
        </p>
      </div>
      <Link to="/pricing" className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}>
        View pricing
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </Card>
  )
}
