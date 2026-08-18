import { useMemo, useState } from 'react'
import { cn } from '@/shared/lib/utils'
import { ChoiceAnswerField } from '@/features/chat/ChoiceAnswerField'

export function AutocompleteAnswerField({
  choices,
  value,
  onChange,
  allowMultiple = false,
  disabled,
  className,
}: {
  choices: string[]
  value: string | string[]
  onChange: (value: string | string[]) => void
  allowMultiple?: boolean
  disabled?: boolean
  className?: string
}) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return choices
    return choices.filter((c) => c.toLowerCase().includes(q))
  }, [choices, query])

  return (
    <div className={cn('flex min-w-0 flex-1 flex-col gap-2', className)}>
      <input
        type="search"
        disabled={disabled}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search…"
        className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 text-sm outline-none focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-500/15"
      />
      <ChoiceAnswerField
        choices={filtered}
        value={value}
        onChange={onChange}
        allowMultiple={allowMultiple}
        disabled={disabled}
      />
    </div>
  )
}
