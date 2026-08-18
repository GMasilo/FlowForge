import { useEffect } from 'react'
import { cn } from '@/shared/lib/utils'

/**
 * Slider answer control shared by Preview and end-user chat.
 * Emits the current numeric value as a string; parent submits via Send.
 */
export function SliderAnswerField({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  minLabel,
  maxLabel,
  suffix,
  required,
  disabled,
  className,
}: {
  value: string
  onChange: (value: string) => void
  min?: number
  max?: number
  step?: number
  minLabel?: string
  maxLabel?: string
  /** Optional unit shown after the current value (e.g. %). */
  suffix?: string
  required?: boolean
  disabled?: boolean
  className?: string
}) {
  const lo = Number.isFinite(min) ? min : 0
  const hi = Number.isFinite(max) ? max : 100
  const start = Math.min(lo, hi)
  const end = Math.max(lo, hi)
  const mid = Math.round((start + end) / 2)
  const parsed = Number(value)
  const current = Number.isFinite(parsed)
    ? Math.min(end, Math.max(start, parsed))
    : mid

  useEffect(() => {
    if (!value && !disabled) onChange(String(mid))
  }, [value, disabled, mid, onChange])

  const pct = end === start ? 0 : ((current - start) / (end - start)) * 100

  return (
    <div className={cn('flex min-w-0 flex-1 flex-col gap-2 px-0.5', className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium text-slate-500">
          {minLabel?.trim() || `${start}${suffix ?? ''}`}
        </span>
        <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-sm font-semibold tabular-nums text-teal-800 ring-1 ring-teal-200/80">
          {current}
          {suffix ?? ''}
        </span>
        <span className="text-[11px] font-medium text-slate-500">
          {maxLabel?.trim() || `${end}${suffix ?? ''}`}
        </span>
      </div>
      <input
        type="range"
        min={start}
        max={end}
        step={step > 0 ? step : 1}
        disabled={disabled}
        required={required}
        value={current}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Slider value"
        className={cn(
          'h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-teal-600',
          'disabled:cursor-not-allowed disabled:opacity-50',
          '[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none',
          '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-teal-600',
          '[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:ring-2 [&::-webkit-slider-thumb]:ring-white',
        )}
        style={{
          background: `linear-gradient(to right, rgb(13 148 136) ${pct}%, rgb(226 232 240) ${pct}%)`,
        }}
      />
    </div>
  )
}
