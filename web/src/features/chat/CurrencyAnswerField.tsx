import { cn } from '@/shared/lib/utils'

export function CurrencyAnswerField({
  value,
  onChange,
  currencyCode = 'ZAR',
  min = 0,
  max,
  step = 0.01,
  required,
  disabled,
  className,
}: {
  value: string
  onChange: (value: string) => void
  currencyCode?: string
  min?: number
  max?: number
  step?: number
  required?: boolean
  disabled?: boolean
  className?: string
}) {
  const code = currencyCode.trim().toUpperCase() || 'ZAR'
  let symbol = code
  try {
    symbol =
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: code,
        currencyDisplay: 'narrowSymbol',
      })
        .formatToParts(0)
        .find((p) => p.type === 'currency')?.value ?? code
  } catch {
    symbol = code
  }

  return (
    <div className={cn('relative min-w-0 flex-1', className)}>
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm font-semibold text-[var(--color-ink-muted)]">
        {symbol}
      </span>
      <input
        type="number"
        inputMode="decimal"
        disabled={disabled}
        required={required}
        min={min}
        max={max}
        step={step > 0 ? step : 0.01}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.00"
        aria-label={`Amount in ${code}`}
        className={cn(
          'h-11 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] py-2 pr-3 pl-10 text-sm outline-none transition',
          'focus:border-[var(--color-accent)] focus:bg-[var(--color-surface)] focus:ring-4 focus:ring-[var(--color-accent)]/15',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      />
    </div>
  )
}
