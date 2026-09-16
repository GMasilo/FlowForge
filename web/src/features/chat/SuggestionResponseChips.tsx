import { cn } from '@/shared/lib/utils'

/** Quick-reply chips shown under a bot message (message steps with suggested responses). */
export function SuggestionResponseChips({
  suggestions,
  disabled,
  className,
  onSelect,
}: {
  suggestions: string[]
  disabled?: boolean
  className?: string
  onSelect: (value: string) => void
}) {
  if (!suggestions.length) return null

  return (
    <div className={cn('mt-2 flex flex-wrap gap-1.5', className)}>
      {suggestions.map((label) => (
        <button
          key={label}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(label)}
          className={cn(
            'rounded-full border border-[color-mix(in_srgb,var(--color-accent)_35%,var(--color-border))] bg-[var(--color-accent-soft)] px-3 py-1.5 text-left text-xs font-medium text-[var(--color-accent)] transition',
            'hover:border-[var(--color-accent)] hover:opacity-90 disabled:cursor-default disabled:opacity-50',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
