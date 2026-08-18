import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'
import { calendarDateString, clockTimeString } from '@/features/designer/model/flowSchema'
import { TemporalAnswerField } from '@/features/chat/TemporalAnswerField'

export function AppointmentAnswerField({
  minDate,
  maxDate,
  disabled,
  className,
  onSubmit,
}: {
  minDate?: string
  maxDate?: string
  disabled?: boolean
  className?: string
  onSubmit: (value: { date: string; time: string }) => void
}) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')

  const timeMin = date && date === calendarDateString() ? clockTimeString() : undefined

  return (
    <div className={cn('flex min-w-0 flex-1 flex-col gap-2', className)}>
      <TemporalAnswerField
        answerType="date"
        value={date}
        onChange={(next) => {
          setDate(next)
          if (next !== date) setTime('')
        }}
        min={minDate && minDate > calendarDateString() ? minDate : calendarDateString()}
        max={maxDate}
        disabled={disabled}
      />
      <TemporalAnswerField
        answerType="time"
        value={time}
        onChange={setTime}
        min={timeMin}
        disabled={disabled}
      />
      <Button
        type="button"
        className="h-11 self-end rounded-2xl"
        disabled={disabled || !date || !time}
        onClick={() => onSubmit({ date, time })}
      >
        Send
      </Button>
    </div>
  )
}
