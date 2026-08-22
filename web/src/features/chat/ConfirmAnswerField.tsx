import { cn } from '@/shared/lib/utils'

export function ConfirmAnswerField({
  checked,
  onCheckedChange,
  label = 'I agree',
  disabled,
  required,
  className,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  required?: boolean
  className?: string
}) {
  return (
    <label
      className={cn(
        'flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-3 transition',
        'hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-accent-soft)]/40',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <input
        type="checkbox"
        disabled={disabled}
        required={required}
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]/30"
      />
      <span className="text-sm leading-snug text-[var(--color-ink)]">{label}</span>
    </label>
  )
}
