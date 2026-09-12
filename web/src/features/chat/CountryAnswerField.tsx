import { CountryPicker } from '@/shared/ui/country-picker'
import { cn } from '@/shared/lib/utils'

/**
 * Country answer control shared by Preview and end-user chat.
 * Shows full name, stores ISO alpha-2 when known; allows custom values.
 */
export function CountryAnswerField({
  value,
  onChange,
  disabled,
  className,
  variant = 'chat',
  allowCustom = true,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  variant?: 'chat' | 'form'
  allowCustom?: boolean
}) {
  return (
    <CountryPicker
      value={value}
      onChange={onChange}
      disabled={disabled}
      allowClear={variant === 'form'}
      allowCustom={allowCustom}
      size={variant === 'form' ? 'sm' : 'md'}
      placeholder="Select a country"
      className={cn(
        variant === 'chat' &&
          '[&_button]:!h-11 [&_button]:!rounded-2xl [&_button]:!border-[var(--color-border)] [&_button]:!bg-[var(--color-surface-2)]',
        className,
      )}
    />
  )
}
