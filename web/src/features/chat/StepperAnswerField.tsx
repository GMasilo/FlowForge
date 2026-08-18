import { useEffect } from 'react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export function StepperAnswerField({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  required,
  disabled,
  className,
}: {
  value: string
  onChange: (value: string) => void
  min?: number
  max?: number
  step?: number
  required?: boolean
  disabled?: boolean
  className?: string
}) {
  const start = Math.min(min, max)
  const end = Math.max(min, max)
  const stride = step > 0 ? step : 1
  const parsed = Number(value)
  const current = Number.isFinite(parsed) ? Math.min(end, Math.max(start, parsed)) : start

  useEffect(() => {
    if (!value && !disabled) onChange(String(start))
  }, [value, disabled, start, onChange])

  function nudge(delta: number) {
    const next = Math.min(end, Math.max(start, current + delta))
    // Avoid floating noise for decimal steps
    const rounded = Math.round(next / stride) * stride
    const clamped = Math.min(end, Math.max(start, Number(rounded.toFixed(6))))
    onChange(String(clamped))
  }

  return (
    <div className={cn('flex min-w-0 flex-1 items-center gap-2', className)}>
      <button
        type="button"
        disabled={disabled || current <= start}
        aria-label="Decrease"
        onClick={() => nudge(-stride)}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 disabled:opacity-40"
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        type="number"
        disabled={disabled}
        required={required}
        min={start}
        max={end}
        step={stride}
        value={current}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-center text-sm font-semibold tabular-nums outline-none transition focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-500/15"
      />
      <button
        type="button"
        disabled={disabled || current >= end}
        aria-label="Increase"
        onClick={() => nudge(stride)}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}
