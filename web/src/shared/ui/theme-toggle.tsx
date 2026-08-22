import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/shared/theme/ThemeProvider'
import type { ThemePreference } from '@/shared/lib/theme'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

const LABELS: Record<ThemePreference, string> = {
  system: 'System theme',
  light: 'Light theme',
  dark: 'Dark theme',
}

function ThemeIcon({ theme, className }: { theme: ThemePreference; className?: string }) {
  if (theme === 'light') return <Sun className={className} />
  if (theme === 'dark') return <Moon className={className} />
  return <Monitor className={className} />
}

/** Compact header control: cycles System → Light → Dark. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, cycleTheme } = useTheme()
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      onClick={cycleTheme}
      aria-label={`${LABELS[theme]}. Click to change.`}
      title={LABELS[theme]}
    >
      <ThemeIcon theme={theme} className="h-4 w-4" />
    </Button>
  )
}

const OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: 'system', label: 'System', hint: 'Match device setting' },
  { value: 'light', label: 'Light', hint: 'Always light' },
  { value: 'dark', label: 'Dark', hint: 'Always dark' },
]

/** Explicit Light / Dark / System chooser for settings pages. */
export function ThemePicker({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()

  return (
    <div
      className={cn(
        'inline-flex w-full flex-col gap-1 rounded-xl border border-[var(--color-border)]/70 bg-[var(--color-surface-2)]/50 p-1 sm:flex-row',
        className,
      )}
      role="group"
      aria-label="Appearance"
    >
      {OPTIONS.map((opt) => {
        const active = theme === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => setTheme(opt.value)}
            className={cn(
              'flex flex-1 items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all duration-200',
              active
                ? 'bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)] text-[var(--color-accent-fg)] shadow-sm'
                : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]',
            )}
          >
            <ThemeIcon theme={opt.value} className="h-4 w-4 shrink-0" />
            <span className="min-w-0">
              <span className="block">{opt.label}</span>
              <span className={cn('block text-xs font-normal', active ? 'text-[var(--color-accent-fg)]/80' : 'text-[var(--color-ink-muted)]')}>
                {opt.hint}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
