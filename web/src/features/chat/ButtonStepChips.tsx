import { cn } from '@/shared/lib/utils'
import type {
  ButtonListenerEvent,
  ResolvedButtonOption,
} from '@/features/designer/model/buttonStep'

/** Action buttons for Button flow steps with per-button event listeners. */
export function ButtonStepChips({
  buttons,
  disabled,
  className,
  onInteract,
}: {
  buttons: ResolvedButtonOption[]
  disabled?: boolean
  className?: string
  onInteract: (event: ButtonListenerEvent, button: ResolvedButtonOption) => void
}) {
  if (!buttons.length) return null

  return (
    <div className={cn('mt-2 flex flex-wrap gap-2', className)}>
      {buttons.map((btn) => {
        const events = new Set((btn.listeners ?? []).map((l) => l.event))
        // Always handle click so a misconfigured / empty listener list still reaches the runtime.
        const wantsClick = !events.size || events.has('click')
        return (
          <button
            key={btn.id || `${btn.value}::${btn.label}`}
            type="button"
            disabled={disabled}
            onClick={wantsClick ? () => onInteract('click', btn) : undefined}
            onDoubleClick={events.has('dblclick') ? () => onInteract('dblclick', btn) : undefined}
            onMouseEnter={
              events.has('hover') && !disabled
                ? () => onInteract('hover', btn)
                : undefined
            }
            onFocus={events.has('focus') ? () => onInteract('focus', btn) : undefined}
            onBlur={events.has('blur') ? () => onInteract('blur', btn) : undefined}
            className={cn(
              'rounded-xl border border-teal-600/30 bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition',
              'hover:bg-teal-800 disabled:cursor-default disabled:opacity-50',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60',
            )}
          >
            {btn.label}
          </button>
        )
      })}
    </div>
  )
}
