/**
 * Document file handlers — instance media and conversation uploads (PDF, Office, images, etc.).
 * Not the same as chatbot_templates; these are stored files under files/{instance}/{chatbot}/.
 */

import { supabase } from '@/shared/lib/supabase'
import {
  absoluteInstanceFileUrl,
  deleteDesignerMedia,
  instanceFileUrl,
  isFlowForgeApiConfigured,
  listDesignerMedia,
  uploadConversationFile,
  uploadDesignerMedia,
} from '@/shared/lib/flowforgeApi'

export type DocumentKind = 'media' | 'conversation'

export interface DocumentInfo {
  filename: string
  key: string
  kind: DocumentKind
  size: number
  mime: string
  extension: string
  modified_at: string
  url: string
  path: string
  is_image: boolean
  is_video: boolean
  is_audio: boolean
  is_pdf: boolean
  is_text: boolean
  is_office_doc: boolean
  preview?: string | null
  image_info?: {
    width: number
    height: number
    type: string
  } | null
  readable: boolean
}

export interface DocumentFile {
  filename: string
  key: string
  size: number
  mime: string
  modified_at: string
  url: string
  path: string
}

export type DocumentScope = {
  instanceId: string
  chatbotId: string
  kind?: DocumentKind
}

const API_BASE = (import.meta.env.VITE_FLOWFORGE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

function requireApiBase(): string {
  if (!API_BASE) {
    throw new Error('VITE_FLOWFORGE_API_URL is not configured')
  }
  return API_BASE
}

async function authToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) {
    throw new Error('Sign in required')
  }
  return token
}

function documentQuery(
  instanceId: string,
  chatbotId: string,
  filename: string,
  kind: DocumentKind,
): URLSearchParams {
  return new URLSearchParams({
    instance_id: instanceId,
    chatbot_id: chatbotId,
    name: filename,
    kind,
  })
}

async function apiGetJson<T>(path: string): Promise<T> {
  const base = requireApiBase()
  const res = await fetch(`${base}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${await authToken()}` },
    credentials: 'omit',
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

async function apiPostJson<T>(path: string, body: unknown): Promise<T> {
  const base = requireApiBase()
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await authToken()}`,
      'Content-Type': 'application/json',
    },
    credentials: 'omit',
    body: JSON.stringify(body),
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

async function apiGetBlob(path: string): Promise<Blob> {
  const base = requireApiBase()
  const res = await fetch(`${base}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${await authToken()}` },
    credentials: 'omit',
  })
  if (!res.ok) {
    let message = `API error (${res.status})`
    try {
      const json = (await res.json()) as { error?: string }
      if (json.error) message = json.error
    } catch {
      /* binary error body */
    }
    throw new Error(message)
  }
  return res.blob()
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** View document metadata and optional text/image preview. */
export async function viewDocument(
  instanceId: string,
  chatbotId: string,
  filename: string,
  kind: DocumentKind = 'media',
): Promise<DocumentInfo> {
  const params = documentQuery(instanceId, chatbotId, filename, kind)
  return apiGetJson<DocumentInfo>(`/document/view?${params}`)
}

/** Download document (forces browser save dialog). */
export async function downloadDocument(
  instanceId: string,
  chatbotId: string,
  filename: string,
  kind: DocumentKind = 'media',
): Promise<void> {
  const params = documentQuery(instanceId, chatbotId, filename, kind)
  const blob = await apiGetBlob(`/document/download?${params}`)
  triggerBlobDownload(blob, filename)
}

/** Open document inline in a new browser tab (uses /file/get). */
export function openDocument(
  instanceId: string,
  chatbotId: string,
  filename: string,
  kind: DocumentKind = 'media',
): void {
  const url = absoluteInstanceFileUrl(
    instanceFileUrl({ kind, instanceId, chatbotId, filename }),
  )
  window.open(url, '_blank', 'noopener,noreferrer')
}

export async function renameDocument(
  instanceId: string,
  chatbotId: string,
  oldName: string,
  newName: string,
  kind: DocumentKind = 'media',
): Promise<{ ok: boolean; old_name: string; new_name: string; url: string; path: string }> {
  return apiPostJson('/document/rename', {
    instance_id: instanceId,
    chatbot_id: chatbotId,
    old_name: oldName,
    new_name: newName,
    kind,
  })
}

export async function copyDocument(
  instanceId: string,
  chatbotId: string,
  filename: string,
  newName?: string,
  kind: DocumentKind = 'media',
): Promise<{ ok: boolean; source_name: string; new_name: string; size: number; url: string; path: string }> {
  return apiPostJson('/document/copy', {
    instance_id: instanceId,
    chatbot_id: chatbotId,
    name: filename,
    new_name: newName,
    kind,
  })
}

export async function moveDocument(
  instanceId: string,
  sourceChatbotId: string,
  filename: string,
  targetChatbotId: string,
  sourceKind: DocumentKind = 'media',
  targetKind: DocumentKind = 'media',
): Promise<{
  ok: boolean
  filename: string
  from: { chatbot_id: string; kind: DocumentKind }
  to: { chatbot_id: string; kind: DocumentKind }
  url: string
  path: string
}> {
  return apiPostJson('/document/move', {
    instance_id: instanceId,
    source_chatbot_id: sourceChatbotId,
    target_chatbot_id: targetChatbotId,
    name: filename,
    source_kind: sourceKind,
    target_kind: targetKind,
  })
}

export async function deleteDocument(
  instanceId: string,
  chatbotId: string,
  filename: string,
  kind: DocumentKind = 'media',
): Promise<{ ok: boolean; deleted: boolean; filename: string }> {
  if (kind === 'media') {
    await deleteDesignerMedia({ instanceId, chatbotId, filename })
    return { ok: true, deleted: true, filename }
  }
  return apiPostJson('/file/delete', {
    instance_id: instanceId,
    chatbot_id: chatbotId,
    name: filename,
    kind,
  })
}

export async function listDocuments(
  instanceId: string,
  chatbotId: string,
  kind: DocumentKind = 'media',
): Promise<DocumentFile[]> {
  if (kind === 'media') {
    return listDesignerMedia({ instanceId, chatbotId })
  }
  const params = new URLSearchParams({
    instance_id: instanceId,
    chatbot_id: chatbotId,
    kind,
  })
  const data = await apiGetJson<{ files?: DocumentFile[] }>(`/file/list?${params}`)
  return (data.files ?? []).map((file) => ({
    ...file,
    url: absoluteInstanceFileUrl(file.url),
  }))
}

export async function uploadDocument(
  file: File,
  instanceId: string,
  chatbotId: string,
  kind: DocumentKind = 'media',
  sessionId?: string,
  nodeKey?: string,
): Promise<{
  ok: boolean
  kind: DocumentKind
  instance_id: string
  chatbot_id: string
  original_name: string
  filename: string
  key: string
  size: number
  path: string
  url: string
}> {
  if (kind === 'media' && !sessionId) {
    const result = await uploadDesignerMedia({ instanceId, chatbotId, file })
    return { ...result, key: result.key ?? result.filename }
  }
  if (kind === 'conversation' && sessionId && nodeKey) {
    const result = await uploadConversationFile({ instanceId, chatbotId, sessionId, nodeKey, file })
    return { ...result, key: result.key ?? result.filename }
  }
  requireApiBase()
  const formData = new FormData()
  formData.append('file', file)
  formData.append('kind', kind)
  formData.append('instance_id', instanceId)
  formData.append('chatbot_id', chatbotId)
  if (sessionId) formData.append('session_id', sessionId)
  if (nodeKey) formData.append('node_key', nodeKey)

  const res = await fetch(`${API_BASE}/file/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await authToken()}` },
    credentials: 'omit',
    body: formData,
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
  return json as {
    ok: boolean
    kind: DocumentKind
    instance_id: string
    chatbot_id: string
    original_name: string
    filename: string
    key: string
    size: number
    path: string
    url: string
  }
}

/** Inline display URL (/file/get). */
export function getDocumentUrl(
  instanceId: string,
  chatbotId: string,
  filename: string,
  kind: DocumentKind = 'media',
  sessionId?: string,
): string {
  if (!isFlowForgeApiConfigured()) {
    const params = documentQuery(instanceId, chatbotId, filename, kind)
    return `/api/file/get?${params}`
  }
  return absoluteInstanceFileUrl(
    instanceFileUrl({ kind, instanceId, chatbotId, filename, sessionId }),
  )
}

/** Authenticated download URL (/document/download). Prefer downloadDocument() for browser saves. */
export function getDownloadUrl(
  instanceId: string,
  chatbotId: string,
  filename: string,
  kind: DocumentKind = 'media',
): string {
  const params = documentQuery(instanceId, chatbotId, filename, kind)
  if (!API_BASE) {
    return `/api/document/download?${params}`
  }
  return `${API_BASE}/document/download?${params}`
}

/**
 * Scoped document handlers for a chatbot folder.
 *
 * @example
 * const docs = createDocumentHandlers({ instanceId, chatbotId })
 * await docs.view('agreement.pdf')
 * await docs.download('agreement.pdf')
 * docs.open('agreement.pdf')
 */
export function createDocumentHandlers(scope: DocumentScope) {
  const kind = scope.kind ?? 'media'
  const { instanceId, chatbotId } = scope
  return {
    view: (filename: string) => viewDocument(instanceId, chatbotId, filename, kind),
    download: (filename: string) => downloadDocument(instanceId, chatbotId, filename, kind),
    open: (filename: string) => openDocument(instanceId, chatbotId, filename, kind),
    rename: (oldName: string, newName: string) => renameDocument(instanceId, chatbotId, oldName, newName, kind),
    copy: (filename: string, newName?: string) => copyDocument(instanceId, chatbotId, filename, newName, kind),
    move: (filename: string, targetChatbotId: string, targetKind: DocumentKind = kind) =>
      moveDocument(instanceId, chatbotId, filename, targetChatbotId, kind, targetKind),
    delete: (filename: string) => deleteDocument(instanceId, chatbotId, filename, kind),
    list: () => listDocuments(instanceId, chatbotId, kind),
    upload: (file: File, sessionId?: string, nodeKey?: string) =>
      uploadDocument(file, instanceId, chatbotId, kind, sessionId, nodeKey),
    url: (filename: string, sessionId?: string) => getDocumentUrl(instanceId, chatbotId, filename, kind, sessionId),
    downloadUrl: (filename: string) => getDownloadUrl(instanceId, chatbotId, filename, kind),
  }
}

export type DocumentHandlers = ReturnType<typeof createDocumentHandlers>
