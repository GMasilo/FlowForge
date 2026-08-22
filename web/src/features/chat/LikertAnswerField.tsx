import { cn } from '@/shared/lib/utils'

export function LikertAnswerField({
  choices,
  disabled,
  className,
  onSelect,
}: {
  choices: string[]
  disabled?: boolean
  className?: string
  onSelect: (value: string) => void
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)} role="group" aria-label="Agreement scale">
      {choices.map((choice, index) => (
        <button
          key={`${index}-${choice}`}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(choice)}
          className={cn(
            'rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-left text-sm font-medium text-[var(--color-ink)] transition',
            'hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent)] disabled:opacity-50',
          )}
        >
          {choice}
        </button>
      ))}
    </div>
  )
}
