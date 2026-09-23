import { useEffect, useState } from 'react'
import { Button } from './button'
import { Select } from './select'

export function useTablePagination<T>(rows: T[], resetKey: string) {
  const [state, setState] = useState({ key: resetKey, page: 0, size: 10 })
  const pages = Math.max(1, Math.ceil(rows.length / state.size))
  const page = state.key === resetKey ? Math.min(state.page, pages - 1) : 0
  useEffect(() => {
    setState(old => old.key !== resetKey ? { ...old, key: resetKey, page: 0 } : old.page >= pages ? { ...old, page: pages - 1 } : old)
  }, [resetKey, pages])
  return {
    rows: rows.slice(page * state.size, (page + 1) * state.size),
    page, pages, size: state.size, total: rows.length,
    setPage: (next: number) => setState(old => ({ ...old, key: resetKey, page: Math.max(0, Math.min(next, pages - 1)) })),
    setSize: (size: number) => setState({ key: resetKey, page: 0, size }),
  }
}

type Props = { label: string; page: number; pages: number; size: number; total: number; setPage: (page: number) => void; setSize: (size: number) => void }
export function TablePagination({ label, page, pages, size, total, setPage, setSize }: Props) {
  return <nav aria-label={`${label} pagination`} className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-ink-muted)]">
    <span aria-live="polite">{total ? `${page * size + 1}–${Math.min((page + 1) * size, total)} of ${total}` : '0 rows'}</span>
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2">Rows per page<Select aria-label={`${label} rows per page`} className="h-8 w-20" value={size} onChange={e => setSize(Number(e.target.value))}>{[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}</Select></label>
      <Button size="sm" variant="secondary" aria-label={`${label} previous page`} disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
      <span>Page {page + 1} of {pages}</span>
      <Button size="sm" variant="secondary" aria-label={`${label} next page`} disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button>
    </div>
  </nav>
}
