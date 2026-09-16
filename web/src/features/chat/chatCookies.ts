/**
 * Browser cookie helpers for FlowForge chat (remember user data across visits).
 * Keys are scoped per chatbot so values never leak between bots on the same origin.
 * Uses document.cookie with a localStorage mirror so values still work when
 * third-party cookie restrictions apply in some embed contexts.
 */

const COOKIE_PREFIX = 'ff.c.'
const STORAGE_PREFIX = 'flowforge.cookie.'
const DEFAULT_DAYS = 365

function safeSegment(value: string, max = 64): string {
  return String(value ?? '')
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .slice(0, max)
}

/** Compact chatbot scope used in cookie / storage keys. */
export function chatCookieScope(chatbotId: string | null | undefined): string | null {
  const raw = String(chatbotId ?? '').trim()
  if (!raw) return null
  // Prefer a stable short form of UUID / id (no dashes).
  const compact = raw.replace(/-/g, '')
  return safeSegment(compact, 24) || null
}

function safeName(name: string): string {
  return safeSegment(name, 48)
}

function cookieKey(chatbotId: string, name: string): string {
  const scope = chatCookieScope(chatbotId)
  if (!scope) throw new Error('cookie: chatbot scope is required')
  return `${COOKIE_PREFIX}${scope}.${safeName(name)}`
}

function storageKey(chatbotId: string, name: string): string {
  const scope = chatCookieScope(chatbotId)
  if (!scope) throw new Error('cookie: chatbot scope is required')
  return `${STORAGE_PREFIX}${scope}.${safeName(name)}`
}

function canUseDom(): boolean {
  return typeof document !== 'undefined' && typeof window !== 'undefined'
}

function requireChatbotId(chatbotId: string | null | undefined): string {
  const id = String(chatbotId ?? '').trim()
  if (!id) throw new Error('cookie: chatbot id is required')
  return id
}

/** Read a FlowForge chat cookie for this chatbot (null when missing). */
export function readChatCookie(
  name: string,
  chatbotId: string | null | undefined,
): string | null {
  const key = safeName(name)
  if (!key || !canUseDom()) return null
  let botId: string
  try {
    botId = requireChatbotId(chatbotId)
  } catch {
    return null
  }

  try {
    const want = cookieKey(botId, key)
    const parts = document.cookie ? document.cookie.split(';') : []
    for (const part of parts) {
      const [rawK, ...rest] = part.split('=')
      const k = rawK?.trim()
      if (k !== want) continue
      return decodeURIComponent(rest.join('=').trim())
    }
  } catch {
    // ignore
  }

  try {
    const raw = window.localStorage.getItem(storageKey(botId, key))
    return raw == null ? null : raw
  } catch {
    return null
  }
}

/** Write a FlowForge chat cookie scoped to this chatbot. days defaults to 365; 0 = session. */
export function writeChatCookie(
  name: string,
  value: string,
  days: number = DEFAULT_DAYS,
  chatbotId?: string | null,
): string {
  const botId = requireChatbotId(chatbotId)
  const key = safeName(name)
  if (!key) throw new Error('setCookie: name is required')
  const str = value == null ? '' : String(value)
  if (!canUseDom()) return str

  try {
    const maxAge =
      !Number.isFinite(days) || days < 0
        ? DEFAULT_DAYS * 24 * 60 * 60
        : days === 0
          ? undefined
          : Math.floor(days * 24 * 60 * 60)
    const encoded = encodeURIComponent(str)
    let cookie = `${cookieKey(botId, key)}=${encoded}; path=/; SameSite=Lax`
    if (maxAge != null) cookie += `; max-age=${maxAge}`
    if (typeof location !== 'undefined' && location.protocol === 'https:') {
      cookie += '; Secure'
    }
    document.cookie = cookie
  } catch {
    // ignore cookie write failures
  }

  try {
    window.localStorage.setItem(storageKey(botId, key), str)
  } catch {
    // ignore
  }
  return str
}

/** Remove a FlowForge chat cookie for this chatbot. */
export function clearChatCookie(name: string, chatbotId?: string | null): null {
  const key = safeName(name)
  if (!key || !canUseDom()) return null
  let botId: string
  try {
    botId = requireChatbotId(chatbotId)
  } catch {
    return null
  }

  try {
    document.cookie = `${cookieKey(botId, key)}=; path=/; max-age=0; SameSite=Lax`
  } catch {
    // ignore
  }
  try {
    window.localStorage.removeItem(storageKey(botId, key))
  } catch {
    // ignore
  }
  return null
}

/** Remove every FlowForge chat cookie for this chatbot (cookie + localStorage mirror). */
export function clearAllChatCookies(chatbotId: string | null | undefined): void {
  if (!canUseDom()) return
  let botId: string
  try {
    botId = requireChatbotId(chatbotId)
  } catch {
    return
  }
  const scope = chatCookieScope(botId)
  if (!scope) return
  const cookiePrefix = `${COOKIE_PREFIX}${scope}.`
  const storagePrefix = `${STORAGE_PREFIX}${scope}.`

  try {
    const parts = document.cookie ? document.cookie.split(';') : []
    for (const part of parts) {
      const rawK = part.split('=')[0]?.trim() ?? ''
      if (!rawK.startsWith(cookiePrefix)) continue
      document.cookie = `${rawK}=; path=/; max-age=0; SameSite=Lax`
    }
  } catch {
    // ignore
  }

  try {
    const toRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (key && key.startsWith(storagePrefix)) toRemove.push(key)
    }
    for (const key of toRemove) window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
}
