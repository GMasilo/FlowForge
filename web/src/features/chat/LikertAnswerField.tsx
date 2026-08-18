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
            'rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition',
            'hover:border-teal-300 hover:bg-teal-50 hover:text-teal-900 disabled:opacity-50',
          )}
        >
          {choice}
        </button>
      ))}
    </div>
  )
}
