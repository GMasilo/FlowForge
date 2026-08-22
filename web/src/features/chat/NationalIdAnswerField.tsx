import { cn } from '@/shared/lib/utils'

export function NationalIdAnswerField({
  value,
  onChange,
  format = 'za',
  disabled,
  className,
  required,
}: {
  value: string
  onChange: (value: string) => void
  format?: 'za' | 'any'
  disabled?: boolean
  className?: string
  required?: boolean
}) {
  const digits = value.replace(/\D/g, '')
  const max = format === 'za' ? 13 : 20

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      disabled={disabled}
      required={required}
      value={digits}
      maxLength={max}
      placeholder={format === 'za' ? '13-digit SA ID' : 'ID number'}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, max))}
      aria-label="National ID"
      className={cn(
        'h-11 min-w-0 flex-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 font-mono text-sm outline-none transition',
        'focus:border-[var(--color-accent)] focus:bg-[var(--color-surface)] focus:ring-4 focus:ring-[var(--color-accent)]/15',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    />
  )
}
