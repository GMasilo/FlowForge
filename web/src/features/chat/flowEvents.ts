import { FLOWFORGE_EMBED_SOURCE, isEmbeddedFrame } from '@/features/chat/embedBridge'

export const FLOWFORGE_HOST_SOURCE = 'flowforge.host' as const

/** Chat → host: button emit_event action. */
export type FlowForgeFlowEventMessage = {
  source: typeof FLOWFORGE_EMBED_SOURCE
  type: 'flow_event'
  eventName: string
  value: string
  payload?: unknown
  sessionId?: string | null
  nodeKey?: string
}

/** Chat → host: button run_function action. */
export type FlowForgeRunFunctionMessage = {
  source: typeof FLOWFORGE_EMBED_SOURCE
  type: 'run_function'
  name: string
  args?: unknown
  value: string
  sessionId?: string | null
  nodeKey?: string
}

export function emitFlowEvent(message: Omit<FlowForgeFlowEventMessage, 'source' | 'type'>): void {
  if (!isEmbeddedFrame()) return
  try {
    const payload: FlowForgeFlowEventMessage = {
      source: FLOWFORGE_EMBED_SOURCE,
      type: 'flow_event',
      ...message,
    }
    window.parent.postMessage(payload, '*')
  } catch {
    // ignore
  }
}

export function emitRunFunction(message: Omit<FlowForgeRunFunctionMessage, 'source' | 'type'>): void {
  if (!isEmbeddedFrame()) return
  try {
    const payload: FlowForgeRunFunctionMessage = {
      source: FLOWFORGE_EMBED_SOURCE,
      type: 'run_function',
      ...message,
    }
    window.parent.postMessage(payload, '*')
  } catch {
    // ignore
  }
}

export function parseListenerPayload(raw: string): unknown {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return trimmed
  }
}
