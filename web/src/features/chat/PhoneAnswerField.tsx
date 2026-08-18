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
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import {
  composeE164,
  filterDialCountries,
  findDialCountry,
  splitE164,
  type DialCountryOption,
} from '@/shared/lib/phoneDialCodes'
import { cn } from '@/shared/lib/utils'

const DEFAULT_COUNTRY = 'ZA'

/**
 * Phone answer control: country calling-code picker + digits-only national number.
 * Emits a composed E.164 value (e.g. +27821234567).
 */
export function PhoneAnswerField({
  value,
  onChange,
  disabled,
  className,
  variant = 'chat',
  defaultCountry = DEFAULT_COUNTRY,
  minLength,
  maxLength = 15,
  pattern = '\\d+',
  required,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  variant?: 'chat' | 'form'
  defaultCountry?: string
  minLength?: number
  maxLength?: number
  pattern?: string
  required?: boolean
}) {
  const reactId = useId()
  const panelId = `${reactId}-panel`
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const nationalRef = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => (value ? splitE164(value) : null), [value])
  const [countryCode, setCountryCode] = useState(
    () => parsed?.countryCode || findDialCountry(defaultCountry)?.code || 'ZA',
  )
  const [national, setNational] = useState(() => parsed?.national ?? '')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [pos, setPos] = useState({ top: 0, left: 0, width: 320 })

  const selected = findDialCountry(countryCode) ?? findDialCountry(DEFAULT_COUNTRY)!
  const options = useMemo(() => filterDialCountries(query, 100), [query])

  // Sync from external clears / restarts without clobbering the chosen country
  useEffect(() => {
    if (!value) {
      setNational('')
      return
    }
    const next = splitE164(value, countryCode)
    if (!next) return
    if (next.countryCode !== countryCode) setCountryCode(next.countryCode)
    if (next.national !== national) setNational(next.national)
    // Only re-parse when the composed value changes from outside
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function emit(nextCountry: string, nextNational: string) {
    const dial = findDialCountry(nextCountry)?.dial ?? ''
    onChange(composeE164(dial, nextNational))
  }

  const placePanel = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const width = Math.min(360, Math.max(280, r.width + 160))
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

  function pickCountry(option: DialCountryOption) {
    setCountryCode(option.code)
    setOpen(false)
    setQuery('')
    emit(option.code, national)
    window.setTimeout(() => nationalRef.current?.focus(), 20)
  }

  function onNationalChange(raw: string) {
    const cap = maxLength != null && maxLength > 0 ? maxLength : 15
    const digits = raw.replace(/\D/g, '').slice(0, cap)
    setNational(digits)
    emit(countryCode, digits)
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

  const sizeMd = variant === 'chat'
  const panel: ReactNode = open
    ? createPortal(
        <div
          ref={panelRef}
          id={panelId}
          role="listbox"
          aria-label="Country calling codes"
          className="fixed z-[200] animate-[ff-rise_0.2s_var(--ease-spring)] overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-[0_20px_50px_-18px_rgb(15_23_42_/_0.45)] backdrop-blur-xl"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-teal-50/90 to-transparent" />
          <div className="relative border-b border-slate-100 p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country or +code…"
                className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-sm outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-500/15"
                aria-label="Search calling codes"
              />
            </div>
          </div>
          <ul className="max-h-56 overflow-y-auto py-1.5 [scrollbar-width:thin]">
            {options.map((option) => {
              const isOn = selected.code === option.code
              return (
                <li key={option.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isOn}
                    onClick={() => pickCountry(option)}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition',
                      isOn
                        ? 'bg-teal-50 font-medium text-teal-900'
                        : 'text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-5 w-5 shrink-0 place-items-center rounded-full border transition',
                        isOn
                          ? 'border-teal-600 bg-teal-600 text-white'
                          : 'border-slate-300 bg-white text-transparent',
                      )}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{option.name}</span>
                    <span className="shrink-0 font-mono text-xs font-semibold text-slate-500">
                      +{option.dial}
                    </span>
                  </button>
                </li>
              )
            })}
            {!options.length ? (
              <li className="px-3 py-4 text-center text-sm text-slate-400">No matching countries</li>
            ) : null}
          </ul>
        </div>,
        document.body,
      )
    : null

  return (
    <div className={cn('flex min-w-0 flex-1 items-stretch gap-1.5', className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`Country code +${selected.dial}`}
        onClick={() => {
          if (disabled) return
          placePanel()
          setOpen((v) => !v)
          if (open) setQuery('')
        }}
        onKeyDown={onTriggerKey}
        className={cn(
          'flex shrink-0 items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 font-mono text-sm font-semibold text-slate-800 shadow-sm transition',
          'hover:border-teal-400/50 focus-visible:border-teal-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/15',
          sizeMd ? 'h-11 px-2.5' : 'h-10 px-2 text-xs',
          disabled && 'cursor-not-allowed opacity-50',
          open && 'border-teal-500 ring-4 ring-teal-500/15',
        )}
      >
        <span>+{selected.dial}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      <input
        ref={nationalRef}
        type="text"
        inputMode="numeric"
        autoComplete="tel-national"
        autoCapitalize="none"
        spellCheck={false}
        disabled={disabled}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        pattern={pattern}
        value={national}
        onChange={(e) => onNationalChange(e.target.value)}
        placeholder="Phone number"
        aria-label="Phone number"
        className={cn(
          'min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 text-sm outline-none transition',
          'focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-500/15',
          sizeMd ? 'h-11 px-3.5' : 'h-10 px-3',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      />
      {panel}
    </div>
  )
}
