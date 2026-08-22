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
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isValid,
  parse,
  startOfDay,
  startOfMonth,
  subMonths,
} from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export type DateTimeMode = 'date' | 'time' | 'datetime'

export type DateTimePickerProps = {
  mode: DateTimeMode
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  disabled?: boolean
  placeholder?: string
  className?: string
  /** Compact trigger for inspector grids */
  size?: 'md' | 'sm'
  allowClear?: boolean
  id?: string
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function parseDatePart(raw: string | undefined): Date | null {
  if (!raw?.trim()) return null
  const dateOnly = raw.includes('T') ? raw.slice(0, 10) : raw.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null
  const d = parse(dateOnly, 'yyyy-MM-dd', new Date())
  return isValid(d) ? startOfDay(d) : null
}

function parseTimePart(raw: string | undefined): { h: number; m: number } | null {
  if (!raw?.trim()) return null
  const time = raw.includes('T') ? (raw.split('T')[1] ?? '') : raw
  const m = /^(\d{2}):(\d{2})/.exec(time)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null
  return { h, m: min }
}

function displayLabel(mode: DateTimeMode, value: string): string {
  if (!value) return ''
  if (mode === 'date') {
    const d = parseDatePart(value)
    return d ? format(d, 'EEE, MMM d, yyyy') : value
  }
  if (mode === 'time') {
    const t = parseTimePart(value)
    if (!t) return value
    const d = new Date()
    d.setHours(t.h, t.m, 0, 0)
    return format(d, 'h:mm a')
  }
  const d = parseDatePart(value)
  const t = parseTimePart(value)
  if (!d || !t) return value
  const combined = new Date(d)
  combined.setHours(t.h, t.m, 0, 0)
  return format(combined, 'EEE, MMM d · h:mm a')
}

function isDateDisabled(day: Date, minDate: Date | null, maxDate: Date | null): boolean {
  if (minDate && isBefore(day, minDate)) return true
  if (maxDate && isAfter(day, maxDate)) return true
  return false
}

function clampTime(
  h: number,
  m: number,
  mode: DateTimeMode,
  selectedDate: Date | null,
  min?: string,
  max?: string,
): { h: number; m: number } {
  let next = { h, m }
  if (mode === 'time') {
    const minT = parseTimePart(min)
    const maxT = parseTimePart(max)
    const asNum = (t: { h: number; m: number }) => t.h * 60 + t.m
    let n = asNum(next)
    if (minT && n < asNum(minT)) next = minT
    n = asNum(next)
    if (maxT && n > asNum(maxT)) next = maxT
    return next
  }
  if (mode === 'datetime' && selectedDate) {
    const minD = parseDatePart(min)
    const maxD = parseDatePart(max)
    const minT = parseTimePart(min)
    const maxT = parseTimePart(max)
    if (minD && minT && isSameDay(selectedDate, minD)) {
      const asNum = (t: { h: number; m: number }) => t.h * 60 + t.m
      if (asNum(next) < asNum(minT)) next = minT
    }
    if (maxD && maxT && isSameDay(selectedDate, maxD)) {
      const asNum = (t: { h: number; m: number }) => t.h * 60 + t.m
      if (asNum(next) > asNum(maxT)) next = maxT
    }
  }
  return next
}

function TimeColumn({
  label,
  values,
  selected,
  onSelect,
  isDisabled,
}: {
  label: string
  values: number[]
  selected: number
  onSelect: (n: number) => void
  isDisabled?: (n: number) => boolean
}) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLButtonElement>(`[data-val="${selected}"]`)
    el?.scrollIntoView({ block: 'center' })
  }, [selected])

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <p className="mb-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
        {label}
      </p>
      <div
        ref={listRef}
        className="h-40 overflow-y-auto rounded-xl bg-[var(--color-surface-2)]/80 py-1 [scrollbar-width:thin]"
      >
        {values.map((n) => (
          <button
            key={n}
            type="button"
            data-val={n}
            disabled={isDisabled?.(n)}
            onClick={() => onSelect(n)}
            className={cn(
              'flex w-full items-center justify-center py-1.5 font-mono text-sm transition',
              selected === n
                ? 'bg-[var(--color-accent)]$1text-[var(--color-accent-fg)] shadow-sm'
                : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent)]',
              isDisabled?.(n) && 'cursor-not-allowed text-[var(--color-ink-muted)]/50 hover:bg-transparent hover:text-[var(--color-ink-muted)]/50',
            )}
          >
            {pad2(n)}
          </button>
        ))}
      </div>
    </div>
  )
}

function CalendarGrid({
  month,
  selected,
  minDate,
  maxDate,
  onSelect,
}: {
  month: Date
  selected: Date | null
  minDate: Date | null
  maxDate: Date | null
  onSelect: (d: Date) => void
}) {
  const days = useMemo(() => {
    const start = startOfMonth(month)
    const end = endOfMonth(month)
    return eachDayOfInterval({ start, end })
  }, [month])

  const lead = getDay(startOfMonth(month))

  return (
    <div className="grid grid-cols-7 gap-0.5">
      {WEEKDAYS.map((d) => (
        <div
          key={d}
          className="pb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]"
        >
          {d}
        </div>
      ))}
      {Array.from({ length: lead }).map((_, i) => (
        <div key={`e-${i}`} />
      ))}
      {days.map((day) => {
        const disabled = isDateDisabled(day, minDate, maxDate)
        const selectedDay = selected && isSameDay(day, selected)
        const today = isSameDay(day, new Date())
        return (
          <button
            key={day.toISOString()}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(day)}
            className={cn(
              'relative grid h-9 place-items-center rounded-xl text-sm transition',
              disabled && 'cursor-not-allowed text-[var(--color-ink-muted)]/50',
              !disabled && !selectedDay && 'text-[var(--color-ink)] hover:bg-[var(--color-accent-soft)]',
              selectedDay && 'bg-[var(--color-accent)]$1text-[var(--color-accent-fg)] shadow-sm',
              today && !selectedDay && 'font-semibold text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/25',
            )}
          >
            {format(day, 'd')}
          </button>
        )
      })}
    </div>
  )
}

export function DateTimePicker({
  mode,
  value,
  onChange,
  min,
  max,
  disabled,
  placeholder,
  className,
  size = 'md',
  allowClear = true,
  id,
}: DateTimePickerProps) {
  const reactId = useId()
  const panelId = `${reactId}-panel`
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 320 })

  const selectedDate = useMemo(() => (mode === 'time' ? null : parseDatePart(value)), [mode, value])
  const selectedTime = useMemo(() => {
    if (mode === 'date') return null
    return parseTimePart(value)
  }, [mode, value])

  const dialTime = selectedTime ?? { h: 9, m: 0 }

  const [viewMonth, setViewMonth] = useState(() => selectedDate ?? new Date())

  useEffect(() => {
    if (selectedDate && !isSameMonth(selectedDate, viewMonth)) {
      setViewMonth(selectedDate)
    }
  }, [selectedDate, viewMonth])

  const minDate = mode === 'time' ? null : parseDatePart(min)
  const maxDate = mode === 'time' ? null : parseDatePart(max)
  const minT = parseTimePart(min)
  const maxT = parseTimePart(max)
  const timeMinApplies =
    mode === 'time'
      ? !!minT
      : mode === 'datetime' && !!minT && !!selectedDate && !!minDate && isSameDay(selectedDate, minDate)
  const timeMaxApplies =
    mode === 'time'
      ? !!maxT
      : mode === 'datetime' && !!maxT && !!selectedDate && !!maxDate && isSameDay(selectedDate, maxDate)

  const defaultPlaceholder =
    mode === 'date' ? 'Pick a date' : mode === 'time' ? 'Pick a time' : 'Pick date & time'

  const placePanel = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const width = Math.min(340, Math.max(280, r.width))
    let left = r.left
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8)
    const below = r.bottom + 8
    const panelH = mode === 'time' ? 260 : mode === 'datetime' ? 420 : 340
    const top =
      below + panelH > window.innerHeight - 8 && r.top > panelH
        ? Math.max(8, r.top - panelH - 8)
        : below
    setPos({ top, left, width })
  }, [mode])

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

  function emit(date: Date | null, time: { h: number; m: number } | null) {
    const clampedTime =
      time && mode !== 'date' ? clampTime(time.h, time.m, mode, date, min, max) : time
    if (mode === 'date') {
      onChange(date ? format(date, 'yyyy-MM-dd') : '')
      return
    }
    if (mode === 'time') {
      onChange(clampedTime ? `${pad2(clampedTime.h)}:${pad2(clampedTime.m)}` : '')
      return
    }
    if (!date) {
      onChange('')
      return
    }
    const t = clampedTime ?? { h: 9, m: 0 }
    onChange(`${format(date, 'yyyy-MM-dd')}T${pad2(t.h)}:${pad2(t.m)}`)
  }

  function onSelectDay(day: Date) {
    const time =
      mode === 'datetime'
        ? clampTime(dialTime.h, dialTime.m, mode, day, min, max)
        : null
    emit(day, time)
    if (mode === 'date') setOpen(false)
  }

  function onSelectTime(h: number, m: number) {
    const next = clampTime(h, m, mode, selectedDate, min, max)
    if (mode === 'time') {
      emit(null, next)
      return
    }
    const date = selectedDate ?? startOfDay(new Date())
    emit(date, next)
  }

  function confirmAndClose() {
    if (mode === 'time' && !value) {
      onSelectTime(dialTime.h, dialTime.m)
    } else if (mode === 'datetime' && selectedDate && !parseTimePart(value)) {
      onSelectTime(dialTime.h, dialTime.m)
    }
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

  const label = displayLabel(mode, value)
  const Icon = mode === 'time' ? Clock : CalendarDays

  const panel: ReactNode = open
    ? createPortal(
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={mode === 'time' ? 'Choose time' : 'Choose date'}
          className="fixed z-[200] animate-[ff-rise_0.2s_var(--ease-spring)] overflow-hidden rounded-2xl border border-[var(--color-border)]/70 bg-[var(--color-surface)]/95 p-3 shadow-[0_20px_50px_-18px_rgb(15_23_42_/_0.45)] backdrop-blur-xl"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[var(--color-accent-soft)]/90 to-transparent" />
          {mode !== 'time' ? (
            <div className="relative mb-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="rounded-xl p-1.5 text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-accent)]"
                  onClick={() => setViewMonth((m) => subMonths(m, 1))}
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <p className="font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--color-ink)]">
                  {format(viewMonth, 'MMMM yyyy')}
                </p>
                <button
                  type="button"
                  className="rounded-xl p-1.5 text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-accent)]"
                  onClick={() => setViewMonth((m) => addMonths(m, 1))}
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <CalendarGrid
                month={viewMonth}
                selected={selectedDate}
                minDate={minDate}
                maxDate={maxDate}
                onSelect={onSelectDay}
              />
            </div>
          ) : null}

          {mode !== 'date' ? (
            <div className={cn('relative', mode === 'datetime' && 'border-t border-[var(--color-border)]/60 pt-3')}>
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[var(--color-ink-muted)]">
                <Clock className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                Time
              </div>
              <div className="flex gap-2">
                <TimeColumn
                  label="Hour"
                  values={Array.from({ length: 24 }, (_, i) => i)}
                  selected={dialTime.h}
                  isDisabled={(h) =>
                    Boolean(
                      (timeMinApplies && minT && h < minT.h) ||
                        (timeMaxApplies && maxT && h > maxT.h),
                    )
                  }
                  onSelect={(h) => onSelectTime(h, dialTime.m)}
                />
                <TimeColumn
                  label="Min"
                  values={Array.from({ length: 60 }, (_, i) => i)}
                  selected={dialTime.m}
                  isDisabled={(m) =>
                    Boolean(
                      (timeMinApplies && minT && dialTime.h === minT.h && m < minT.m) ||
                        (timeMaxApplies && maxT && dialTime.h === maxT.h && m > maxT.m),
                    )
                  }
                  onSelect={(m) => onSelectTime(dialTime.h, m)}
                />
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="rounded-xl bg-[var(--color-accent)]$1text-[var(--color-accent-fg)] shadow-sm transition hover:bg-[var(--color-accent)] disabled:opacity-50"
                  onClick={confirmAndClose}
                  disabled={mode === 'datetime' && !selectedDate}
                >
                  Done
                </button>
              </div>
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
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => {
            if (disabled) return
            placePanel()
            setOpen((v) => !v)
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
          <Icon className={cn('shrink-0 text-[var(--color-accent)]', size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
          <span
            className={cn(
              'truncate',
              label ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-muted)]',
            )}
          >
            {label || placeholder || defaultPlaceholder}
          </span>
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

/** Map question answerType → picker mode. */
export function dateTimeModeForAnswerType(answerType: string): DateTimeMode | null {
  if (answerType === 'date' || answerType === 'time' || answerType === 'datetime') {
    return answerType
  }
  return null
}
