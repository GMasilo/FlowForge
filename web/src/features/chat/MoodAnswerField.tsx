import { DEFAULT_MOOD_OPTIONS } from '@/features/designer/model/flowSchema'
import { cn } from '@/shared/lib/utils'

export function MoodAnswerField({
  disabled,
  className,
  onSelect,
}: {
  disabled?: boolean
  className?: string
  onSelect: (value: string) => void
}) {
  return (
    <div className={cn('flex flex-wrap justify-center gap-1.5', className)} role="group" aria-label="Mood">
      {DEFAULT_MOOD_OPTIONS.map((mood) => (
        <button
          key={mood.value}
          type="button"
          disabled={disabled}
          title={mood.label}
          aria-label={mood.label}
          onClick={() => onSelect(mood.value)}
          className={cn(
            'grid h-12 w-12 place-items-center rounded-2xl border border-slate-200 bg-white text-2xl transition',
            'hover:border-teal-300 hover:bg-teal-50 active:scale-95 disabled:opacity-50',
          )}
        >
          <span aria-hidden>{mood.emoji}</span>
        </button>
      ))}
    </div>
  )
}
