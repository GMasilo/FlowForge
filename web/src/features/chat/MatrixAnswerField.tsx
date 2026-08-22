import { useMemo, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

export function MatrixAnswerField({
  rows,
  scale,
  disabled,
  className,
  onSubmit,
}: {
  rows: string[]
  scale: string[]
  disabled?: boolean
  className?: string
  onSubmit: (value: Record<string, string>) => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const complete = useMemo(
    () => rows.length > 0 && rows.every((row) => !!values[row]),
    [rows, values],
  )

  if (!rows.length) {
    return <p className="text-sm text-[var(--color-ink-muted)]">No matrix rows are configured.</p>
  }

  return (
    <div className={cn('flex min-w-0 flex-1 flex-col gap-2', className)}>
      <div className="ff-hide-scrollbar overflow-x-auto">
        <table className="w-full min-w-[280px] border-separate border-spacing-y-1 text-left text-xs">
          <thead>
            <tr>
              <th className="px-2 py-1 font-medium text-[var(--color-ink-muted)]"> </th>
              {scale.map((col) => (
                <th key={col} className="px-1 py-1 text-center font-medium text-[var(--color-ink-muted)]">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row} className="rounded-xl bg-[var(--color-surface-2)]">
                <th className="whitespace-nowrap px-2 py-2 text-sm font-semibold text-[var(--color-ink)]">{row}</th>
                {scale.map((col) => (
                  <td key={col} className="px-1 py-2 text-center">
                    <input
                      type="radio"
                      name={`matrix-${row}`}
                      value={col}
                      disabled={disabled}
                      checked={values[row] === col}
                      onChange={() => setValues((prev) => ({ ...prev, [row]: col }))}
                      aria-label={`${row}: ${col}`}
                      className="h-4 w-4 accent-[var(--color-accent)]"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        type="button"
        className="h-11 self-end rounded-2xl"
        disabled={disabled || !complete}
        onClick={() => onSubmit(values)}
      >
        Send
      </Button>
    </div>
  )
}
