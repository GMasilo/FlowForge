import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

type RankRow = { id: string; label: string }

function toRows(items: string[]): RankRow[] {
  return items.map((label, index) => ({
    id: `rank-${index}-${label}`,
    label,
  }))
}

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
  const [rows, setRows] = useState<RankRow[]>(() => toRows(items))
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  useEffect(() => {
    setRows(toRows(items))
    setDragId(null)
    setOverId(null)
  }, [items.join('\0')])

  function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= rows.length) return
    setRows((prev) => {
      const next = [...prev]
      const tmp = next[index]!
      next[index] = next[target]!
      next[target] = tmp
      return next
    })
  }

  function reorder(fromId: string, toId: string) {
    if (fromId === toId) return
    setRows((prev) => {
      const from = prev.findIndex((r) => r.id === fromId)
      const to = prev.findIndex((r) => r.id === toId)
      if (from < 0 || to < 0 || from === to) return prev
      const next = [...prev]
      const [item] = next.splice(from, 1)
      if (!item) return prev
      next.splice(to, 0, item)
      return next
    })
  }

  if (!items.length) {
    return <p className="text-sm text-slate-500">No items are configured to rank.</p>
  }

  return (
    <div className={cn('flex min-w-0 flex-1 flex-col gap-2', className)}>
      <p className="text-[11px] text-slate-500">Drag to reorder, or use the arrows.</p>
      <ol className="space-y-1.5">
        {rows.map((row, index) => {
          const dragging = dragId === row.id
          const dropTarget = overId === row.id && dragId != null && dragId !== row.id
          return (
            <li
              key={row.id}
              draggable={!disabled}
              onDragStart={(e) => {
                if (disabled) return
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', row.id)
                setDragId(row.id)
              }}
              onDragOver={(e) => {
                if (disabled || dragId == null) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                if (overId !== row.id) setOverId(row.id)
              }}
              onDragLeave={() => {
                if (overId === row.id) setOverId(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (disabled) return
                const fromId = e.dataTransfer.getData('text/plain') || dragId
                if (!fromId) return
                reorder(fromId, row.id)
                setDragId(null)
                setOverId(null)
              }}
              onDragEnd={() => {
                setDragId(null)
                setOverId(null)
              }}
              className={cn(
                'flex items-center gap-2 rounded-2xl border bg-slate-50 px-2 py-1.5 transition',
                dragging ? 'border-teal-300 opacity-60' : 'border-slate-200',
                dropTarget ? 'border-teal-400 bg-teal-50/80 ring-1 ring-teal-200' : null,
                disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
              )}
            >
              <span className="grid h-7 w-5 shrink-0 place-items-center text-slate-400" aria-hidden>
                <GripVertical className="h-4 w-4" />
              </span>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-xs font-semibold text-teal-800 ring-1 ring-slate-200">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium text-slate-800">{row.label}</span>
              <div className="flex flex-col">
                <button
                  type="button"
                  disabled={disabled || index === 0}
                  aria-label={`Move ${row.label} up`}
                  className="rounded-md p-0.5 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30"
                  onClick={() => move(index, -1)}
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={disabled || index === rows.length - 1}
                  aria-label={`Move ${row.label} down`}
                  className="rounded-md p-0.5 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30"
                  onClick={() => move(index, 1)}
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </li>
          )
        })}
      </ol>
      <Button
        type="button"
        className="h-11 self-end rounded-2xl"
        disabled={disabled}
        onClick={() => onSubmit(rows.map((r) => r.label))}
      >
        Send
      </Button>
    </div>
  )
}
