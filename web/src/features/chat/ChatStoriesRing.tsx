import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { ResolvedChatStory } from '@/features/chatbots/chatbotBranding'
import {
  STORY_DEFAULT_IMAGE_MS,
  STORY_MAX_VIDEO_MS,
  hasUnreadStories,
  markStoriesSeen,
} from '@/features/chat/chatStories'
import { cn } from '@/shared/lib/utils'

function storyIsVideo(story: ResolvedChatStory): boolean {
  if (story.kind === 'video') return true
  if (story.kind === 'image') return false
  return /\.(mp4|webm)(\?|$)/i.test(story.url || story.filename)
}

export function ChatStoriesViewer({
  stories,
  chatbotId,
  startIndex = 0,
  onClose,
  mode = 'fixed',
  portalTarget = null,
}: {
  stories: ResolvedChatStory[]
  chatbotId: string
  startIndex?: number
  onClose: () => void
  mode?: 'fixed' | 'absolute'
  portalTarget?: HTMLElement | null
}) {
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(0, startIndex), Math.max(0, stories.length - 1)),
  )
  const [playNonce, setPlayNonce] = useState(0)

  const fillRefs = useRef<Array<HTMLDivElement | null>>([])
  const videoRef = useRef<HTMLVideoElement>(null)
  const timerRef = useRef<number | null>(null)
  const indexRef = useRef(index)
  const storiesRef = useRef(stories)
  const onCloseRef = useRef(onClose)
  const holdingRef = useRef(false)
  const holdStartedAtRef = useRef<number | null>(null)

  indexRef.current = index
  storiesRef.current = stories
  onCloseRef.current = onClose

  const story = stories[index]
  const storyIds = stories.map((s) => s.id).join('|')

  const paintFills = useCallback((activeIndex: number, activeProgress: number) => {
    fillRefs.current.forEach((el, i) => {
      if (!el) return
      const value = i < activeIndex ? 1 : i === activeIndex ? activeProgress : 0
      // Imperative only — React must not re-apply width on parent re-renders.
      el.style.width = `${Math.round(Math.max(0, Math.min(1, value)) * 1000) / 10}%`
    })
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const goNext = useCallback(() => {
    clearTimer()
    if (indexRef.current >= storiesRef.current.length - 1) {
      onCloseRef.current()
      return
    }
    setIndex((i) => i + 1)
  }, [clearTimer])

  const goPrev = useCallback(() => {
    clearTimer()
    if (indexRef.current <= 0) {
      paintFills(0, 0)
      setPlayNonce((n) => n + 1)
      return
    }
    setIndex((i) => i - 1)
  }, [clearTimer, paintFills])

  useEffect(() => {
    if (!stories.length) onClose()
  }, [stories.length, onClose])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current()
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev])

  // Drive the active segment. Progress is written only via DOM refs so parent
  // re-renders (chat messages / typing) cannot reset the bar to 0%.
  useEffect(() => {
    const active = storiesRef.current[index]
    if (!active) return

    markStoriesSeen(chatbotId, [active.id])
    holdingRef.current = false
    holdStartedAtRef.current = null
    clearTimer()

    // Defer first paint so portal refs are attached.
    const kickoff = window.requestAnimationFrame(() => {
      paintFills(index, 0)
    })

    if (storyIsVideo(active)) {
      const startVideo = () => {
        const el = videoRef.current
        if (!el) return
        el.currentTime = 0
        void el.play().catch(() => undefined)
      }
      const id = window.setTimeout(startVideo, 0)
      return () => {
        window.cancelAnimationFrame(kickoff)
        window.clearTimeout(id)
        clearTimer()
      }
    }

    const duration = Math.max(1500, active.durationMs ?? STORY_DEFAULT_IMAGE_MS)
    const startedAt = performance.now()
    let pausedAt: number | null = null
    let pausedTotal = 0

    timerRef.current = window.setInterval(() => {
      const now = performance.now()
      // Only treat as hold-pause after a short delay so taps don't freeze the bar.
      const holding =
        holdingRef.current &&
        holdStartedAtRef.current != null &&
        now - holdStartedAtRef.current >= 180
      if (holding) {
        if (pausedAt == null) pausedAt = now
        return
      }
      if (pausedAt != null) {
        pausedTotal += now - pausedAt
        pausedAt = null
      }
      const elapsed = now - startedAt - pausedTotal
      const p = Math.min(1, elapsed / duration)
      paintFills(index, p)
      if (p >= 1) goNext()
    }, 50)

    return () => {
      window.cancelAnimationFrame(kickoff)
      clearTimer()
    }
    // storyIds catches content changes without resetting on array identity churn.
  }, [index, playNonce, storyIds, chatbotId, paintFills, clearTimer, goNext])

  if (!story) return null

  const beginHold = () => {
    holdingRef.current = true
    holdStartedAtRef.current = performance.now()
  }
  const endHold = () => {
    holdingRef.current = false
    holdStartedAtRef.current = null
  }

  const ui = (
    <div
      className={cn(
        'flex flex-col bg-black text-white',
        mode === 'fixed' ? 'fixed inset-0 z-[200]' : 'absolute inset-0 z-[80]',
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Stories"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex gap-1 px-3 pt-3">
        {stories.map((s, i) => (
          <div key={s.id} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/30">
            <div
              ref={(el) => {
                fillRefs.current[i] = el
                if (el) {
                  // Seed completed/upcoming segments; active is owned by the timer.
                  if (i < index) el.style.width = '100%'
                  else if (i > index) el.style.width = '0%'
                }
              }}
              className="h-full rounded-full bg-white"
              // No React-controlled width — parent re-renders must not wipe progress.
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-3 py-2">
        <p className="truncate text-xs font-medium text-white/80">
          {index + 1} / {stories.length}
        </p>
        <button
          type="button"
          className="rounded-lg p-1.5 text-white/85 transition hover:bg-white/15 hover:text-white"
          aria-label="Close stories"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center select-none"
        onPointerDown={beginHold}
        onPointerUp={endHold}
        onPointerLeave={endHold}
        onPointerCancel={endHold}
      >
        <button
          type="button"
          className="absolute inset-y-0 left-0 z-10 w-[28%] bg-transparent"
          aria-label="Previous story"
          onPointerDown={(e) => {
            e.stopPropagation()
            endHold()
          }}
          onClick={(e) => {
            e.stopPropagation()
            goPrev()
          }}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 z-10 w-[28%] bg-transparent"
          aria-label="Next story"
          onPointerDown={(e) => {
            e.stopPropagation()
            endHold()
          }}
          onClick={(e) => {
            e.stopPropagation()
            goNext()
          }}
        />

        {storyIsVideo(story) ? (
          <video
            key={story.id}
            ref={videoRef}
            src={story.url}
            className="max-h-full max-w-full object-contain"
            playsInline
            autoPlay
            onTimeUpdate={(e) => {
              const el = e.currentTarget
              const raw = el.duration
              if (!raw || !Number.isFinite(raw) || raw <= 0) return
              const dur = Math.min(raw, STORY_MAX_VIDEO_MS / 1000)
              paintFills(indexRef.current, Math.min(1, el.currentTime / dur))
            }}
            onEnded={goNext}
          />
        ) : (
          <img
            key={story.id}
            src={story.url}
            alt=""
            className="max-h-full max-w-full object-contain"
            draggable={false}
          />
        )}
      </div>

      {story.caption ? (
        <p className="border-t border-white/10 bg-black/50 px-4 py-3 text-center text-sm text-white/95">
          {story.caption}
        </p>
      ) : (
        <div className="h-3" />
      )}
    </div>
  )

  if (mode === 'fixed' && typeof document !== 'undefined') {
    return createPortal(ui, document.body)
  }
  if (mode === 'absolute' && portalTarget) {
    return createPortal(ui, portalTarget)
  }
  return ui
}

export function ChatStoriesRing({
  stories,
  chatbotId,
  size = 'md',
  className,
  children,
  viewerMode = 'fixed',
  portalTarget = null,
}: {
  stories: ResolvedChatStory[]
  chatbotId: string
  size?: 'sm' | 'md'
  className?: string
  children: ReactNode
  viewerMode?: 'fixed' | 'absolute'
  portalTarget?: HTMLElement | null
}) {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(() => hasUnreadStories(stories, chatbotId))

  useEffect(() => {
    setUnread(hasUnreadStories(stories, chatbotId))
  }, [stories, chatbotId])

  if (!stories.length) {
    return <span className={cn(className)}>{children}</span>
  }

  const pad = size === 'sm' ? 'p-[2.5px]' : 'p-[3px]'

  return (
    <>
      <button
        type="button"
        aria-label={unread ? 'View new stories' : 'View stories'}
        title="View stories"
        className={cn(
          'relative z-[1] shrink-0 rounded-full transition hover:brightness-110',
          pad,
          unread
            ? 'bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600'
            : 'bg-gradient-to-tr from-white/70 via-white/40 to-white/20 ring-1 ring-white/50',
          className,
        )}
        onClick={() => {
          setOpen(true)
          setUnread(false)
        }}
      >
        <span className="block overflow-hidden rounded-full bg-black/25 shadow-inner">{children}</span>
      </button>
      {open ? (
        <ChatStoriesViewer
          stories={stories}
          chatbotId={chatbotId}
          mode={viewerMode}
          portalTarget={portalTarget}
          onClose={() => {
            setOpen(false)
            setUnread(hasUnreadStories(stories, chatbotId))
          }}
        />
      ) : null}
    </>
  )
}
