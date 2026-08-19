/**
 * Document Handler Functions
 * Utilities for managing document files (PDFs, images, Office docs, etc.)
 */

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

/**
 * View document metadata and preview
 */
export async function viewDocument(
  instanceId: string,
  chatbotId: string,
  filename: string,
  kind: DocumentKind = 'media',
): Promise<DocumentInfo> {
  const params = new URLSearchParams({
    instance_id: instanceId,
    chatbot_id: chatbotId,
    name: filename,
    kind,
  })

  const response = await fetch(`/api/document/view?${params}`, {
    method: 'GET',
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to view document' }))
    throw new Error(error.error || 'Failed to view document')
  }

  return response.json()
}

/**
 * Download document (forces browser download dialog)
 */
export async function downloadDocument(
  instanceId: string,
  chatbotId: string,
  filename: string,
  kind: DocumentKind = 'media',
): Promise<void> {
  const params = new URLSearchParams({
    instance_id: instanceId,
    chatbot_id: chatbotId,
    name: filename,
    kind,
  })

  const link = document.createElement('a')
  link.href = `/api/document/download?${params}`
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Rename a document
 */
export async function renameDocument(
  instanceId: string,
  chatbotId: string,
  oldName: string,
  newName: string,
  kind: DocumentKind = 'media',
): Promise<{ ok: boolean; old_name: string; new_name: string; url: string; path: string }> {
  const response = await fetch('/api/document/rename', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      instance_id: instanceId,
      chatbot_id: chatbotId,
      old_name: oldName,
      new_name: newName,
      kind,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to rename document' }))
    throw new Error(error.error || 'Failed to rename document')
  }

  return response.json()
}

/**
 * Copy a document
 */
export async function copyDocument(
  instanceId: string,
  chatbotId: string,
  filename: string,
  newName?: string,
  kind: DocumentKind = 'media',
): Promise<{ ok: boolean; source_name: string; new_name: string; size: number; url: string; path: string }> {
  const response = await fetch('/api/document/copy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      instance_id: instanceId,
      chatbot_id: chatbotId,
      name: filename,
      new_name: newName,
      kind,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to copy document' }))
    throw new Error(error.error || 'Failed to copy document')
  }

  return response.json()
}

/**
 * Move a document between kinds or chatbots
 */
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
  const response = await fetch('/api/document/move', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      instance_id: instanceId,
      source_chatbot_id: sourceChatbotId,
      target_chatbot_id: targetChatbotId,
      name: filename,
      source_kind: sourceKind,
      target_kind: targetKind,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to move document' }))
    throw new Error(error.error || 'Failed to move document')
  }

  return response.json()
}

/**
 * Delete a document
 */
export async function deleteDocument(
  instanceId: string,
  chatbotId: string,
  filename: string,
  kind: DocumentKind = 'media',
): Promise<{ ok: boolean; deleted: boolean; filename: string }> {
  const response = await fetch('/api/file/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      instance_id: instanceId,
      chatbot_id: chatbotId,
      name: filename,
      kind,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to delete document' }))
    throw new Error(error.error || 'Failed to delete document')
  }

  return response.json()
}

/**
 * List all documents
 */
export async function listDocuments(
  instanceId: string,
  chatbotId: string,
  kind: DocumentKind = 'media',
): Promise<DocumentFile[]> {
  const params = new URLSearchParams({
    instance_id: instanceId,
    chatbot_id: chatbotId,
    kind,
  })

  const response = await fetch(`/api/file/list?${params}`, {
    method: 'GET',
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to list documents' }))
    throw new Error(error.error || 'Failed to list documents')
  }

  const data = await response.json()
  return data.files || []
}

/**
 * Upload a document
 */
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
  const formData = new FormData()
  formData.append('file', file)
  formData.append('kind', kind)
  formData.append('instance_id', instanceId)
  formData.append('chatbot_id', chatbotId)
  if (sessionId) formData.append('session_id', sessionId)
  if (nodeKey) formData.append('node_key', nodeKey)

  const response = await fetch('/api/file/upload', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to upload document' }))
    throw new Error(error.error || 'Failed to upload document')
  }

  return response.json()
}

/**
 * Get document URL for inline display
 */
export function getDocumentUrl(
  instanceId: string,
  chatbotId: string,
  filename: string,
  kind: DocumentKind = 'media',
): string {
  const params = new URLSearchParams({
    instance_id: instanceId,
    chatbot_id: chatbotId,
    name: filename,
    kind,
  })
  return `/api/file/get?${params}`
}

/**
 * Get download URL
 */
export function getDownloadUrl(
  instanceId: string,
  chatbotId: string,
  filename: string,
  kind: DocumentKind = 'media',
): string {
  const params = new URLSearchParams({
    instance_id: instanceId,
    chatbot_id: chatbotId,
    name: filename,
    kind,
  })
  return `/api/document/download?${params}`
}
