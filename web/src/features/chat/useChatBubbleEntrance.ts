import { useEffect, useRef } from 'react'

/**
 * Animate only bubbles that appear after the first paint of a transcript.
 * Restored history / boot batches stay still; live replies get entrance motion.
 */
export function useChatBubbleEntrance(
  messages: ReadonlyArray<{ id: string }> | null | undefined,
): (messageId: string) => boolean {
  const baselineRef = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (!messages) {
      baselineRef.current = null
      return
    }
    if (messages.length === 0) {
      baselineRef.current = new Set()
      return
    }
    if (baselineRef.current === null) {
      baselineRef.current = new Set(messages.map((m) => m.id))
    }
  }, [messages])

  return (messageId: string) => {
    const baseline = baselineRef.current
    // First paint (or before effect seeds): treat as history — no motion.
    if (baseline === null || baseline.has(messageId)) return false
    return true
  }
}
