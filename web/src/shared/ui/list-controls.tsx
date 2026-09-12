import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Select } from '@/shared/ui/select'
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
        'flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)]/70 px-3 py-2 text-sm text-[var(--color-ink)]',
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

export const DEFAULT_PAGE_SIZE_OPTIONS = [12, 24, 48] as const

export function clampPage(page: number, pageCount: number): number {
  if (pageCount <= 0) return 1
  return Math.min(Math.max(1, page), pageCount)
}

export function pageCountFor(total: number, pageSize: number): number {
  if (total <= 0 || pageSize <= 0) return 1
  return Math.max(1, Math.ceil(total / pageSize))
}

export function slicePage<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (Math.max(1, page) - 1) * pageSize
  return items.slice(start, start + pageSize)
}

export function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  className,
  label = 'items',
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: readonly number[]
  className?: string
  label?: string
}) {
  const pageCount = pageCountFor(total, pageSize)
  const safePage = clampPage(page, pageCount)
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1
  const to = Math.min(total, safePage * pageSize)

  if (total <= 0) return null

  return (
    <div
      className={cn(
        'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className="text-xs text-[var(--color-ink-muted)]">
        Showing <span className="font-medium tabular-nums text-[var(--color-ink)]">{from}</span>
        {'–'}
        <span className="font-medium tabular-nums text-[var(--color-ink)]">{to}</span>
        {' of '}
        <span className="font-medium tabular-nums text-[var(--color-ink)]">{total}</span>
        {` ${label}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {onPageSizeChange ? (
          <label className="inline-flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)]">
            <span className="whitespace-nowrap">Per page</span>
            <Select
              aria-label="Items per page"
              className="h-8 w-[4.5rem] py-1 text-xs"
              value={String(pageSize)}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
        <div className="inline-flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 px-2"
            disabled={safePage <= 1}
            aria-label="Previous page"
            onClick={() => onPageChange(safePage - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[5.5rem] text-center text-xs font-medium tabular-nums text-[var(--color-ink)]">
            {safePage} / {pageCount}
          </span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 px-2"
            disabled={safePage >= pageCount}
            aria-label="Next page"
            onClick={() => onPageChange(safePage + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Progressive reveal: show `batchSize` at a time, append on demand. Resets when `resetKey` changes. */
export function useLazyReveal(total: number, batchSize: number, resetKey?: string | number) {
  const [visibleCount, setVisibleCount] = useState(() => Math.max(1, batchSize))

  useEffect(() => {
    setVisibleCount(Math.max(1, batchSize))
  }, [batchSize, resetKey])

  useEffect(() => {
    setVisibleCount((prev) => {
      if (total <= 0) return Math.max(1, batchSize)
      return Math.min(Math.max(prev, batchSize), total)
    })
  }, [total, batchSize])

  const shown = total <= 0 ? 0 : Math.min(visibleCount, total)
  const hasMore = shown < total

  function loadMore() {
    setVisibleCount((prev) => Math.min(prev + Math.max(1, batchSize), Math.max(total, 0)))
  }

  return { visibleCount: shown, hasMore, loadMore }
}

export function LazyLoadSentinel({
  enabled,
  onVisible,
  observeKey,
  rootMargin = '240px',
  className,
}: {
  enabled: boolean
  onVisible: () => void
  /** Change when content grows so a still-visible sentinel can fire again. */
  observeKey?: string | number
  rootMargin?: string
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const onVisibleRef = useRef(onVisible)
  onVisibleRef.current = onVisible

  useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el) return
    let cancelled = false
    const observer = new IntersectionObserver(
      (entries) => {
        if (cancelled) return
        if (entries.some((entry) => entry.isIntersecting)) onVisibleRef.current()
      },
      { root: null, rootMargin, threshold: 0 },
    )
    observer.observe(el)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [enabled, rootMargin, observeKey])

  if (!enabled) return null
  return <div ref={ref} className={cn('h-px w-full', className)} aria-hidden />
}

export function LazyLoadBar({
  shown,
  total,
  batchSize,
  hasMore,
  onLoadMore,
  onBatchSizeChange,
  batchSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  className,
  label = 'items',
}: {
  shown: number
  total: number
  batchSize: number
  hasMore: boolean
  onLoadMore: () => void
  onBatchSizeChange?: (batchSize: number) => void
  batchSizeOptions?: readonly number[]
  className?: string
  label?: string
}) {
  if (total <= 0) return null

  return (
    <div
      className={cn(
        'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className="text-xs text-[var(--color-ink-muted)]">
        Showing <span className="font-medium tabular-nums text-[var(--color-ink)]">{shown}</span>
        {' of '}
        <span className="font-medium tabular-nums text-[var(--color-ink)]">{total}</span>
        {` ${label}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {onBatchSizeChange ? (
          <label className="inline-flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)]">
            <span className="whitespace-nowrap">Batch</span>
            <Select
              aria-label="Items per load"
              className="h-8 w-[4.5rem] py-1 text-xs"
              value={String(batchSize)}
              onChange={(e) => onBatchSizeChange(Number(e.target.value))}
            >
              {batchSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
        {hasMore ? (
          <Button type="button" size="sm" variant="secondary" className="h-8" onClick={onLoadMore}>
            Load more
          </Button>
        ) : null}
      </div>
    </div>
  )
}
