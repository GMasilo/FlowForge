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
        className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-teal-200 bg-teal-50/80 px-3 py-3 text-sm font-semibold text-teal-800 transition hover:border-teal-400 hover:bg-teal-100 disabled:opacity-50"
      >
        <ThumbsUp className="h-4 w-4" />
        Up
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect('down')}
        className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:opacity-50"
      >
        <ThumbsDown className="h-4 w-4" />
        Down
      </button>
    </div>
  )
}
