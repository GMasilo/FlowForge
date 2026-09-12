import { Clock3 } from 'lucide-react'
import type { HoursDay } from '@/features/templates/templateModel'
import type { HoursEmbedPayload } from '@/features/templates/hoursEmbed'
import { cn } from '@/shared/lib/utils'

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

function weekdayIndex(day: string): number | null {
  const key = day.trim().toLowerCase()
  return key in WEEKDAY_INDEX ? WEEKDAY_INDEX[key]! : null
}

function partsInTimeZone(now: Date, timeZone: string): { weekday: number; minutes: number } | null {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || undefined,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    const parts = fmt.formatToParts(now)
    const weekdayRaw = parts.find((p) => p.type === 'weekday')?.value ?? ''
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? NaN)
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? NaN)
    const map: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    }
    const weekday = map[weekdayRaw]
    if (weekday === undefined || !Number.isFinite(hour) || !Number.isFinite(minute)) return null
    return { weekday, minutes: hour * 60 + minute }
  } catch {
    return null
  }
}

function parseHm(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null
  return h * 60 + min
}

function isOpenNow(days: HoursDay[], timeZone: string, now = new Date()): boolean | null {
  const local = partsInTimeZone(now, timeZone.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone)
  if (!local) return null
  const today = days.find((d) => weekdayIndex(d.day) === local.weekday)
  if (!today) return null
  if (today.closed) return false
  const open = parseHm(today.open)
  const close = parseHm(today.close)
  if (open == null || close == null) return null
  if (close > open) return local.minutes >= open && local.minutes < close
  // Overnight window, e.g. 22:00–02:00
  return local.minutes >= open || local.minutes < close
}

function todayWeekday(timeZone: string, now = new Date()): number | null {
  const local = partsInTimeZone(now, timeZone.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone)
  return local?.weekday ?? null
}

export function OpeningHoursCard({
  hours,
  className,
}: {
  hours: HoursEmbedPayload
  className?: string
}) {
  const today = todayWeekday(hours.timezone)
  const openNow = isOpenNow(hours.days, hours.timezone)

  return (
    <div
      className={cn(
        'w-full min-w-[14rem] max-w-sm overflow-hidden rounded-2xl border border-[var(--color-border)]/80',
        'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-sm',
        className,
      )}
    >
      <div className="flex items-start gap-2.5 border-b border-[var(--color-border)]/60 bg-[var(--color-surface-2)]/50 px-3.5 py-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
          <Clock3 className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold leading-tight">{hours.title}</p>
            {openNow === true ? (
              <span className="rounded-full bg-[var(--color-success-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-success)]">
                Open now
              </span>
            ) : openNow === false ? (
              <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
                Closed now
              </span>
            ) : null}
          </div>
          {hours.timezone ? (
            <p className="mt-0.5 text-[11px] text-[var(--color-ink-muted)]">{hours.timezone}</p>
          ) : null}
        </div>
      </div>

      <ul className="divide-y divide-[var(--color-border)]/50 px-1 py-1">
        {hours.days.map((day, index) => {
          const isToday = today != null && weekdayIndex(day.day) === today
          return (
            <li
              key={`${day.day}-${index}`}
              className={cn(
                'flex items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-sm',
                isToday && 'bg-[var(--color-accent-soft)]/70',
              )}
            >
              <span
                className={cn(
                  'min-w-0 font-medium',
                  isToday ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink)]',
                )}
              >
                {day.day || `Day ${index + 1}`}
                {isToday ? (
                  <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-80">Today</span>
                ) : null}
              </span>
              {day.closed ? (
                <span className="shrink-0 rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-ink-muted)]">
                  Closed
                </span>
              ) : (
                <span className="shrink-0 font-mono text-[12px] tabular-nums text-[var(--color-ink)]">
                  {day.open}–{day.close}
                </span>
              )}
            </li>
          )
        })}
      </ul>

      {hours.note ? (
        <p className="border-t border-[var(--color-border)]/60 px-3.5 py-2.5 text-[11px] leading-snug text-[var(--color-ink-muted)]">
          {hours.note}
        </p>
      ) : null}
    </div>
  )
}
