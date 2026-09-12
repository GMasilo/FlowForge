import type { DesignerEdge, DesignerNode } from '@/features/designer/model/flowSchema'
import type { PreviewEngineState } from '@/features/designer/preview/previewRuntime'
import type { ResolvedChatBranding } from '@/features/chatbots/chatbotBranding'

export const SSO_PENDING_STORAGE_KEY = 'ff-chat-sso-pending'
export const SSO_RESULT_STORAGE_KEY = 'ff-chat-sso-result'
export const SSO_MESSAGE_SOURCE = 'flowforge-sso'

export type ChatSsoSnapshot = {
  sessionId: string
  chatbotId: string
  instanceId: string
  botName: string
  publicSlug: string | null
  testToken: string | null
  embed: boolean
  stagingTest: boolean
  state: PreviewEngineState
  nodes: DesignerNode[]
  edges: DesignerEdge[]
  branding: ResolvedChatBranding | null
}

export type PendingSsoLaunch = {
  state: string
  chatbotId: string
  nodeId: string
  templateKey: string
  returnPath: string
  createdAt: number
  protocol: 'saml' | 'oidc'
  snapshot: ChatSsoSnapshot | null
}

export type SsoCallbackResult = {
  state: string
  ok: boolean
  claims?: Record<string, unknown>
  error?: string
  returnPath?: string
}

export function storePendingSsoLaunch(pending: PendingSsoLaunch): void {
  try {
    sessionStorage.setItem(SSO_PENDING_STORAGE_KEY, JSON.stringify(pending))
  } catch {
    // ignore quota / private mode
  }
}

export function readPendingSsoLaunch(): PendingSsoLaunch | null {
  try {
    const raw = sessionStorage.getItem(SSO_PENDING_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingSsoLaunch
    if (!parsed || typeof parsed.state !== 'string' || !parsed.state) return null
    return parsed
  } catch {
    return null
  }
}

export function clearPendingSsoLaunch(): void {
  try {
    sessionStorage.removeItem(SSO_PENDING_STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function storeSsoCallbackResult(result: SsoCallbackResult): void {
  try {
    sessionStorage.setItem(SSO_RESULT_STORAGE_KEY, JSON.stringify(result))
  } catch {
    // ignore
  }
}

export function readSsoCallbackResult(): SsoCallbackResult | null {
  try {
    const raw = sessionStorage.getItem(SSO_RESULT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SsoCallbackResult
    if (!parsed || typeof parsed.state !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

export function clearSsoCallbackResult(): void {
  try {
    sessionStorage.removeItem(SSO_RESULT_STORAGE_KEY)
  } catch {
    // ignore
  }
}

/** API ACS / OIDC redirect URI for visitor SSO. */
export function chatSsoCallbackUrl(): string {
  const env = (import.meta.env.VITE_FLOWFORGE_API_URL as string | undefined)?.replace(/\/$/, '')
  if (env) return `${env}/chat/sso_callback`
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  return `${window.location.origin}${base}/api/chat/sso_callback`
}

/**
 * Pack RelayState / OIDC state so the API callback can load the SSO template
 * and return to the correct chat URL.
 */
export function packSsoRelayState(args: {
  nonce: string
  chatbotId: string
  templateKey: string
  returnPath: string
  protocol: 'saml' | 'oidc'
}): string {
  const payload = {
    v: 1,
    n: args.nonce,
    c: args.chatbotId,
    t: args.templateKey,
    r: args.returnPath,
    p: args.protocol,
  }
  const json = JSON.stringify(payload)
  const b64 =
    typeof btoa === 'function'
      ? btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      : json
  return `ff1.${b64}`
}

export function isSsoMessage(data: unknown): data is SsoCallbackResult & { source: string } {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false
  const rec = data as Record<string, unknown>
  return rec.source === SSO_MESSAGE_SOURCE && typeof rec.state === 'string'
}
