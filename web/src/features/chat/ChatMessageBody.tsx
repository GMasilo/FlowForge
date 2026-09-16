import { useEffect, useRef, useState } from 'react'
import { ChatMediaAttachments } from '@/features/chat/ChatMediaAttachments'
import { ChatFormattedText } from '@/features/chat/ChatFormattedText'
import { DocumentDownloadChip } from '@/features/chat/DocumentDownloadChip'
import { OpeningHoursCard } from '@/features/chat/OpeningHoursCard'
import { MapViewCard } from '@/features/chat/MapViewCard'
import { QrCodeCard } from '@/features/chat/QrCodeCard'
import { SocialEmbedCard } from '@/features/chat/SocialEmbedCard'
import { parseChatSegments, type ChatbotMediaFile } from '@/features/designer/model/chatbotMedia'
import type { ChatTypingStyle } from '@/features/chatbots/chatbotBranding'
import { cn } from '@/shared/lib/utils'

function TypewriterText({
  text,
  cps = 42,
  onProgress,
  onComplete,
}: {
  text: string
  cps?: number
  onProgress?: () => void
  onComplete?: () => void
}) {
  const [shown, setShown] = useState(0)
  const onProgressRef = useRef(onProgress)
  const onCompleteRef = useRef(onComplete)
  onProgressRef.current = onProgress
  onCompleteRef.current = onComplete

  useEffect(() => {
    setShown(0)
    if (!text) {
      onCompleteRef.current?.()
      return
    }

    let cancelled = false
    const interval = Math.max(12, Math.round(1000 / cps))
    let next = 0
    const id = window.setInterval(() => {
      if (cancelled) return
      next += 1
      if (next >= text.length) {
        window.clearInterval(id)
        setShown(text.length)
        // After paint so scrollHeight includes the final line.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!cancelled) onCompleteRef.current?.()
          })
        })
        return
      }
      setShown(next)
      requestAnimationFrame(() => {
        if (!cancelled) onProgressRef.current?.()
      })
    }, interval)

    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [text, cps])

  const slice = text.slice(0, shown)
  const done = shown >= text.length && text.length > 0
  return (
    <span className="whitespace-pre-wrap">
      <ChatFormattedText text={slice} />
      {!done ? <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-current align-middle opacity-70" /> : null}
    </span>
  )
}

export function ChatMessageBody({
  text,
  attachments,
  className,
  typingStyle = 'normal',
  typewriterCps,
  animateTypewriter = false,
  onTypewriterProgress,
  onTypewriterComplete,
}: {
  text?: string | null
  attachments?: ChatbotMediaFile[] | null
  className?: string
  typingStyle?: ChatTypingStyle
  /** Characters per second when typewriter is active (defaults to 42). */
  typewriterCps?: number
  /** When true and typingStyle is typewriter, reveal text character-by-character. */
  animateTypewriter?: boolean
  onTypewriterProgress?: () => void
  onTypewriterComplete?: () => void
}) {
  const segments = parseChatSegments(text ?? '')
  if (!segments.length && !attachments?.length) return null

  const useTypewriter = typingStyle === 'typewriter' && animateTypewriter

  return (
    <div className={cn('space-y-2', className)}>
      {segments.map((seg, i) =>
        seg.kind === 'text' ? (
          useTypewriter && i === 0 ? (
            <TypewriterText
              key={`t-${i}`}
              text={seg.text}
              cps={typewriterCps}
              onProgress={onTypewriterProgress}
              onComplete={onTypewriterComplete}
            />
          ) : (
            <ChatFormattedText key={`t-${i}`} text={seg.text} />
          )
        ) : seg.kind === 'document' ? (
          <DocumentDownloadChip key={`d-${i}-${seg.document.filename}`} document={seg.document} />
        ) : seg.kind === 'hours' ? (
          <OpeningHoursCard key={`h-${i}-${seg.hours.title}`} hours={seg.hours} />
        ) : seg.kind === 'map' ? (
          <MapViewCard key={`m-${i}-${seg.map.title}`} map={seg.map} />
        ) : seg.kind === 'qr' ? (
          <QrCodeCard key={`q-${i}-${seg.qr.payload}`} qr={seg.qr} />
        ) : seg.kind === 'social' ? (
          <SocialEmbedCard key={`s-${i}-${seg.social.provider}-${seg.social.id}`} embed={seg.social} />
        ) : (
          <ChatMediaAttachments key={`f-${i}-${seg.file.key}`} items={[seg.file]} className="mt-0" />
        ),
      )}
      <ChatMediaAttachments items={attachments} className={segments.length ? undefined : 'mt-0'} />
    </div>
  )
}
