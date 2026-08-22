import { useEffect } from 'react'
import { cn } from '@/shared/lib/utils'

const DEFAULT_COLOR = '#14b8a6'

/**
 * Color picker answer control. Emits a hex string; parent submits via Send.
 */
export function ColorAnswerField({
  value,
  onChange,
  disabled,
  className,
  required,
  pattern = '#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})',
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  required?: boolean
  pattern?: string
}) {
  const hex = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : DEFAULT_COLOR
  const pickerValue =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex

  useEffect(() => {
    if (!value && !disabled) onChange(DEFAULT_COLOR)
  }, [value, disabled, onChange])

  return (
    <div className={cn('flex min-w-0 flex-1 items-center gap-2', className)}>
      <label
        className={cn(
          'relative grid h-11 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-[var(--color-border)] shadow-sm',
          disabled && 'opacity-50',
        )}
        style={{ background: hex }}
        title="Pick a color"
      >
        <input
          type="color"
          disabled={disabled}
          value={pickerValue}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
          aria-label="Color picker"
        />
      </label>
      <input
        type="text"
        disabled={disabled}
        required={required}
        pattern={pattern}
        value={value || hex}
        spellCheck={false}
        autoCapitalize="none"
        onChange={(e) => onChange(e.target.value.trim())}
        placeholder="#14b8a6"
        aria-label="Color hex"
        className={cn(
          'h-11 min-w-0 flex-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 font-mono text-sm outline-none transition',
          'focus:border-[var(--color-accent)] focus:bg-[var(--color-surface)] focus:ring-4 focus:ring-[var(--color-accent)]/15',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      />
    </div>
  )
}
