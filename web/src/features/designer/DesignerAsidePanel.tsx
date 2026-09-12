import { useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

const STICKY =
  'lg:sticky lg:top-[var(--ff-designer-aside-top,5rem)] lg:max-h-[calc(100vh-var(--ff-designer-aside-top,7.5rem)-1.5rem)]'

function readStoredOpen(panelId: string, defaultOpen: boolean): boolean {
  try {
    const raw = localStorage.getItem(`ff-designer-panel:${panelId}`)
    if (raw === '0') return false
    if (raw === '1') return true
  } catch {
    /* ignore */
  }
  return defaultOpen
}

type DesignerAsidePanelProps = {
  panelId: string
  title: string
  subtitle?: string | null
  badge?: ReactNode
  defaultOpen?: boolean
  /** Tailwind width when expanded, e.g. lg:w-80 */
  widthClass?: string
  className?: string
  children: ReactNode
}

export function DesignerAsidePanel({
  panelId,
  title,
  subtitle,
  badge,
  defaultOpen = true,
  widthClass = 'lg:w-80',
  className,
  children,
}: DesignerAsidePanelProps) {
  const [open, setOpen] = useState(() => readStoredOpen(panelId, defaultOpen))

  function toggle() {
    setOpen((prev) => {
      const next = !prev
      try {
        localStorage.setItem(`ff-designer-panel:${panelId}`, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  return (
    <aside
      data-state={open ? 'open' : 'closed'}
      className={cn(
        'ff-designer-aside-panel',
        STICKY,
        'relative flex shrink-0 flex-col self-start rounded-2xl border border-[var(--color-border)]/60',
        'bg-[var(--color-surface)]/85 shadow-[var(--shadow-soft)] backdrop-blur-xl',
        'transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none',
        open
          ? cn(
              'ff-hide-scrollbar h-fit w-full overflow-x-hidden overflow-y-auto overscroll-contain',
              widthClass,
            )
          : 'h-auto w-12 overflow-visible',
        className,
      )}
    >
      <button
        type="button"
        onClick={toggle}
        title={`Show ${title}`}
        aria-label={`Show ${title}`}
        aria-hidden={open}
        tabIndex={open ? -1 : 0}
        className={cn(
          'ff-designer-aside-panel__rail',
          'z-20 flex flex-col items-center gap-2.5 px-1.5 py-3',
          'transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none',
          open
            ? 'pointer-events-none absolute inset-0 translate-x-3 opacity-0 delay-0'
            : 'pointer-events-auto relative translate-x-0 opacity-100 delay-150',
        )}
      >
        <ChevronLeft
          className="h-4 w-4 shrink-0 text-[var(--color-ink-muted)] transition-transform duration-300 motion-reduce:transition-none"
          aria-hidden
        />
        <span
          className={cn(
            'max-h-none whitespace-nowrap text-[11px] font-semibold uppercase leading-none',
            'tracking-[0.14em] text-[var(--color-ink-muted)]',
            '[writing-mode:vertical-rl] [text-orientation:mixed]',
          )}
        >
          {title}
        </span>
        {badge ? <span className="shrink-0">{badge}</span> : null}
      </button>

      <div
        aria-hidden={!open}
        className={cn(
          'ff-designer-aside-panel__body',
          'flex w-full min-w-0 flex-col',
          'transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none',
          open
            ? 'relative translate-x-0 opacity-100 delay-75'
            : 'pointer-events-none absolute inset-0 translate-x-full opacity-0 delay-0',
        )}
      >
        <div className="sticky top-0 z-10 flex shrink-0 items-start gap-2 border-b border-[var(--color-border)]/50 bg-[var(--color-surface)]/95 px-4 py-3 backdrop-blur-sm">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-[var(--color-ink)]">{title}</h2>
              {badge}
            </div>
            {subtitle ? (
              <p className="mt-0.5 truncate text-xs text-[var(--color-ink-muted)]">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={toggle}
            title={`Hide ${title}`}
            aria-label={`Hide ${title}`}
            className={cn(
              'shrink-0 rounded-lg p-1.5 text-[var(--color-ink-muted)] transition',
              'hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]',
            )}
          >
            <ChevronRight className="h-4 w-4 transition-transform duration-300 motion-reduce:transition-none" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </aside>
  )
}
