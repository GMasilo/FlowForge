import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export function ThumbsAnswerField({
  disabled,
  className,
  onSelect,
}: {
  disabled?: boolean
  className?: string
  onSelect: (value: 'up' | 'down') => void
}) {
  return (
    <div className={cn('flex gap-2', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect('up')}
        className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[var(--color-accent)]/25 bg-[var(--color-accent-soft)]/80 px-3 py-3 text-sm font-semibold text-[var(--color-accent)] transition hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-accent-soft)] disabled:opacity-50"
      >
        <ThumbsUp className="h-4 w-4" />
        Up
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect('down')}
        className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-3 text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-border)] hover:bg-[var(--color-surface-2)] disabled:opacity-50"
      >
        <ThumbsDown className="h-4 w-4" />
        Down
      </button>
    </div>
  )
}
