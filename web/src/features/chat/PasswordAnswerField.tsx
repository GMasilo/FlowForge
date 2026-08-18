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
        'h-11 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 text-sm outline-none transition',
        'focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-500/15',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    />
  )
}
