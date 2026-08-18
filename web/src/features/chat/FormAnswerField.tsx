import { useMemo, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'
import { PhoneAnswerField } from '@/features/chat/PhoneAnswerField'
import { TemporalAnswerField } from '@/features/chat/TemporalAnswerField'
import { readFormFields, type FormFieldDef, type FormFieldType } from '@/features/designer/model/flowSchema'

const INPUT_CLASS =
  'h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-500/15 disabled:cursor-not-allowed disabled:opacity-50'

function inputTypeFor(type: FormFieldType): string {
  if (type === 'email') return 'email'
  if (type === 'number') return 'number'
  if (type === 'url') return 'url'
  return 'text'
}

function FormFieldControl({
  field,
  value,
  disabled,
  onChange,
}: {
  field: FormFieldDef
  value: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  if (field.type === 'phone') {
    return (
      <PhoneAnswerField
        variant="form"
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={field.required !== false}
      />
    )
  }
  if (field.type === 'date') {
    return (
      <TemporalAnswerField
        variant="form"
        answerType="date"
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    )
  }
  if (field.type === 'long_text') {
    return (
      <textarea
        rows={3}
        disabled={disabled}
        required={field.required !== false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.label}
        aria-label={field.label}
        className={cn(INPUT_CLASS, 'h-auto min-h-[72px] resize-none py-2')}
      />
    )
  }
  return (
    <input
      type={inputTypeFor(field.type)}
      inputMode={field.type === 'number' ? 'decimal' : undefined}
      disabled={disabled}
      required={field.required !== false}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.label}
      aria-label={field.label}
      autoComplete={field.type === 'email' ? 'email' : field.type === 'name' ? 'name' : 'off'}
      className={INPUT_CLASS}
    />
  )
}

export function FormAnswerField({
  config,
  disabled,
  className,
  onSubmit,
}: {
  config: Record<string, unknown>
  disabled?: boolean
  className?: string
  onSubmit: (value: Record<string, string>) => void
}) {
  const fields = useMemo(() => readFormFields(config), [config])
  const [values, setValues] = useState<Record<string, string>>({})

  if (!fields.length) {
    return <p className="text-sm text-slate-500">No form fields are configured.</p>
  }

  function setField(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function submit() {
    const out: Record<string, string> = {}
    for (const field of fields) {
      out[field.key] = (values[field.key] ?? '').trim()
    }
    onSubmit(out)
  }

  return (
    <form
      className={cn('flex min-w-0 flex-1 flex-col gap-2.5', className)}
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      {fields.map((field) => (
        <div key={field.key} className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">
            {field.label}
            {field.required !== false ? <span className="text-rose-500"> *</span> : null}
          </span>
          <FormFieldControl
            field={field}
            value={values[field.key] ?? ''}
            disabled={disabled}
            onChange={(value) => setField(field.key, value)}
          />
        </div>
      ))}
      <Button type="submit" className="h-11 self-end rounded-2xl" disabled={disabled}>
        Send
      </Button>
    </form>
  )
}
