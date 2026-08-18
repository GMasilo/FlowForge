/** Parent ↔ iframe messaging for FlowForge public chat embeds. */

export const FLOWFORGE_EMBED_SOURCE = 'flowforge.embed' as const

export type FlowForgeEmbedMessage =
  | { source: typeof FLOWFORGE_EMBED_SOURCE; type: 'ready'; slug: string; sessionId: string | null }
  | { source: typeof FLOWFORGE_EMBED_SOURCE; type: 'resize'; height: number }
  | {
      source: typeof FLOWFORGE_EMBED_SOURCE
      type: 'complete'
      status: 'completed' | 'failed' | 'abandoned'
      sessionId: string | null
    }
  | { source: typeof FLOWFORGE_EMBED_SOURCE; type: 'error'; message: string }

export function isEmbeddedFrame(): boolean {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

export function postToEmbedParent(message: FlowForgeEmbedMessage): void {
  if (!isEmbeddedFrame()) return
  try {
    window.parent.postMessage(message, '*')
  } catch {
    // ignore cross-origin postMessage failures
  }
}
