import { cn } from '@/shared/lib/utils'

type Point = { label: string; value: number }

function labelEvery(count: number): number {
  return Math.max(1, Math.ceil(count / 8))
}

export function LiveLineChart({
  points,
  valueLabel,
  formatValue,
  className,
  ariaLabel,
}: {
  points: Point[]
  valueLabel: string
  formatValue?: (value: number) => string
  className?: string
  ariaLabel?: string
}) {
  const w = 640
  const h = 200
  const pad = { t: 16, r: 12, b: 28, l: 44 }
  const max = Math.max(1, ...points.map((p) => p.value))
  const innerW = w - pad.l - pad.r
  const innerH = h - pad.t - pad.b
  const n = Math.max(1, points.length - 1)
  const fmt = formatValue ?? ((v: number) => String(v))

  const xAt = (i: number) => pad.l + (i / n) * innerW
  const yAt = (v: number) => pad.t + innerH - (v / max) * innerH

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(p.value).toFixed(1)}`)
    .join(' ')

  const areaPath = (() => {
    if (!points.length) return ''
    const top = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(p.value).toFixed(1)}`)
      .join(' ')
    const lastX = xAt(points.length - 1)
    const firstX = xAt(0)
    return `${top} L ${lastX.toFixed(1)} ${(pad.t + innerH).toFixed(1)} L ${firstX.toFixed(1)} ${(pad.t + innerH).toFixed(1)} Z`
  })()

  const every = labelEvery(points.length)

  return (
    <div className={cn('mt-1', className)}>
      <div className="mb-2 flex items-center gap-2 text-[11px] text-[var(--color-ink-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
          {valueLabel}
        </span>
      </div>
      {points.length ? (
        <svg viewBox={`0 0 ${w} ${h}`} className="h-48 w-full" role="img" aria-label={ariaLabel ?? valueLabel}>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = pad.t + innerH * (1 - t)
            const val = max * t
            return (
              <g key={t}>
                <line
                  x1={pad.l}
                  x2={w - pad.r}
                  y1={y}
                  y2={y}
                  stroke="var(--color-border)"
                  strokeOpacity={0.5}
                  strokeDasharray="4 4"
                />
                <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize={10} fill="var(--color-ink-muted)">
                  {fmt(val)}
                </text>
              </g>
            )
          })}
          <path d={areaPath} fill="var(--color-accent)" fillOpacity={0.12} />
          <path
            d={linePath}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={2.25}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map((p, i) =>
            i % every === 0 || i === points.length - 1 ? (
              <text
                key={`${p.label}-${i}`}
                x={xAt(i)}
                y={h - 8}
                textAnchor="middle"
                fontSize={10}
                fill="var(--color-ink-muted)"
              >
                {p.label}
              </text>
            ) : null,
          )}
        </svg>
      ) : (
        <p className="text-sm text-[var(--color-ink-muted)]">No data yet.</p>
      )}
    </div>
  )
}

export function LiveBarChart({
  bars,
  valueLabel,
  formatValue,
  className,
  ariaLabel,
}: {
  bars: Point[]
  valueLabel: string
  formatValue?: (value: number) => string
  className?: string
  ariaLabel?: string
}) {
  const w = 640
  const h = 220
  const pad = { t: 16, r: 12, b: 36, l: 44 }
  const max = Math.max(1, ...bars.map((b) => b.value))
  const innerW = w - pad.l - pad.r
  const innerH = h - pad.t - pad.b
  const barW = bars.length ? Math.min(48, (innerW / bars.length) * 0.72) : 24
  const gap = bars.length ? innerW / bars.length : innerW
  const fmt = formatValue ?? ((v: number) => String(v))

  return (
    <div className={cn('mt-1', className)}>
      <div className="mb-2 flex items-center gap-2 text-[11px] text-[var(--color-ink-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--color-accent-2)]" />
          {valueLabel}
        </span>
      </div>
      {bars.length ? (
        <svg viewBox={`0 0 ${w} ${h}`} className="h-52 w-full" role="img" aria-label={ariaLabel ?? valueLabel}>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = pad.t + innerH * (1 - t)
            const val = max * t
            return (
              <g key={t}>
                <line
                  x1={pad.l}
                  x2={w - pad.r}
                  y1={y}
                  y2={y}
                  stroke="var(--color-border)"
                  strokeOpacity={0.5}
                  strokeDasharray="4 4"
                />
                <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize={10} fill="var(--color-ink-muted)">
                  {fmt(val)}
                </text>
              </g>
            )
          })}
          {bars.map((bar, i) => {
            const x = pad.l + i * gap + (gap - barW) / 2
            const barH = (bar.value / max) * innerH
            const y = pad.t + innerH - barH
            return (
              <g key={`${bar.label}-${i}`}>
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(2, barH)}
                  rx={4}
                  fill="var(--color-accent-2)"
                  fillOpacity={0.85}
                />
                <text
                  x={x + barW / 2}
                  y={h - 10}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--color-ink-muted)"
                >
                  {bar.label}
                </text>
              </g>
            )
          })}
        </svg>
      ) : (
        <p className="text-sm text-[var(--color-ink-muted)]">No data yet.</p>
      )}
    </div>
  )
}
