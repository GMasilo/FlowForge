import { Search, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { cn } from '@/shared/lib/utils'

export function SearchField({
  value,
  onChange,
  placeholder = 'Search…',
  className,
  id,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  id?: string
}) {
  return (
    <div className={cn('relative min-w-[12rem] flex-1', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-muted)]" />
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-9"
        type="search"
        autoComplete="off"
      />
      {value ? (
        <button
          type="button"
          className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
          aria-label="Clear search"
          onClick={() => onChange('')}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  )
}

export function BulkActionBar({
  count,
  onClear,
  children,
  className,
}: {
  count: number
  onClear: () => void
  children: ReactNode
  className?: string
}) {
  if (count <= 0) return null
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-accent)]/25 bg-[var(--color-accent-soft)]/70 px-3 py-2 text-sm text-[var(--color-accent)]',
        className,
      )}
      role="status"
    >
      <span className="font-medium tabular-nums">{count} selected</span>
      <Button type="button" variant="ghost" size="sm" onClick={onClear}>
        Clear
      </Button>
      <span className="hidden h-4 w-px bg-[var(--color-accent)]/40 sm:block" />
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

export function RowCheckbox({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  className?: string
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={label}
      className={cn(
        'mt-1 h-4 w-4 shrink-0 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]/30',
        className,
      )}
    />
  )
}

export function matchesQuery(query: string, parts: Array<string | null | undefined>): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return parts.some((p) => (p ?? '').toLowerCase().includes(q))
}

export function toggleId(selected: Set<string>, id: string, on: boolean): Set<string> {
  const next = new Set(selected)
  if (on) next.add(id)
  else next.delete(id)
  return next
}

export function setAllIds(ids: string[], on: boolean): Set<string> {
  return on ? new Set(ids) : new Set()
}
