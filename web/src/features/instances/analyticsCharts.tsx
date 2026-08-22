import { useId } from 'react'
import { cn } from '@/shared/lib/utils'
import type { DailyPoint, HourPoint, StatusSlice } from '@/features/instances/conversationAnalytics'
import { sessionStatusTone } from '@/features/instances/conversationStatus'

const STATUS_FILL: Record<string, string> = {
  completed: '#059669',
  active: '#0284c7',
  abandoned: '#d97706',
  failed: '#e11d48',
}

export function AreaChart({
  points,
  className,
}: {
  points: DailyPoint[]
  className?: string
}) {
  const gradId = useId()
  const width = 640
  const height = 220
  const padL = 36
  const padR = 12
  const padT = 16
  const padB = 32
  const innerW = width - padL - padR
  const innerH = height - padT - padB
  const max = Math.max(1, ...points.map((p) => Math.max(p.sessions, p.completed, p.failed)))
  const x = (i: number) => padL + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
  const y = (v: number) => padT + innerH - (v / max) * innerH

  function pathFor(values: number[]) {
    if (!values.length) return ''
    return values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  }

  const sessions = points.map((p) => p.sessions)
  const completed = points.map((p) => p.completed)
  const area =
    points.length > 1
      ? `${pathFor(sessions)} L ${x(points.length - 1).toFixed(1)} ${y(0).toFixed(1)} L ${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`
      : ''

  const labelEvery = Math.max(1, Math.ceil(points.length / 7))

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn('h-auto w-full', className)}
      role="img"
      aria-label="Sessions over time"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0f766e" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#0f766e" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((t) => {
        const value = Math.round(max * (1 - t))
        const yy = padT + innerH * t
        return (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={yy} y2={yy} stroke="#e2e8f0" strokeWidth="1" />
            <text x={padL - 8} y={yy + 4} textAnchor="end" className="fill-[var(--color-ink-muted)]" fontSize="10">
              {value}
            </text>
          </g>
        )
      })}
      {area ? <path d={area} fill={`url(#${gradId})`} /> : null}
      <path d={pathFor(sessions)} fill="none" stroke="#0f766e" strokeWidth="2.25" strokeLinejoin="round" />
      <path d={pathFor(completed)} fill="none" stroke="#0891b2" strokeWidth="2" strokeDasharray="4 3" />
      {points.map((p, i) =>
        i % labelEvery === 0 || i === points.length - 1 ? (
          <text
            key={p.date}
            x={x(i)}
            y={height - 10}
            textAnchor="middle"
            className="fill-[var(--color-ink-muted)]"
            fontSize="10"
          >
            {p.label}
          </text>
        ) : null,
      )}
    </svg>
  )
}

export function DonutChart({
  slices,
  className,
}: {
  slices: StatusSlice[]
  className?: string
}) {
  const total = slices.reduce((sum, s) => sum + s.count, 0) || 1
  const radius = 54
  const circ = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <svg viewBox="0 0 140 140" className="h-32 w-32 shrink-0" role="img" aria-label="Session status mix">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="16" />
        {slices.map((slice) => {
          const len = (slice.count / total) * circ
          const dash = `${len} ${circ - len}`
          const el = (
            <circle
              key={slice.status}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={STATUS_FILL[slice.status] ?? '#64748b'}
              strokeWidth="16"
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
              strokeLinecap="butt"
            />
          )
          offset += len
          return el
        })}
        <text x="70" y="66" textAnchor="middle" className="fill-slate-800" fontSize="18" fontWeight="600">
          {slices.reduce((sum, s) => sum + s.count, 0)}
        </text>
        <text x="70" y="84" textAnchor="middle" className="fill-[var(--color-ink-muted)]" fontSize="10">
          sessions
        </text>
      </svg>
      <ul className="space-y-1.5 text-sm">
        {slices.map((slice) => (
          <li key={slice.status} className="flex items-center gap-2">
            <span
              className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize', sessionStatusTone(slice.status))}
            >
              {slice.status}
            </span>
            <span className="tabular-nums text-[var(--color-ink-muted)]">{slice.count}</span>
            <span className="text-[11px] text-[var(--color-ink-muted)]">
              {Math.round((slice.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function HorizontalBars({
  items,
  className,
  valueSuffix = '',
}: {
  items: Array<{ key: string; label: string; value: number; hint?: string }>
  className?: string
  valueSuffix?: string
}) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <ul className={cn('space-y-2', className)}>
      {items.map((item) => (
        <li key={item.key}>
          <div className="mb-0.5 flex justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium text-[var(--color-ink)]" title={item.label}>
              {item.label}
            </span>
            <span className="shrink-0 tabular-nums text-[var(--color-ink-muted)]">
              {item.value}
              {valueSuffix}
              {item.hint ? ` · ${item.hint}` : ''}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-2)]"
              style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function HourChart({
  points,
  className,
}: {
  points: HourPoint[]
  className?: string
}) {
  const max = Math.max(1, ...points.map((p) => p.count))
  return (
    <div className={cn('flex h-40 items-stretch gap-px sm:gap-0.5', className)} role="img" aria-label="Sessions by hour of day">
      {points.map((p) => (
        <div key={p.hour} className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 items-end">
            <div
              className="w-full rounded-t bg-[var(--color-accent)]/$1"
              style={{ height: `${p.count ? Math.max(6, (p.count / max) * 100) : 2}%` }}
              title={`${String(p.hour).padStart(2, '0')}:00 · ${p.count} session${p.count === 1 ? '' : 's'}`}
            />
          </div>
          <span className="mt-1 text-center text-[9px] tabular-nums text-[var(--color-ink-muted)]">
            {p.hour % 3 === 0 ? p.hour : ''}
          </span>
        </div>
      ))}
    </div>
  )
}
