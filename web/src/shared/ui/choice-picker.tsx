import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronsUpDown, ListFilter, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export type ChoicePickerProps = {
  options: string[]
  value: string | string[]
  onChange: (value: string | string[]) => void
  allowMultiple?: boolean
  disabled?: boolean
  placeholder?: string
  className?: string
  size?: 'md' | 'sm'
  allowClear?: boolean
  id?: string
}

function asSelected(value: string | string[], allowMultiple: boolean): string[] {
  if (allowMultiple) {
    return (Array.isArray(value) ? value : value ? [value] : []).map(String)
  }
  if (Array.isArray(value)) return value[0] ? [value[0]] : []
  return value ? [String(value)] : []
}

function displayLabel(selected: string[], allowMultiple: boolean, placeholder: string): string {
  if (!selected.length) return placeholder
  if (!allowMultiple) return selected[0] ?? placeholder
  if (selected.length === 1) return selected[0] ?? placeholder
  if (selected.length === 2) return `${selected[0]}, ${selected[1]}`
  return `${selected[0]} +${selected.length - 1} more`
}

export function ChoicePicker({
  options,
  value,
  onChange,
  allowMultiple = false,
  disabled,
  placeholder = 'Choose an option',
  className,
  size = 'md',
  allowClear = true,
  id,
}: ChoicePickerProps) {
  const reactId = useId()
  const panelId = `${reactId}-panel`
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 320 })
  const selected = asSelected(value, allowMultiple)

  const placePanel = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const width = Math.min(360, Math.max(240, r.width))
    let left = r.left
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8)
    const below = r.bottom + 8
    const panelH = Math.min(320, 56 + options.length * 40)
    const top =
      below + panelH > window.innerHeight - 8 && r.top > panelH
        ? Math.max(8, r.top - panelH - 8)
        : below
    setPos({ top, left, width })
  }, [options.length])

  useEffect(() => {
    if (!open) return
    placePanel()
    const onWin = () => placePanel()
    window.addEventListener('resize', onWin)
    window.addEventListener('scroll', onWin, true)
    return () => {
      window.removeEventListener('resize', onWin)
      window.removeEventListener('scroll', onWin, true)
    }
  }, [open, placePanel])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function toggleOption(option: string) {
    if (allowMultiple) {
      const next = selected.includes(option)
        ? selected.filter((s) => s !== option)
        : [...selected, option]
      onChange(next)
      return
    }
    onChange(option)
    setOpen(false)
  }

  function onTriggerKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!disabled) {
        placePanel()
        setOpen(true)
      }
    }
  }

  const label = displayLabel(selected, allowMultiple, placeholder)

  const panel: ReactNode = open
    ? createPortal(
        <div
          ref={panelRef}
          id={panelId}
          role="listbox"
          aria-multiselectable={allowMultiple || undefined}
          aria-label="Choices"
          className="fixed z-[200] animate-[ff-rise_0.2s_var(--ease-spring)] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 shadow-[var(--shadow-soft)] backdrop-blur-xl"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-[var(--color-accent-soft)]/90 to-transparent" />
          <div className="relative border-b border-[var(--color-border)]/60 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
              <ListFilter className="h-3.5 w-3.5 text-[var(--color-accent)]" />
              {allowMultiple ? 'Select options' : 'Select an option'}
            </p>
          </div>
          <ul className="max-h-64 overflow-y-auto py-1.5 [scrollbar-width:thin]">
            {options.map((option) => {
              const isOn = selected.includes(option)
              return (
                <li key={option}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isOn}
                    onClick={() => toggleOption(option)}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition',
                      isOn
                        ? 'bg-[var(--color-accent-soft)] font-medium text-[var(--color-accent)]'
                        : 'text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-5 w-5 shrink-0 place-items-center rounded-md border transition',
                        allowMultiple ? 'rounded-md' : 'rounded-full',
                        isOn
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                          : 'border-[var(--color-border)] bg-[var(--color-surface)] text-transparent',
                      )}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span className="min-w-0 flex-1 break-words">{option}</span>
                  </button>
                </li>
              )
            })}
            {!options.length ? (
              <li className="px-3 py-4 text-center text-sm text-[var(--color-ink-muted)]">No options</li>
            ) : null}
          </ul>
          {allowMultiple ? (
            <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)]/60 px-3 py-2.5">
              <p className="text-[11px] text-[var(--color-ink-muted)]">
                {selected.length ? `${selected.length} selected` : 'None selected'}
              </p>
              <button
                type="button"
                className="rounded-xl bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--color-accent-fg)] shadow-sm transition hover:brightness-110"
                onClick={() => setOpen(false)}
              >
                Done
              </button>
            </div>
          ) : null}
        </div>,
        document.body,
      )
    : null

  return (
    <div className={cn('relative min-w-0', className)}>
      <div className="flex items-center gap-1">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          disabled={disabled || !options.length}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => {
            if (disabled || !options.length) return
            placePanel()
            setOpen((v) => !v)
          }}
          onKeyDown={onTriggerKey}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-left shadow-sm transition-all duration-200',
            'hover:border-[var(--color-accent)]/35 focus-visible:border-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-accent)]/15',
            size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-10 px-3 text-sm',
            (disabled || !options.length) && 'cursor-not-allowed opacity-50',
            open && 'border-[var(--color-accent)] ring-4 ring-[var(--color-accent)]/15',
          )}
        >
          <ListFilter
            className={cn('shrink-0 text-[var(--color-accent)]', size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4')}
          />
          <span
            className={cn(
              'min-w-0 flex-1 truncate',
              selected.length ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-muted)]',
            )}
          >
            {label}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-[var(--color-ink-muted)]" />
        </button>
        {allowClear && selected.length && !disabled ? (
          <button
            type="button"
            className="rounded-lg p-1.5 text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
            aria-label="Clear"
            onClick={() => onChange(allowMultiple ? [] : '')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {panel}
    </div>
  )
}
