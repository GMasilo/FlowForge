import { ChoicePicker } from '@/shared/ui/choice-picker'
import { cn } from '@/shared/lib/utils'

/**
 * Choice / gender answer control shared by Preview and end-user chat.
 * Popover list — not inline chips.
 */
export function ChoiceAnswerField({
  choices,
  value,
  onChange,
  allowMultiple = false,
  disabled,
  className,
  variant = 'chat',
}: {
  choices: string[]
  value: string | string[]
  onChange: (value: string | string[]) => void
  allowMultiple?: boolean
  disabled?: boolean
  className?: string
  variant?: 'chat' | 'form'
}) {
  return (
    <ChoicePicker
      options={choices}
      value={value}
      onChange={onChange}
      allowMultiple={allowMultiple}
      disabled={disabled}
      allowClear={variant === 'form' || allowMultiple}
      size={variant === 'form' ? 'sm' : 'md'}
      placeholder={allowMultiple ? 'Choose options' : 'Choose an option'}
      className={cn(
        variant === 'chat' &&
          '[&_button]:!h-11 [&_button]:!rounded-2xl [&_button]:!border-slate-200 [&_button]:!bg-slate-50',
        className,
      )}
    />
  )
}
