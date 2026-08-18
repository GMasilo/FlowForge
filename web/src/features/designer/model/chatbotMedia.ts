export const DESIGNER_MEDIA_ACCEPT =
  '.jpg,.jpeg,.png,.gif,.webp,.mp3,.wav,.ogg,.mp4,.webm,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.zip'

export type ChatbotMediaFile = {
  filename: string
  key: string
  url: string
  mime: string
  size?: number
  path?: string
  modified_at?: string
}

/** welcome.png → welcome_png (safe inside {{media.…}}) */
export function mediaKeyFromFilename(filename: string): string {
  const lower = filename.toLowerCase()
  const dot = lower.lastIndexOf('.')
  const stemRaw = dot === -1 ? lower : lower.slice(0, dot)
  const extRaw = dot === -1 ? '' : lower.slice(dot + 1)
  const stem = stemRaw.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'file'
  const ext = extRaw.replace(/[^a-z0-9]+/g, '')
  return ext ? `${stem}_${ext}` : stem
}

export function filenameGuessFromMediaKey(key: string): string | null {
  const i = key.lastIndexOf('_')
  if (i <= 0 || i === key.length - 1) return null
  return `${key.slice(0, i)}.${key.slice(i + 1)}`
}

export function mediaKindOf(file: Pick<ChatbotMediaFile, 'mime' | 'filename'>): 'image' | 'video' | 'audio' | 'file' {
  const mime = file.mime || ''
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  const ext = file.filename.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image'
  if (['mp4', 'webm'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'ogg'].includes(ext)) return 'audio'
  return 'file'
}

export function readMediaFiles(config: Record<string, unknown> | undefined | null): string[] {
  const raw = config?.mediaFiles
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const name = String(item ?? '').trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    out.push(name)
  }
  return out
}

export function mediaInsert(key: string): string {
  return `{{renderFile(media.${key})}}`
}

export function mediaUrlInsert(key: string): string {
  return `{{media.${key}.url}}`
}

const FF_FILE_MARK = '__ffFile'
const FF_FILE_OPEN = '<<ff:file:'
const FF_FILE_CLOSE = '>>'

export function mediaFileExprValue(file: ChatbotMediaFile): Record<string, unknown> {
  const kind = mediaKindOf(file)
  return {
    url: file.url,
    filename: file.filename,
    name: file.filename,
    mime: file.mime,
    type: kind,
    kind,
    size: file.size ?? 0,
    key: file.key,
  }
}

export function mediaExprMap(files: ChatbotMediaFile[]): Record<string, unknown> {
  const map: Record<string, unknown> = {}
  for (const file of files) {
    if (!file.key) continue
    map[file.key] = mediaFileExprValue(file)
  }
  return map
}

export function isRenderFileValue(value: unknown): boolean {
  return !!value && typeof value === 'object' && (value as { [FF_FILE_MARK]?: unknown })[FF_FILE_MARK] === true
}

export function renderFileValue(value: unknown): Record<string, unknown> {
  const file = fileValueFromUnknown(value)
  if (!file?.url) throw new Error('renderFile: expected a media file or URL')
  return { [FF_FILE_MARK]: true, ...mediaFileExprValue(file) }
}

export function fileValueFromUnknown(value: unknown): ChatbotMediaFile | null {
  if (typeof value === 'string') {
    const url = value.trim()
    if (!url) return null
    if (/^https?:\/\//i.test(url) || url.includes('/file/get?')) return fileFromUrl(url)
    return null
  }
  if (!value || typeof value !== 'object') return null
  const rec = value as Record<string, unknown>
  const url = typeof rec.url === 'string' ? rec.url.trim() : ''
  if (!url) return null
  const looksLikeFile =
    isRenderFileValue(value) ||
    typeof rec.filename === 'string' ||
    typeof rec.name === 'string' ||
    typeof rec.mime === 'string' ||
    typeof rec.key === 'string'
  if (!looksLikeFile) return null
  const filename =
    (typeof rec.filename === 'string' && rec.filename) ||
    (typeof rec.name === 'string' && rec.name) ||
    fileFromUrl(url).filename
  const mime = typeof rec.mime === 'string' && rec.mime ? rec.mime : mimeFromFilename(filename)
  const key = typeof rec.key === 'string' && rec.key ? rec.key : mediaKeyFromFilename(filename)
  const size = typeof rec.size === 'number' && Number.isFinite(rec.size) ? rec.size : undefined
  return { filename, key, url, mime, size }
}

function fileFromUrl(url: string): ChatbotMediaFile {
  let filename = 'file'
  try {
    const parsed = new URL(url, 'https://flowforge.invalid')
    const named = parsed.searchParams.get('name')
    if (named) filename = named
    else {
      const last = parsed.pathname.split('/').pop()
      if (last) filename = decodeURIComponent(last)
    }
  } catch {
    const last = url.split(/[/?#]/).filter(Boolean).pop()
    if (last) filename = last
  }
  if (!filename.includes('.')) filename = `${filename}.bin`
  return {
    filename,
    key: mediaKeyFromFilename(filename),
    url,
    mime: mimeFromFilename(filename),
  }
}

function utf8ToB64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const byte of bytes) bin += String.fromCharCode(byte)
  return btoa(bin)
}

function b64ToUtf8(b64: string): string {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export function encodeFileEmbed(file: ChatbotMediaFile): string {
  return `${FF_FILE_OPEN}${utf8ToB64(
    JSON.stringify({
      filename: file.filename,
      key: file.key,
      url: file.url,
      mime: file.mime,
      size: file.size ?? 0,
    }),
  )}${FF_FILE_CLOSE}`
}

export function formatMediaForText(value: unknown, embedMedia: boolean): string | null {
  if (typeof value === 'string' || value == null) return null
  const file = fileValueFromUnknown(value)
  if (!file) return null
  if (embedMedia) return encodeFileEmbed(file)
  return file.url
}

export type ChatContentSegment =
  | { kind: 'text'; text: string }
  | { kind: 'file'; file: ChatbotMediaFile }

const CHAT_EMBED_RE =
  /<<ff:file:([A-Za-z0-9+/=]+)>>|(https?:\/\/[^\s<>"]+\/file\/get\?[^\s<>"]+)|(https?:\/\/[^\s<>"]+\.(?:jpg|jpeg|png|gif|webp|mp4|webm|mp3|wav|ogg)(?:\?[^\s<>"]*)?)/gi

export function parseChatSegments(text: string): ChatContentSegment[] {
  if (!text) return []
  const segments: ChatContentSegment[] = []
  const re = new RegExp(CHAT_EMBED_RE.source, 'gi')
  let last = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ kind: 'text', text: text.slice(last, match.index) })
    }
    const b64 = match[1]
    const fileGetUrl = match[2]
    const mediaUrl = match[3]
    if (b64) {
      try {
        const parsed = JSON.parse(b64ToUtf8(b64)) as unknown
        const file = fileValueFromUnknown(parsed)
        if (file) segments.push({ kind: 'file', file })
        else segments.push({ kind: 'text', text: match[0] })
      } catch {
        segments.push({ kind: 'text', text: match[0] })
      }
    } else {
      const url = fileGetUrl || mediaUrl || ''
      segments.push({ kind: 'file', file: fileFromUrl(url) })
    }
    last = match.index + match[0].length
  }
  if (last < text.length) segments.push({ kind: 'text', text: text.slice(last) })
  return segments.filter((seg) => seg.kind === 'file' || seg.text.length > 0)
}

export function stripFileEmbeds(text: string): string {
  return parseChatSegments(text)
    .map((seg) => (seg.kind === 'text' ? seg.text : seg.file.url))
    .join('')
}

export function mimeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    mp4: 'video/mp4',
    webm: 'video/webm',
    pdf: 'application/pdf',
    txt: 'text/plain',
    csv: 'text/csv',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    zip: 'application/zip',
  }
  return map[ext] ?? 'application/octet-stream'
}

export function collectMediaFilenamesFromNodes(nodes: Array<{ config: Record<string, unknown> }>): string[] {
  const names = new Set<string>()
  const mediaRef = /\bmedia\.([A-Za-z_][A-Za-z0-9_]*)/g
  for (const node of nodes) {
    for (const name of readMediaFiles(node.config)) names.add(name)
    const imageChoices = node.config.imageChoices
    if (Array.isArray(imageChoices)) {
      for (const item of imageChoices) {
        if (!item || typeof item !== 'object') continue
        const filename = String((item as { filename?: unknown }).filename ?? '').trim()
        if (filename) names.add(filename)
      }
    }
    for (const value of Object.values(node.config)) {
      if (typeof value !== 'string') continue
      mediaRef.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = mediaRef.exec(value)) !== null) {
        const guessed = filenameGuessFromMediaKey(match[1]!)
        if (guessed) names.add(guessed)
      }
    }
  }
  return [...names]
}

export function catalogFromFilenames(
  filenames: string[],
  resolveUrl: (filename: string) => string,
): ChatbotMediaFile[] {
  return filenames.map((filename) => ({
    filename,
    key: mediaKeyFromFilename(filename),
    url: resolveUrl(filename),
    mime: mimeFromFilename(filename),
  }))
}

export function resolveMediaAttachments(
  config: Record<string, unknown> | undefined | null,
  catalog: ChatbotMediaFile[],
): ChatbotMediaFile[] {
  const byName = new Map(catalog.map((f) => [f.filename, f]))
  return readMediaFiles(config)
    .map((name) => byName.get(name))
    .filter((f): f is ChatbotMediaFile => !!f)
}
