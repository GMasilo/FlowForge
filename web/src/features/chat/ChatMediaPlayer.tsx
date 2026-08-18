import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { Music2, Pause, Play, Volume2, VolumeX, X } from 'lucide-react'
import { mediaKindOf, type ChatbotMediaFile } from '@/features/designer/model/chatbotMedia'
import { cn } from '@/shared/lib/utils'

type PlayerKind = 'audio' | 'video'

type ChatMediaPlayerApi = {
  open: (file: ChatbotMediaFile) => void
  close: () => void
}

const ChatMediaPlayerContext = createContext<ChatMediaPlayerApi | null>(null)

export function ChatMediaPlayerProvider({ children }: { children: ReactNode }) {
  const [file, setFile] = useState<ChatbotMediaFile | null>(null)
  const kind = file ? mediaKindOf(file) : null
  const playing = kind === 'audio' || kind === 'video' ? kind : null

  const close = useCallback(() => setFile(null), [])
  const open = useCallback((next: ChatbotMediaFile) => {
    const nextKind = mediaKindOf(next)
    if (nextKind === 'audio' || nextKind === 'video') setFile(next)
  }, [])

  const api = useMemo(() => ({ open, close }), [open, close])

  return (
    <ChatMediaPlayerContext.Provider value={api}>
      {children}
      {file && playing ? <MediaPlayerOverlay file={file} kind={playing} onClose={close} /> : null}
    </ChatMediaPlayerContext.Provider>
  )
}

export function useChatMediaPlayer(): ChatMediaPlayerApi {
  return useContext(ChatMediaPlayerContext) ?? { open: () => {}, close: () => {} }
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function SeekBar({
  progress,
  disabled,
  onSeekStart,
  onSeek,
  onSeekEnd,
}: {
  progress: number
  disabled?: boolean
  onSeekStart: () => void
  onSeek: (ratio: number) => void
  onSeekEnd: () => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const clamped = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0))

  function ratioFromClientX(clientX: number): number {
    const track = trackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    if (rect.width <= 0) return 0
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (disabled) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    onSeekStart()
    onSeek(ratioFromClientX(e.clientX))
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (disabled || !e.currentTarget.hasPointerCapture(e.pointerId)) return
    e.preventDefault()
    onSeek(ratioFromClientX(e.clientX))
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    e.preventDefault()
    e.stopPropagation()
    onSeek(ratioFromClientX(e.clientX))
    e.currentTarget.releasePointerCapture(e.pointerId)
    onSeekEnd()
  }

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      className={cn(
        'relative h-7 cursor-pointer touch-none select-none py-2',
        disabled && 'pointer-events-none cursor-default opacity-50',
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault()
          onSeek(Math.min(1, clamped + 0.05))
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault()
          onSeek(Math.max(0, clamped - 0.05))
        } else if (e.key === 'Home') {
          e.preventDefault()
          onSeek(0)
        } else if (e.key === 'End') {
          e.preventDefault()
          onSeek(1)
        }
      }}
    >
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/20">
        <div
          className="h-full rounded-full bg-teal-400"
          style={{ width: `${clamped * 100}%` }}
        />
      </div>
      <div
        className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow ring-2 ring-teal-400/80"
        style={{ left: `${clamped * 100}%` }}
      />
    </div>
  )
}

function MediaPlayerOverlay({
  file,
  kind,
  onClose,
}: {
  file: ChatbotMediaFile
  kind: PlayerKind
  onClose: () => void
}) {
  const [mediaEl, setMediaEl] = useState<HTMLVideoElement | HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(true)
  const [muted, setMuted] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const dragging = useRef(false)

  const bindMedia = useCallback((node: HTMLVideoElement | HTMLAudioElement | null) => {
    setMediaEl(node)
  }, [])

  useEffect(() => {
    if (!mediaEl) return
    const el = mediaEl
    const syncDuration = () => {
      const d = el.duration
      if (Number.isFinite(d) && d > 0) setDuration(d)
    }
    const onTime = () => {
      if (!dragging.current) setCurrent(el.currentTime)
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => {
      setPlaying(false)
      if (!dragging.current) setCurrent(el.currentTime)
    }
    const onSeeked = () => {
      setCurrent(el.currentTime)
      syncDuration()
    }
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', syncDuration)
    el.addEventListener('durationchange', syncDuration)
    el.addEventListener('loadeddata', syncDuration)
    el.addEventListener('canplay', syncDuration)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onEnded)
    el.addEventListener('seeked', onSeeked)
    syncDuration()
    void el.play().catch(() => setPlaying(false))
    return () => {
      el.pause()
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', syncDuration)
      el.removeEventListener('durationchange', syncDuration)
      el.removeEventListener('loadeddata', syncDuration)
      el.removeEventListener('canplay', syncDuration)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('ended', onEnded)
      el.removeEventListener('seeked', onSeeked)
    }
  }, [mediaEl, file.url])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === ' ' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault()
        const el = mediaEl
        if (!el) return
        if (el.paused) void el.play()
        else el.pause()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, mediaEl])

  function togglePlay() {
    const el = mediaEl
    if (!el) return
    if (el.paused) void el.play()
    else el.pause()
  }

  function seekTo(seconds: number) {
    const el = mediaEl
    if (!el) return
    const d = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : duration
    const next = d > 0 ? Math.min(d, Math.max(0, seconds)) : Math.max(0, seconds)
    try {
      el.currentTime = next
    } catch {
      /* some streams reject seeks until more data is buffered */
    }
    setCurrent(next)
  }

  function seekByRatio(ratio: number) {
    const d = duration > 0 ? duration : mediaEl?.duration
    if (!d || !Number.isFinite(d) || d <= 0) return
    seekTo(ratio * d)
  }

  function toggleMute() {
    const el = mediaEl
    if (!el) return
    el.muted = !el.muted
    setMuted(el.muted)
  }

  const progress = duration > 0 ? current / duration : 0

  return (
    <div className="absolute inset-0 z-[80] flex items-center justify-center">
      <button
        type="button"
        aria-label="Close player"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-xl"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative z-10 w-[90%] overflow-hidden rounded-2xl border border-white/20 bg-slate-950/90 shadow-[0_24px_64px_-16px_rgb(0_0_0_/_0.65)]',
          kind === 'video' ? 'max-h-[86%]' : null,
        )}
        role="dialog"
        aria-modal="true"
        aria-label={file.filename}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2.5 top-2.5 z-20 grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white/90 ring-1 ring-white/20 transition hover:bg-black/70"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {kind === 'video' ? (
          <video
            ref={bindMedia}
            src={file.url}
            playsInline
            preload="auto"
            className="block max-h-[min(420px,70vh)] w-full bg-black object-contain"
            onClick={togglePlay}
          />
        ) : (
          <div className="flex flex-col items-center gap-4 px-5 pb-2 pt-10">
            <audio ref={bindMedia} src={file.url} preload="auto" />
            <div
              className={cn(
                'grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-teal-400 to-cyan-600 text-white shadow-lg',
                playing ? 'animate-[ff-pulse-soft_1.8s_ease-in-out_infinite]' : null,
              )}
            >
              <Music2 className="h-8 w-8" />
            </div>
            <div className="flex h-6 items-end justify-center gap-0.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={cn(
                    'w-1 rounded-full bg-teal-300/90',
                    playing ? 'animate-pulse' : 'opacity-40',
                  )}
                  style={{
                    height: playing ? `${10 + ((i * 7) % 14)}px` : '6px',
                    animationDelay: `${i * 90}ms`,
                  }}
                />
              ))}
            </div>
            <p className="max-w-full truncate px-2 text-center text-sm font-medium text-white">{file.filename}</p>
          </div>
        )}

        <div className="space-y-2 bg-gradient-to-t from-black/80 to-black/30 px-3.5 py-3">
          {kind === 'video' ? (
            <p className="truncate text-[11px] font-medium text-white/80">{file.filename}</p>
          ) : null}
          <SeekBar
            progress={progress}
            disabled={!mediaEl || duration <= 0}
            onSeekStart={() => {
              dragging.current = true
            }}
            onSeek={(ratio) => {
              const d = duration > 0 ? duration : 0
              if (d > 0) setCurrent(ratio * d)
              seekByRatio(ratio)
            }}
            onSeekEnd={() => {
              dragging.current = false
            }}
          />
          <div className="flex items-center gap-2 text-white">
            <button
              type="button"
              onClick={togglePlay}
              className="grid h-9 w-9 place-items-center rounded-full bg-white text-slate-900 shadow-sm transition hover:bg-teal-50"
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
            </button>
            <span className="min-w-[4.5rem] font-mono text-[11px] tabular-nums text-white/80">
              {formatClock(current)} / {formatClock(duration)}
            </span>
            <span className="flex-1" />
            <button
              type="button"
              onClick={toggleMute}
              className="grid h-8 w-8 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function MediaPlayCard({
  file,
  kind,
}: {
  file: ChatbotMediaFile
  kind: PlayerKind
}) {
  const { open } = useChatMediaPlayer()
  return (
    <button
      type="button"
      onClick={() => open(file)}
      className={cn(
        'group relative block w-full overflow-hidden rounded-xl text-left ring-1 ring-slate-200/80 transition hover:ring-teal-300',
        kind === 'video' ? 'bg-slate-900' : 'bg-gradient-to-r from-slate-800 to-slate-900',
      )}
    >
      {kind === 'video' ? (
        <>
          <video src={file.url} muted preload="metadata" className="max-h-36 w-full object-cover opacity-80" />
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        </>
      ) : (
        <span className="block h-16" />
      )}
      <span className="absolute inset-0 flex items-center gap-3 px-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-slate-900 shadow-md transition group-hover:scale-105">
          <Play className="ml-0.5 h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-white">{file.filename}</span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-white/70">
            {kind === 'video' ? 'Video' : 'Audio'} · Play
          </span>
        </span>
      </span>
    </button>
  )
}
