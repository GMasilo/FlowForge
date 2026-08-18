import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

export function RankingAnswerField({
  items,
  disabled,
  className,
  onSubmit,
}: {
  items: string[]
  disabled?: boolean
  className?: string
  onSubmit: (order: string[]) => void
}) {
  const [order, setOrder] = useState(items)

  useEffect(() => {
    setOrder(items)
  }, [items.join('\0')])

  function move(index: number, dir: -1 | 1) {
    const next = [...order]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    const tmp = next[index]!
    next[index] = next[target]!
    next[target] = tmp
    setOrder(next)
  }

  if (!items.length) {
    return <p className="text-sm text-slate-500">No items are configured to rank.</p>
  }

  return (
    <div className={cn('flex min-w-0 flex-1 flex-col gap-2', className)}>
      <ol className="space-y-1.5">
        {order.map((item, index) => (
          <li
            key={`${item}-${index}`}
            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-1.5"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-xs font-semibold text-teal-800 ring-1 ring-slate-200">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 text-sm font-medium text-slate-800">{item}</span>
            <div className="flex flex-col">
              <button
                type="button"
                disabled={disabled || index === 0}
                aria-label={`Move ${item} up`}
                className="rounded-md p-0.5 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30"
                onClick={() => move(index, -1)}
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={disabled || index === order.length - 1}
                aria-label={`Move ${item} down`}
                className="rounded-md p-0.5 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30"
                onClick={() => move(index, 1)}
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ol>
      <Button type="button" className="h-11 self-end rounded-2xl" disabled={disabled} onClick={() => onSubmit(order)}>
        Send
      </Button>
    </div>
  )
}
