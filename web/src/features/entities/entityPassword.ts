/**
 * Password hashing for entity `password` attributes.
 * Format: $ffp1$<iterations>$<salt_b64url>$<hash_b64url> (PBKDF2-HMAC-SHA-256).
 * Legacy plaintext values still verify until re-saved.
 */

const HASH_PREFIX = '$ffp1$'
const DEFAULT_ITERATIONS = 310_000
const SALT_BYTES = 16
const KEY_BITS = 256

function bytesToB64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function b64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const bin = atob(padded + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!
  return diff === 0
}

export function isPasswordHash(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const parts = value.split('$')
  // ['', 'ffp1', iterations, salt, hash]
  return parts.length === 5 && parts[1] === 'ffp1' && !!parts[2] && !!parts[3] && !!parts[4]
}

export function looksLikePasswordPlaceholder(value: string): boolean {
  return value === '' || value === '••••••••' || value === '********'
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: salt as BufferSource,
      iterations,
    },
    baseKey,
    KEY_BITS,
  )
  return new Uint8Array(bits)
}

export async function hashPassword(plaintext: string, iterations = DEFAULT_ITERATIONS): Promise<string> {
  const trimmed = plaintext
  if (!trimmed) throw new Error('Password cannot be empty')
  if (isPasswordHash(trimmed)) return trimmed
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await deriveKey(trimmed, salt, iterations)
  return `${HASH_PREFIX}${iterations}$${bytesToB64Url(salt)}$${bytesToB64Url(hash)}`
}

export async function verifyPassword(plaintext: string, stored: unknown): Promise<boolean> {
  if (stored == null) return false
  const storedStr = String(stored)
  if (!storedStr) return false

  if (isPasswordHash(storedStr)) {
    const parts = storedStr.split('$')
    const iterations = Number(parts[2])
    if (!Number.isFinite(iterations) || iterations < 10_000) return false
    try {
      const salt = b64UrlToBytes(parts[3]!)
      const expected = b64UrlToBytes(parts[4]!)
      const actual = await deriveKey(plaintext, salt, iterations)
      return timingSafeEqual(actual, expected)
    } catch {
      return false
    }
  }

  // Legacy plaintext entity passwords (pre-hash migration).
  return storedStr === plaintext
}

/** Hash password-typed attributes; keep previous hash when the new value is blank. */
export async function applyPasswordHashesToValues(
  values: Record<string, unknown>,
  attrs: Array<{ key: string; value_type: string }>,
  previous?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const next = { ...values }
  for (const attr of attrs) {
    if (attr.value_type !== 'password') continue
    const raw = next[attr.key]
    if (raw === undefined || raw === null) {
      if (previous && previous[attr.key] != null) next[attr.key] = previous[attr.key]
      continue
    }
    const asString = typeof raw === 'string' ? raw : String(raw)
    if (looksLikePasswordPlaceholder(asString) || asString.trim() === '') {
      if (previous && previous[attr.key] != null) next[attr.key] = previous[attr.key]
      else delete next[attr.key]
      continue
    }
    if (isPasswordHash(asString)) {
      next[attr.key] = asString
      continue
    }
    next[attr.key] = await hashPassword(asString)
  }
  return next
}
