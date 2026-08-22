import { cn } from '@/shared/lib/utils'

export function PasswordAnswerField({
  value,
  onChange,
  disabled,
  className,
  required,
  minLength,
  maxLength,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  required?: boolean
  minLength?: number
  maxLength?: number
}) {
  return (
    <input
      type="password"
      autoComplete="new-password"
      spellCheck={false}
      disabled={disabled}
      required={required}
      minLength={minLength}
      maxLength={maxLength}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Enter a password"
      aria-label="Password"
      className={cn(
        'h-11 min-w-0 flex-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 text-sm outline-none transition',
        'focus:border-[var(--color-accent)] focus:bg-[var(--color-surface)] focus:ring-4 focus:ring-[var(--color-accent)]/15',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    />
  )
}
