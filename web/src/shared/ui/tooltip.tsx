import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/shared/lib/utils'

type TooltipProps = {
  content: ReactNode
  children: ReactNode
  className?: string
  side?: 'top' | 'bottom'
}

export function Tooltip({ content, children, className, side = 'top' }: TooltipProps) {
  const reactId = useId()
  const tipId = `${reactId}-tip`
  const triggerRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })

  const place = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ top: r.top, left: r.left + r.width / 2, width: r.width })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    place()
    const onScroll = () => place()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open, place])

  const tip =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            id={tipId}
            role="tooltip"
            className={cn(
              'pointer-events-none fixed z-[80] max-w-[min(280px,calc(100vw-1.5rem))] -translate-x-1/2 rounded-lg bg-slate-900 px-2.5 py-1.5 text-left text-[12px] leading-snug text-white shadow-lg',
              side === 'top' ? '-translate-y-full' : '',
            )}
            style={{
              top: side === 'top' ? pos.top - 8 : pos.top + 8 + (triggerRef.current?.offsetHeight ?? 0),
              left: Math.min(Math.max(pos.left, 140), window.innerWidth - 140),
            }}
          >
            {content}
          </div>,
          document.body,
        )
      : null

  return (
    <span
      ref={triggerRef}
      className={cn('inline-flex', className)}
      onMouseEnter={() => {
        place()
        setOpen(true)
      }}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => {
        place()
        setOpen(true)
      }}
      onBlurCapture={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        setOpen(false)
      }}
      aria-describedby={open ? tipId : undefined}
    >
      {children}
      {tip}
    </span>
  )
}
