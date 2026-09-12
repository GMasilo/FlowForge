/** Parent ↔ iframe messaging for FlowForge public chat embeds. */

declare global {
  interface Window {
    FlowForgeEmbed?: {
      init: (config: {
        slug: string
        org?: string
        base?: string
        env?: string
        height?: string
        width?: string
        title?: string
        panelTitle?: string
        panelSubtitle?: string
        position?: string
      }) => unknown
      refresh: () => void
      mount: (el: Element) => void
      destroy: (key?: string) => void
      open: (key?: string) => void
      close: (key?: string) => void
      toggle: (key?: string) => void
      reload: (key?: string) => void
    }
  }
}

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
  | {
      source: typeof FLOWFORGE_EMBED_SOURCE
      type: 'branding'
      slug: string
      headerColor: string
      accentColor: string
      logoUrl: string | null
      logoIcon: string | null
    }
  | {
      source: typeof FLOWFORGE_EMBED_SOURCE
      type: 'flow_event'
      eventName: string
      value: string
      payload?: unknown
      sessionId?: string | null
      nodeKey?: string
    }
  | {
      source: typeof FLOWFORGE_EMBED_SOURCE
      type: 'run_function'
      name: string
      args?: unknown
      value: string
      sessionId?: string | null
      nodeKey?: string
    }

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
