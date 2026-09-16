import { cn } from '@/shared/lib/utils'

/**
 * Net Promoter Score (0–10) answer control. Selecting a score calls onSelect.
 */
export function NpsAnswerField({
  min = 0,
  max = 10,
  minLabel = 'Not at all likely',
  maxLabel = 'Extremely likely',
  disabled,
  className,
  onSelect,
}: {
  min?: number
  max?: number
  minLabel?: string
  maxLabel?: string
  disabled?: boolean
  className?: string
  onSelect: (value: number) => void
}) {
  const lo = Math.round(Number.isFinite(min) ? min : 0)
  const hi = Math.round(Number.isFinite(max) ? max : 10)
  const start = Math.min(lo, hi)
  const end = Math.max(lo, hi)
  const options: number[] = []
  for (let i = start; i <= end && options.length < 15; i++) options.push(i)

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap justify-center gap-1.5" role="group" aria-label="NPS score">
        {options.map((n) => {
          const tone =
            n <= start + Math.floor((end - start) * 0.6)
              ? n <= start + Math.floor((end - start) * 0.3)
                ? 'rose'
                : 'amber'
              : 'teal'
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(n)}
              className={cn(
                'grid h-9 w-9 place-items-center rounded-xl border text-sm font-semibold transition active:scale-95',
                'disabled:cursor-not-allowed disabled:opacity-50',
                tone === 'rose' &&
                  'border-[color-mix(in_srgb,var(--color-danger)_35%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-danger)_12%,var(--color-surface))] text-[var(--color-danger)] hover:border-[var(--color-danger)]',
                tone === 'amber' &&
                  'border-[color-mix(in_srgb,var(--color-warning)_35%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-warning)_12%,var(--color-surface))] text-[var(--color-warning)] hover:border-[var(--color-warning)]',
                tone === 'teal' &&
                  'border-[color-mix(in_srgb,var(--color-accent)_35%,var(--color-border))] bg-[var(--color-accent-soft)] text-[var(--color-accent)] hover:border-[var(--color-accent)]',
              )}
            >
              {n}
            </button>
          )
        })}
      </div>
      <div className="flex justify-between gap-3 px-0.5 text-[10px] font-medium text-[var(--color-ink-muted)]">
        <span>{minLabel}</span>
        <span className="text-right">{maxLabel}</span>
      </div>
    </div>
  )
}
