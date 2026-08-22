import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronsUpDown, Globe2, Search, X } from 'lucide-react'
import {
  countryDisplayLabel,
  filterCountries,
  findCountry,
  type CountryOption,
} from '@/shared/lib/countries'
import { cn } from '@/shared/lib/utils'

export type CountryPickerProps = {
  /** Stored value: ISO alpha-2 for known countries, or custom free text. */
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  size?: 'md' | 'sm'
  allowClear?: boolean
  /** Allow saving a search query that isn’t in the ISO list. */
  allowCustom?: boolean
  id?: string
}

export function CountryPicker({
  value,
  onChange,
  disabled,
  placeholder = 'Select a country',
  className,
  size = 'md',
  allowClear = true,
  allowCustom = true,
  id,
}: CountryPickerProps) {
  const reactId = useId()
  const panelId = `${reactId}-panel`
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [pos, setPos] = useState({ top: 0, left: 0, width: 320 })

  const options = useMemo(() => filterCountries(query, 100), [query])
  const label = countryDisplayLabel(value)
  const knownValue = value ? findCountry(value) : null
  const customQuery = query.trim()
  const showCustom =
    allowCustom &&
    customQuery.length > 0 &&
    !findCountry(customQuery) &&
    !options.some((o) => o.name.toLowerCase() === customQuery.toLowerCase())

  const placePanel = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const width = Math.min(360, Math.max(260, r.width))
    let left = r.left
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8)
    const below = r.bottom + 8
    const panelH = 380
    const top =
      below + panelH > window.innerHeight - 8 && r.top > panelH
        ? Math.max(8, r.top - panelH - 8)
        : below
    setPos({ top, left, width })
  }, [])

  useEffect(() => {
    if (!open) return
    placePanel()
    const t = window.setTimeout(() => searchRef.current?.focus(), 20)
    const onWin = () => placePanel()
    window.addEventListener('resize', onWin)
    window.addEventListener('scroll', onWin, true)
    return () => {
      window.clearTimeout(t)
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
      setQuery('')
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function pickKnown(option: CountryOption) {
    onChange(option.code)
    setOpen(false)
    setQuery('')
  }

  function pickCustom(raw: string) {
    const t = raw.trim()
    if (!t) return
    const known = findCountry(t)
    onChange(known ? known.code : t)
    setOpen(false)
    setQuery('')
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

  const panel: ReactNode = open
    ? createPortal(
        <div
          ref={panelRef}
          id={panelId}
          role="listbox"
          aria-label="Countries"
          className="fixed z-[200] animate-[ff-rise_0.2s_var(--ease-spring)] overflow-hidden rounded-2xl border border-[var(--color-border)]/70 bg-[var(--color-surface)]/95 shadow-[0_20px_50px_-18px_rgb(15_23_42_/_0.45)] backdrop-blur-xl"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-[var(--color-accent-soft)]/90 to-transparent" />
          <div className="relative border-b border-[var(--color-border)]/60 p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-ink-muted)]" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && showCustom) {
                    e.preventDefault()
                    pickCustom(customQuery)
                  }
                }}
                placeholder="Search name or code…"
                className="h-9 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] pl-8 pr-3 text-sm outline-none transition focus:border-[var(--color-accent)] focus:ring-4 focus:ring-[var(--color-accent)]/15"
                aria-label="Search countries"
              />
            </div>
            <p className="mt-1.5 px-0.5 text-[10px] text-[var(--color-ink-muted)]">
              Stores ISO code when known{allowCustom ? ' · custom values allowed' : ''}
            </p>
          </div>
          <ul className="max-h-56 overflow-y-auto py-1.5 [scrollbar-width:thin]">
            {options.map((option) => {
              const isOn = knownValue?.code === option.code
              return (
                <li key={option.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isOn}
                    onClick={() => pickKnown(option)}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition',
                      isOn
                        ? 'bg-[var(--color-accent-soft)] font-medium text-[var(--color-accent)]'
                        : 'text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-5 w-5 shrink-0 place-items-center rounded-full border transition',
                        isOn
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]$1text-[var(--color-accent-fg)]'
                          : 'border-[var(--color-border)] bg-[var(--color-surface)] text-transparent',
                      )}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{option.name}</span>
                    <span className="shrink-0 font-mono text-[10px] font-semibold tracking-wide text-[var(--color-ink-muted)]">
                      {option.code}
                    </span>
                  </button>
                </li>
              )
            })}
            {!options.length && !showCustom ? (
              <li className="px-3 py-4 text-center text-sm text-[var(--color-ink-muted)]">No matching countries</li>
            ) : null}
          </ul>
          {showCustom ? (
            <div className="border-t border-[var(--color-border)]/60 p-2.5">
              <button
                type="button"
                onClick={() => pickCustom(customQuery)}
                className="flex w-full items-center gap-2 rounded-xl border border-dashed border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)]/50 px-3 py-2 text-left text-sm font-medium text-[var(--color-accent)] transition hover:bg-[var(--color-accent-soft)]"
              >
                <span className="min-w-0 flex-1 truncate">Use “{customQuery}”</span>
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent)]/80">
                  Custom
                </span>
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
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => {
            if (disabled) return
            placePanel()
            setOpen((v) => !v)
            if (open) setQuery('')
          }}
          onKeyDown={onTriggerKey}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/90 text-left shadow-sm transition-all duration-200',
            'hover:border-[var(--color-accent)]/35 focus-visible:border-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-accent)]/15',
            size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-10 px-3 text-sm',
            disabled && 'cursor-not-allowed opacity-50',
            open && 'border-[var(--color-accent)] ring-4 ring-[var(--color-accent)]/15',
          )}
        >
          <Globe2
            className={cn('shrink-0 text-[var(--color-accent)]', size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4')}
          />
          <span
            className={cn(
              'min-w-0 flex-1 truncate',
              label ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-muted)]',
            )}
          >
            {label || placeholder}
          </span>
          {knownValue ? (
            <span className="shrink-0 font-mono text-[10px] font-semibold tracking-wide text-[var(--color-ink-muted)]">
              {knownValue.code}
            </span>
          ) : value ? (
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-warning)]/80">
              Custom
            </span>
          ) : null}
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-[var(--color-ink-muted)]" />
        </button>
        {allowClear && value && !disabled ? (
          <button
            type="button"
            className="rounded-lg p-1.5 text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink-muted)]"
            aria-label="Clear"
            onClick={() => onChange('')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {panel}
    </div>
  )
}
