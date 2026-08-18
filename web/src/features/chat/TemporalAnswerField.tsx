import {
  DateTimePicker,
  dateTimeModeForAnswerType,
  type DateTimeMode,
} from '@/shared/ui/date-time-picker'
import { cn } from '@/shared/lib/utils'

/**
 * Date / time / datetime answer control shared by Preview and end-user chat.
 * Emits the same canonical strings as native inputs:
 * - date: YYYY-MM-DD
 * - time: HH:mm
 * - datetime: YYYY-MM-DDTHH:mm
 */
export function TemporalAnswerField({
  answerType,
  value,
  onChange,
  min,
  max,
  disabled,
  className,
  variant = 'chat',
}: {
  answerType: string
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  disabled?: boolean
  className?: string
  /** `chat` is taller/rounded for bubble UI; `form` matches inspector fields. */
  variant?: 'chat' | 'form'
}) {
  const mode: DateTimeMode | null = dateTimeModeForAnswerType(answerType)
  if (!mode) return null

  return (
    <DateTimePicker
      mode={mode}
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      disabled={disabled}
      allowClear={variant === 'form'}
      size={variant === 'form' ? 'sm' : 'md'}
      className={cn(
        variant === 'chat' &&
          '[&_button]:!h-11 [&_button]:!rounded-2xl [&_button]:!border-slate-200 [&_button]:!bg-slate-50',
        className,
      )}
    />
  )
}

export { dateTimeModeForAnswerType }
export type { DateTimeMode }
