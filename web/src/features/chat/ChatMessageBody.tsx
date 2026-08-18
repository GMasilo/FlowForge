import { ChatMediaAttachments } from '@/features/chat/ChatMediaAttachments'
import { parseChatSegments, type ChatbotMediaFile } from '@/features/designer/model/chatbotMedia'
import { cn } from '@/shared/lib/utils'

export function ChatMessageBody({
  text,
  attachments,
  className,
}: {
  text?: string | null
  attachments?: ChatbotMediaFile[] | null
  className?: string
}) {
  const segments = parseChatSegments(text ?? '')
  if (!segments.length && !attachments?.length) return null

  return (
    <div className={cn('space-y-2', className)}>
      {segments.map((seg, i) =>
        seg.kind === 'text' ? (
          <p key={`t-${i}`} className="whitespace-pre-wrap break-words">
            {seg.text}
          </p>
        ) : (
          <ChatMediaAttachments key={`f-${i}-${seg.file.key}`} items={[seg.file]} className="mt-0" />
        ),
      )}
      <ChatMediaAttachments items={attachments} className={segments.length ? undefined : 'mt-0'} />
    </div>
  )
}
