import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import {
  readImageChoices,
  type ImageChoiceLayout,
} from '@/features/designer/model/flowSchema'
import { mediaKeyFromFilename, type ChatbotMediaFile } from '@/features/designer/model/chatbotMedia'

export type ImageChoiceCard = {
  label: string
  filename: string
  url: string
  key: string
}

export function imageChoiceCardsFromCatalog(
  config: Record<string, unknown> | undefined | null,
  catalog: ChatbotMediaFile[],
): ImageChoiceCard[] {
  const byName = new Map(catalog.map((f) => [f.filename, f]))
  return readImageChoices(config).map((opt) => {
    const file = byName.get(opt.filename)
    return {
      ...opt,
      url: file?.url ?? '',
      key: file?.key || mediaKeyFromFilename(opt.filename),
    }
  })
}

export function imageChoicePayloadFromSelection(
  options: ImageChoiceCard[],
  selected: string | string[],
): ImageChoiceCard | ImageChoiceCard[] | string | string[] {
  const labels = Array.isArray(selected) ? selected : selected ? [selected] : []
  const cards = labels
    .map((label) => options.find((o) => o.label === label))
    .filter((o): o is ImageChoiceCard => !!o)
  if (Array.isArray(selected)) return cards
  return cards[0] ?? selected
}

function nearestCardIndex(scroller: HTMLElement, cards: Array<HTMLElement | null>): number {
  const root = scroller.getBoundingClientRect()
  const mid = root.left + root.width / 2
  let best = 0
  let bestDist = Number.POSITIVE_INFINITY
  for (let i = 0; i < cards.length; i++) {
    const node = cards[i]
    if (!node) continue
    const box = node.getBoundingClientRect()
    const dist = Math.abs(box.left + box.width / 2 - mid)
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  }
  return best
}

export function ImageChoiceAnswerField({
  options,
  value,
  onChange,
  allowMultiple = false,
  layout = 'gallery',
  disabled,
  className,
}: {
  options: ImageChoiceCard[]
  value: string | string[]
  onChange: (value: string | string[]) => void
  allowMultiple?: boolean
  layout?: ImageChoiceLayout
  disabled?: boolean
  className?: string
}) {
  const selected = Array.isArray(value) ? value : value ? [value] : []

  function toggle(label: string) {
    if (disabled) return
    if (allowMultiple) {
      const next = selected.includes(label) ? selected.filter((s) => s !== label) : [...selected, label]
      onChange(next)
      return
    }
    onChange(label)
  }

  if (!options.length) {
    return (
      <p className="text-sm text-slate-500">No images are configured for this question.</p>
    )
  }

  if (layout === 'grid') {
    return (
      <div className={cn('grid grid-cols-2 gap-2 sm:grid-cols-3', className)} role="listbox" aria-label="Image choices" aria-multiselectable={allowMultiple || undefined}>
        {options.map((opt) => {
          const on = selected.includes(opt.label)
          return (
            <button
              key={opt.filename + opt.label}
              type="button"
              role="option"
              aria-selected={on}
              disabled={disabled}
              onClick={() => toggle(opt.label)}
              className={cn(
                'overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition',
                on
                  ? 'border-teal-500 ring-2 ring-teal-500/30'
                  : 'border-slate-200 hover:border-teal-300',
                disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              {opt.url ? (
                <img src={opt.url} alt="" className="h-24 w-full object-cover sm:h-28" />
              ) : (
                <div className="grid h-24 place-items-center bg-slate-100 text-[11px] text-slate-400 sm:h-28">
                  Missing image
                </div>
              )}
              <span className="block truncate px-2.5 py-2 text-xs font-semibold text-slate-800">{opt.label}</span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <ImageChoiceGallery
      options={options}
      selected={selected}
      onToggle={toggle}
      allowMultiple={allowMultiple}
      disabled={disabled}
      className={className}
    />
  )
}

function ImageChoiceGallery({
  options,
  selected,
  onToggle,
  allowMultiple,
  disabled,
  className,
}: {
  options: ImageChoiceCard[]
  selected: string[]
  onToggle: (label: string) => void
  allowMultiple: boolean
  disabled?: boolean
  className?: string
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [focused, setFocused] = useState(0)
  const optionsKey = options.map((o) => `${o.filename}:${o.label}`).join('|')

  const scrollToIndex = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    const scroller = scrollerRef.current
    const card = cardRefs.current[index]
    if (!scroller || !card) return
    const root = scroller.getBoundingClientRect()
    const box = card.getBoundingClientRect()
    const delta = box.left + box.width / 2 - (root.left + root.width / 2)
    scroller.scrollBy({ left: delta, behavior })
    setFocused(index)
  }, [])

  const syncFocused = useCallback(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    setFocused(nearestCardIndex(scroller, cardRefs.current))
  }, [])

  useEffect(() => {
    const preferred = selected[0]
    const idx = preferred ? Math.max(0, options.findIndex((o) => o.label === preferred)) : 0
    const id = window.requestAnimationFrame(() => scrollToIndex(idx, 'instant'))
    return () => window.cancelAnimationFrame(id)
    // Re-center when the option list changes, not on every selection toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsKey, scrollToIndex])

  function selectCard(label: string, index: number) {
    if (disabled) return
    scrollToIndex(index)
    onToggle(label)
  }

  const canPrev = focused > 0
  const canNext = focused < options.length - 1

  return (
    <div className={cn('relative', className)}>
      {options.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous image"
            disabled={disabled || !canPrev}
            onClick={() => scrollToIndex(focused - 1)}
            className={cn(
              'absolute top-[42%] left-0 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-sm transition',
              canPrev ? 'hover:border-teal-300 hover:text-teal-800' : 'opacity-30',
              disabled && 'cursor-not-allowed',
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next image"
            disabled={disabled || !canNext}
            onClick={() => scrollToIndex(focused + 1)}
            className={cn(
              'absolute top-[42%] right-0 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-sm transition',
              canNext ? 'hover:border-teal-300 hover:text-teal-800' : 'opacity-30',
              disabled && 'cursor-not-allowed',
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      ) : null}

      <div
        ref={scrollerRef}
        role="listbox"
        aria-label="Image choices"
        aria-multiselectable={allowMultiple || undefined}
        tabIndex={0}
        onScroll={syncFocused}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' && focused > 0) {
            e.preventDefault()
            scrollToIndex(focused - 1)
          }
          if (e.key === 'ArrowRight' && focused < options.length - 1) {
            e.preventDefault()
            scrollToIndex(focused + 1)
          }
        }}
        className="ff-hide-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain py-2 outline-none"
        style={{
          paddingInline: 'max(0.75rem, calc(50% - 6.5rem))',
          scrollPaddingInline: 'max(0.75rem, calc(50% - 6.5rem))',
        }}
      >
        {options.map((opt, index) => {
          const on = selected.includes(opt.label)
          const centered = index === focused
          return (
            <button
              key={opt.filename + opt.label}
              ref={(node) => {
                cardRefs.current[index] = node
              }}
              type="button"
              role="option"
              aria-selected={on}
              disabled={disabled}
              onClick={() => selectCard(opt.label, index)}
              className={cn(
                'w-[13rem] shrink-0 snap-center overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition duration-300 ease-out',
                centered ? 'scale-100 opacity-100' : 'scale-90 opacity-60',
                on
                  ? 'border-teal-500 ring-2 ring-teal-500/30'
                  : 'border-slate-200 hover:border-teal-300',
                disabled && 'cursor-not-allowed',
              )}
            >
              {opt.url ? (
                <img src={opt.url} alt="" className="h-40 w-full object-cover sm:h-44" />
              ) : (
                <div className="grid h-40 place-items-center bg-slate-100 text-[11px] text-slate-400 sm:h-44">
                  Missing image
                </div>
              )}
              <span className="block truncate px-3 py-2.5 text-sm font-semibold text-slate-800">
                {opt.label}
              </span>
            </button>
          )
        })}
      </div>

      {options.length > 1 ? (
        <div className="mt-1 flex items-center justify-center gap-1.5" aria-hidden>
          {options.map((opt, index) => (
            <button
              key={opt.filename + opt.label}
              type="button"
              tabIndex={-1}
              disabled={disabled}
              onClick={() => scrollToIndex(index)}
              className={cn(
                'h-1.5 rounded-full transition-all',
                index === focused ? 'w-5 bg-teal-600' : 'w-1.5 bg-slate-300 hover:bg-slate-400',
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
