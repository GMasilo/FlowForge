import { supabase } from '@/shared/lib/supabase'

const API_BASE = (import.meta.env.VITE_FLOWFORGE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export function isFlowForgeApiConfigured(): boolean {
  return API_BASE.length > 0
}

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) {
    throw new Error('Sign in required to use connections')
  }
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function postJsonRaw<T>(
  path: string,
  body: unknown,
  init?: { signal?: AbortSignal; headers?: HeadersInit },
): Promise<T> {
  if (!API_BASE) {
    throw new Error('VITE_FLOWFORGE_API_URL is not configured')
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: init?.headers ?? (await authHeaders()),
    body: JSON.stringify(body),
    credentials: 'omit',
    signal: init?.signal,
  })

  let json: unknown = null
  try {
    json = await res.json()
  } catch {
    throw new Error(`API error (${res.status})`)
  }

  if (!res.ok) {
    const message =
      json && typeof json === 'object' && 'error' in json && typeof (json as { error: unknown }).error === 'string'
        ? (json as { error: string }).error
        : `API error (${res.status})`
    throw new Error(message)
  }

  return json as T
}

async function postJson<T>(path: string, body: unknown, init?: { signal?: AbortSignal }): Promise<T> {
  return postJsonRaw<T>(path, body, init)
}

async function postJsonPublic<T>(
  path: string,
  body: unknown,
  init?: { signal?: AbortSignal },
): Promise<T> {
  return postJsonRaw<T>(path, body, {
    signal: init?.signal,
    headers: { 'Content-Type': 'application/json' },
  })
}

export type HttpExecuteResult = {
  ok: boolean
  status: number
  headers: Record<string, string>
  data: unknown
  error?: string | null
}

export type EmailSendResult = {
  ok: boolean
  message_id?: string | null
  error?: string | null
}

type ConnectionApiContext = {
  connectionId?: string
  chatbotId?: string
  instanceId?: string
  sessionId?: string
}

function isPublicSessionPost(sessionId?: string): boolean {
  return !!sessionId
}

export async function executeHttpConnection(payload: {
  connection?: Record<string, unknown>
  connectionId?: string
  chatbotId?: string
  instanceId?: string
  sessionId?: string
  method: string
  path: string
  body?: unknown
  headers?: Record<string, string> | Array<{ key: string; value: string }>
  query?: Record<string, string>
  signal?: AbortSignal
}): Promise<HttpExecuteResult> {
  const { signal, connection, connectionId, chatbotId, instanceId, sessionId, ...rest } = payload

  let body: Record<string, unknown>
  if (connectionId) {
    body = {
      connection_id: connectionId,
      chatbot_id: chatbotId,
      ...(instanceId ? { instance_id: instanceId } : {}),
      ...(sessionId ? { session_id: sessionId } : {}),
      ...(!sessionId && connection ? { connection } : {}),
      ...rest,
    }
  } else if (connection) {
    body = { connection, ...rest }
  } else {
    throw new Error('connection_id or connection is required')
  }

  if (isPublicSessionPost(sessionId)) {
    return postJsonPublic<HttpExecuteResult>('/http/execute', body, { signal })
  }
  return postJson<HttpExecuteResult>('/http/execute', body, { signal })
}

export async function sendEmailConnection(payload: {
  connection?: Record<string, unknown>
  connectionId?: string
  chatbotId?: string
  instanceId?: string
  sessionId?: string
  to: string
  subject: string
  body: string
  replyTo?: string
  signal?: AbortSignal
}): Promise<EmailSendResult> {
  const { signal, connection, connectionId, chatbotId, instanceId, sessionId, ...rest } = payload

  let body: Record<string, unknown>
  if (connectionId) {
    body = {
      connection_id: connectionId,
      chatbot_id: chatbotId,
      ...(instanceId ? { instance_id: instanceId } : {}),
      ...(sessionId ? { session_id: sessionId } : {}),
      ...(!sessionId && connection ? { connection } : {}),
      ...rest,
    }
  } else if (connection) {
    body = { connection, ...rest }
  } else {
    throw new Error('connection_id or connection is required')
  }

  if (isPublicSessionPost(sessionId)) {
    return postJsonPublic<EmailSendResult>('/email/send', body, { signal })
  }
  return postJson<EmailSendResult>('/email/send', body, { signal })
}

export type IntegrationExecuteResult = {
  ok: boolean
  status: number
  data: unknown
  error?: string | null
}

export async function executeIntegrationAction(payload: {
  integrationId: string
  instanceId: string
  chatbotId?: string
  sessionId?: string
  action: string
  fields: Record<string, string>
  signal?: AbortSignal
}): Promise<IntegrationExecuteResult> {
  const body = {
    integration_id: payload.integrationId,
    instance_id: payload.instanceId,
    chatbot_id: payload.chatbotId,
    session_id: payload.sessionId,
    action: payload.action,
    fields: payload.fields,
  }
  const json = payload.sessionId
    ? await postJsonPublic<{ ok: boolean; status?: number; data?: unknown; error?: string | null }>(
        '/integration/execute',
        body,
        { signal: payload.signal },
      )
    : await postJson<{ ok: boolean; status?: number; data?: unknown; error?: string | null }>(
        '/integration/execute',
        body,
        { signal: payload.signal },
      )
  return {
    ok: !!json.ok,
    status: json.status ?? (json.ok ? 200 : 500),
    data: json.data ?? null,
    error: json.error ?? null,
  }
}

export type { ConnectionApiContext }
export { postJsonPublic }
