import { Star } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

/**
 * Star-rating answer control. Clicking a star submits that value via onSelect.
 */
export function StarsAnswerField({
  min = 1,
  max = 5,
  disabled,
  className,
  onSelect,
}: {
  min?: number
  max?: number
  disabled?: boolean
  className?: string
  onSelect: (value: number) => void
}) {
  const lo = Math.max(1, Math.round(min))
  const hi = Math.max(lo, Math.min(10, Math.round(max)))

  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-1', className)} role="group" aria-label="Star rating">
      {Array.from({ length: hi }, (_, i) => i + 1).map((n) => {
        const belowMin = n < lo
        return (
          <button
            key={n}
            type="button"
            disabled={disabled || belowMin}
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
            title={belowMin ? `Minimum is ${lo}` : undefined}
            onClick={() => onSelect(n)}
            className={cn(
              'grid h-11 w-11 place-items-center rounded-2xl text-amber-400 transition',
              'hover:bg-amber-50 hover:text-amber-500 active:scale-95',
              'disabled:cursor-not-allowed disabled:opacity-50',
              belowMin && 'opacity-30',
            )}
          >
            <Star className="h-7 w-7 fill-current" strokeWidth={1.5} />
          </button>
        )
      })}
    </div>
  )
}
