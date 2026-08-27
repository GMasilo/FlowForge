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

/** Unauthenticated POST for public chat (session_id present). */
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

export type ConnectionTestResult = {
  ok: boolean
  message?: string
  status?: number
  data?: unknown
  schemaErrors?: string[]
  error?: string | null
  host?: string
  port?: number
  encryption?: string
}

export type UrlPreviewResult = {
  ok: boolean
  url: string
  title?: string | null
  description?: string | null
  site_name?: string | null
  icon?: string | null
  error?: string | null
}

export async function fetchUrlPreview(payload: {
  url: string
  signal?: AbortSignal
}): Promise<UrlPreviewResult> {
  const { signal, ...body } = payload
  return postJson<UrlPreviewResult>('/url/preview', body, { signal })
}

export async function sendOrganisationInviteEmail(payload: {
  inviteId: string
  signal?: AbortSignal
}): Promise<EmailSendResult & { email?: string; email_via?: string }> {
  const { inviteId, signal } = payload
  return postJson('/email/invite', { invite_id: inviteId }, { signal })
}

export async function inviteOrganisationMember(payload: {
  instanceId: string
  email: string
  role: string
  displayName?: string | null
  jobTitle?: string | null
  phone?: string | null
  department?: string | null
  notes?: string | null
  sendEmail?: boolean
  signal?: AbortSignal
}): Promise<{
  ok: boolean
  status: string
  email?: string
  invite_id?: string | null
  user_id?: string | null
  email_sent?: boolean
  email_skipped?: boolean
  email_error?: string | null
  email_via?: string | null
  error?: string
}> {
  const { signal, ...rest } = payload
  return postJson('/email/invite-member', {
    instance_id: rest.instanceId,
    email: rest.email,
    role: rest.role,
    display_name: rest.displayName ?? null,
    job_title: rest.jobTitle ?? null,
    phone: rest.phone ?? null,
    department: rest.department ?? null,
    notes: rest.notes ?? null,
    send_email: rest.sendEmail ?? true,
  }, { signal })
}

export async function resendOrganisationInvite(payload: {
  inviteId?: string
  instanceId?: string
  userId?: string
  email?: string
  signal?: AbortSignal
}): Promise<EmailSendResult & { email?: string; email_via?: string }> {
  const { signal, inviteId, instanceId, userId, email } = payload
  return postJson(
    '/email/invite-resend',
    {
      invite_id: inviteId,
      instance_id: instanceId,
      user_id: userId,
      email,
    },
    { signal },
  )
}

export async function testHttpConnection(payload: {
  connection: Record<string, unknown>
  method: string
  path: string
  body?: unknown
  headers?: Array<{ key: string; value: string }>
  query?: Record<string, string>
}): Promise<HttpExecuteResult> {
  return executeHttpConnection(payload)
}

export async function testEmailConnection(payload: {
  connection: Record<string, unknown>
}): Promise<ConnectionTestResult> {
  return postJson<ConnectionTestResult>('/email/test', payload)
}

export async function dispatchWebhook(payload: {
  instanceId: string
  event: string
  payload: unknown
  signal?: AbortSignal
}): Promise<{ ok: boolean; delivered?: number; error?: string | null }> {
  const { signal, instanceId, event, payload: eventPayload } = payload
  return postJson('/webhooks/dispatch', {
    instance_id: instanceId,
    event,
    payload: eventPayload,
  }, { signal })
}

export async function emitSessionWebhooks(payload: {
  sessionId: string
  signal?: AbortSignal
}): Promise<{ ok: boolean; event?: string; deliveries?: unknown[] }> {
  const { sessionId, signal } = payload
  return postJsonPublic('/webhooks/emit_session', { session_id: sessionId }, { signal })
}

export type PaymentStartResult = {
  ok: boolean
  reference: string
  provider: string
  status: string
  amount: string
  currency: string
  checkout_url: string
  notify_url: string
  fields: Record<string, string>
  error?: string | null
}

export type PaymentStatusResult = {
  ok: boolean
  reference: string
  status: 'pending' | 'verified' | 'failed' | 'cancelled' | string
  amount?: number | string | null
  currency?: string
  item_name?: string
  provider?: string
  provider_payment_id?: string | null
  verified_at?: string | null
  error?: string | null
}

export async function startPaymentIntent(payload: {
  connectionId: string
  chatbotId?: string
  instanceId?: string
  sessionId?: string
  nodeKey?: string
  amount: string | number
  currency?: string
  itemName?: string
  buyerEmail?: string
  buyerName?: string
  payUrl?: string
  returnUrl?: string
  cancelUrl?: string
  signal?: AbortSignal
}): Promise<PaymentStartResult> {
  const { signal, connectionId, chatbotId, instanceId, sessionId, ...rest } = payload
  const body = {
    connection_id: connectionId,
    chatbot_id: chatbotId,
    ...(instanceId ? { instance_id: instanceId } : {}),
    ...(sessionId ? { session_id: sessionId } : {}),
    node_key: rest.nodeKey,
    amount: rest.amount,
    currency: rest.currency,
    item_name: rest.itemName,
    buyer_email: rest.buyerEmail,
    buyer_name: rest.buyerName,
    pay_url: rest.payUrl,
    return_url: rest.returnUrl,
    cancel_url: rest.cancelUrl,
  }
  if (isPublicSessionPost(sessionId)) {
    return postJsonPublic('/payment/start', body, { signal })
  }
  return postJson('/payment/start', body, { signal })
}

export async function getPaymentStatus(payload: {
  reference: string
  chatbotId?: string
  sessionId?: string
  signal?: AbortSignal
}): Promise<PaymentStatusResult> {
  const { signal, ...rest } = payload
  const body = {
    reference: rest.reference,
    chatbot_id: rest.chatbotId,
    ...(rest.sessionId ? { session_id: rest.sessionId } : {}),
  }
  if (isPublicSessionPost(rest.sessionId)) {
    return postJsonPublic('/payment/status', body, { signal })
  }
  return postJson('/payment/status', body, { signal })
}

export type InstanceFileKind = 'media' | 'conversation'

export type InstanceFileUploadResult = {
  ok: boolean
  kind: InstanceFileKind
  instance_id: string
  chatbot_id: string
  session_id?: string | null
  node_key?: string | null
  original_name: string
  filename: string
  key?: string
  size: number
  path: string
  url: string
}

export type DesignerMediaFile = {
  filename: string
  key: string
  size: number
  mime: string
  modified_at: string
  url: string
  path: string
}

async function authToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) {
    throw new Error('Sign in required to use connections')
  }
  return token
}

async function postForm<T>(
  path: string,
  form: FormData,
  init?: { signal?: AbortSignal; public?: boolean },
): Promise<T> {
  if (!API_BASE) {
    throw new Error('VITE_FLOWFORGE_API_URL is not configured')
  }
  const headers: HeadersInit = {}
  if (!init?.public) {
    headers.Authorization = `Bearer ${await authToken()}`
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: form,
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

export function instanceFileUrl(payload: {
  kind: InstanceFileKind
  instanceId: string
  chatbotId: string
  filename: string
  sessionId?: string
}): string {
  if (!API_BASE) {
    throw new Error('VITE_FLOWFORGE_API_URL is not configured')
  }
  const params = new URLSearchParams({
    kind: payload.kind,
    instance_id: payload.instanceId,
    chatbot_id: payload.chatbotId,
    name: payload.filename,
  })
  if (payload.sessionId) params.set('session_id', payload.sessionId)
  return `${API_BASE}/file/get?${params.toString()}`
}

export async function uploadDesignerMedia(payload: {
  instanceId: string
  chatbotId: string
  file: File
  signal?: AbortSignal
}): Promise<InstanceFileUploadResult> {
  const form = new FormData()
  form.set('kind', 'media')
  form.set('instance_id', payload.instanceId)
  form.set('chatbot_id', payload.chatbotId)
  form.set('file', payload.file, payload.file.name)
  return postForm('/file/upload', form, { signal: payload.signal })
}

export async function uploadConversationFile(payload: {
  instanceId: string
  chatbotId: string
  sessionId: string
  nodeKey: string
  file: File
  fileIndex?: number
  signal?: AbortSignal
}): Promise<InstanceFileUploadResult> {
  const form = new FormData()
  form.set('kind', 'conversation')
  form.set('instance_id', payload.instanceId)
  form.set('chatbot_id', payload.chatbotId)
  form.set('session_id', payload.sessionId)
  form.set('node_key', payload.nodeKey)
  if (payload.fileIndex != null && payload.fileIndex > 0) {
    form.set('file_index', String(payload.fileIndex))
  }
  form.set('file', payload.file, payload.file.name)
  return postForm('/file/upload', form, { signal: payload.signal, public: true })
}

async function getJson<T>(path: string, init?: { signal?: AbortSignal }): Promise<T> {
  if (!API_BASE) {
    throw new Error('VITE_FLOWFORGE_API_URL is not configured')
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${await authToken()}`,
    },
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

export async function listDesignerMedia(payload: {
  instanceId: string
  chatbotId: string
  signal?: AbortSignal
}): Promise<DesignerMediaFile[]> {
  const params = new URLSearchParams({
    kind: 'media',
    instance_id: payload.instanceId,
    chatbot_id: payload.chatbotId,
  })
  const json = await getJson<{ ok: boolean; files?: DesignerMediaFile[] }>(`/file/list?${params.toString()}`, {
    signal: payload.signal,
  })
  return (json.files ?? []).map((f) => ({ ...f, url: absoluteInstanceFileUrl(f.url) }))
}

export async function deleteDesignerMedia(payload: {
  instanceId: string
  chatbotId: string
  filename: string
  signal?: AbortSignal
}): Promise<void> {
  await postJson('/file/delete', {
    kind: 'media',
    instance_id: payload.instanceId,
    chatbot_id: payload.chatbotId,
    name: payload.filename,
  }, { signal: payload.signal })
}

/** Remove on-disk media + conversation files for a chatbot (admin/owner). */
export async function purgeChatbotFiles(payload: {
  instanceId: string
  chatbotId: string
  signal?: AbortSignal
}): Promise<void> {
  await postJson('/file/purge', {
    instance_id: payload.instanceId,
    chatbot_id: payload.chatbotId,
  }, { signal: payload.signal })
}

export function absoluteInstanceFileUrl(relativeOrAbsolute: string): string {
  if (/^https?:\/\//i.test(relativeOrAbsolute)) return relativeOrAbsolute
  if (!API_BASE) return relativeOrAbsolute
  const path = relativeOrAbsolute.startsWith('/') ? relativeOrAbsolute : `/${relativeOrAbsolute}`
  return `${API_BASE}${path}`
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
