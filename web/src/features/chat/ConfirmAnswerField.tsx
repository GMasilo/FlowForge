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
        'flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 transition',
        'hover:border-teal-300 hover:bg-teal-50/40',
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
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500/30"
      />
      <span className="text-sm leading-snug text-slate-700">{label}</span>
    </label>
  )
}
