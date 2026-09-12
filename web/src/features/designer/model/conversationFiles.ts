import {
  mediaKeyFromFilename,
  mimeFromFilename,
  type ChatbotMediaFile,
} from '@/features/designer/model/chatbotMedia'
import type { FileAcceptKind } from '@/features/designer/model/flowSchema'
import {
  instanceFileUrl,
  isFlowForgeApiConfigured,
  uploadConversationFile,
} from '@/shared/lib/flowforgeApi'

const EXTS_BY_ACCEPT: Record<FileAcceptKind, readonly string[]> = {
  any: [
    'jpg',
    'jpeg',
    'png',
    'gif',
    'webp',
    'mp3',
    'wav',
    'ogg',
    'mp4',
    'webm',
    'pdf',
    'txt',
    'csv',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'zip',
  ],
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  document: ['pdf', 'txt', 'csv', 'doc', 'docx', 'xls', 'xlsx'],
  pdf: ['pdf'],
}

export type ConversationFileValue = {
  filename: string
  originalName: string
  url: string
  mime: string
  size: number
  key: string
  path?: string
  /** Inline image payload so PDF/DOCX can embed without a second network fetch. */
  dataUrl?: string
}

export function htmlAcceptFor(kind: FileAcceptKind | string | undefined): string {
  const exts = EXTS_BY_ACCEPT[normalizeFileAccept(kind)]
  return exts.map((ext) => `.${ext}`).join(',')
}

export function normalizeFileAccept(raw: unknown): FileAcceptKind {
  const v = String(raw ?? 'any')
  if (v === 'image' || v === 'document' || v === 'pdf' || v === 'any') return v
  return 'any'
}

export function normalizeMaxFiles(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return 1
  return Math.min(5, Math.max(1, Math.round(n)))
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  if (dot < 0 || dot === name.length - 1) return ''
  return name.slice(dot + 1).toLowerCase()
}

export function isAllowedConversationFile(file: Pick<File, 'name'>, accept: FileAcceptKind): boolean {
  const ext = extensionOf(file.name)
  return !!ext && EXTS_BY_ACCEPT[accept].includes(ext)
}

export async function fileToDataUrl(file: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

export function parseConversationFileValue(raw: unknown): ConversationFileValue | null {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  const dataUrl =
    typeof rec.dataUrl === 'string' && rec.dataUrl.trim().startsWith('data:image/')
      ? rec.dataUrl.trim()
      : typeof rec.data_url === 'string' && rec.data_url.trim().startsWith('data:image/')
        ? rec.data_url.trim()
        : undefined
  const url = typeof rec.url === 'string' ? rec.url.trim() : ''
  const filename =
    (typeof rec.filename === 'string' && rec.filename.trim()) ||
    (typeof rec.originalName === 'string' && rec.originalName.trim()) ||
    (typeof rec.name === 'string' && rec.name.trim()) ||
    ''
  if ((!url && !dataUrl) || !filename) return null
  const originalName =
    (typeof rec.originalName === 'string' && rec.originalName.trim()) || filename
  const mime = typeof rec.mime === 'string' && rec.mime ? rec.mime : mimeFromFilename(filename)
  const size = typeof rec.size === 'number' && Number.isFinite(rec.size) ? rec.size : 0
  const key = typeof rec.key === 'string' && rec.key ? rec.key : mediaKeyFromFilename(filename)
  const path = typeof rec.path === 'string' ? rec.path : undefined
  return { filename, originalName, url: url || dataUrl || '', mime, size, key, path, dataUrl }
}

export function parseConversationFileList(raw: unknown): ConversationFileValue[] {
  if (Array.isArray(raw)) {
    return raw.map(parseConversationFileValue).filter((f): f is ConversationFileValue => !!f)
  }
  const one = parseConversationFileValue(raw)
  return one ? [one] : []
}

export function conversationFilesToMedia(value: unknown): ChatbotMediaFile[] {
  return parseConversationFileList(value).map((f) => ({
    filename: f.originalName || f.filename,
    key: f.key,
    url: f.url,
    mime: f.mime,
    size: f.size,
  }))
}

export type AnswerFileStoreCtx = {
  instanceId?: string
  chatbotId?: string
  sessionId?: string
  nodeKey: string
}

export async function storeAnswerFiles(
  files: File[],
  ctx: AnswerFileStoreCtx,
): Promise<ConversationFileValue[]> {
  const out: ConversationFileValue[] = []
  const canUpload =
    isFlowForgeApiConfigured() &&
    !!ctx.instanceId &&
    !!ctx.chatbotId &&
    !!ctx.sessionId &&
    !!ctx.nodeKey

  for (let i = 0; i < files.length; i++) {
    const file = files[i]!
    const dataUrl =
      file.type.startsWith('image/') && file.size <= 1_500_000 ? await fileToDataUrl(file).catch(() => undefined) : undefined
    if (canUpload) {
      const result = await uploadConversationFile({
        instanceId: ctx.instanceId!,
        chatbotId: ctx.chatbotId!,
        sessionId: ctx.sessionId!,
        nodeKey: ctx.nodeKey,
        file,
        fileIndex: files.length > 1 ? i + 1 : undefined,
      })
      out.push({
        filename: result.filename,
        originalName: result.original_name || file.name,
        url: instanceFileUrl({
          kind: 'conversation',
          instanceId: ctx.instanceId!,
          chatbotId: ctx.chatbotId!,
          filename: result.filename,
          sessionId: ctx.sessionId,
        }),
        mime: file.type || mimeFromFilename(result.filename),
        size: result.size || file.size,
        key: result.key || mediaKeyFromFilename(result.filename),
        path: result.path,
        dataUrl,
      })
      continue
    }

    out.push({
      filename: file.name,
      originalName: file.name,
      url: URL.createObjectURL(file),
      mime: file.type || mimeFromFilename(file.name),
      size: file.size,
      key: mediaKeyFromFilename(file.name),
      dataUrl,
    })
  }

  return out
}

export function displayNameForFiles(files: ConversationFileValue[]): string {
  return files.map((f) => f.originalName || f.filename).join(', ')
}

export function fileAnswerForSubmit(
  files: ConversationFileValue[],
): Record<string, unknown> | Record<string, unknown>[] {
  if (files.length === 1) return files[0]!
  return files
}
