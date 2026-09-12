import { deflateSync } from 'fflate'
import type { DesignerEdge, DesignerNode } from '@/features/designer/model/flowSchema'
import { nodeTypeLabel } from '@/features/designer/model/flowSchema'
import {
  applyOtpEmailTemplate,
  interpolate,
  type PreviewEngineState,
  type PreviewOtpChallenge,
  type PreviewSignInAttempts,
} from '@/features/designer/preview/previewRuntime'
import {
  parseSsoContent,
  type SsoContent,
  type SsoProtocol,
} from '@/features/templates/templateModel'
import type { Json } from '@/shared/types/database'

export type SignInMode = 'password' | 'otp' | 'http' | 'sso' | 'entity' | 'sign_out'

export type SignInSsoProtocol = SsoProtocol

export type SignInConfig = {
  mode: SignInMode
  prompt: string
  connectionId: string
  emailTemplateId: string
  successStatusMin: number
  successStatusMax: number
  userIdPath: string
  tokenPath: string
  profilePath: string
  userIdVariable: string
  tokenVariable: string
  profileVariable: string
  emailVariable: string
  /** JSON body field name for the email (default: email). Ignored when requestBody is set. */
  requestEmailKey: string
  /** JSON body field name for the password (default: password). Ignored when requestBody is set. */
  requestPasswordKey: string
  /**
   * Optional JSON body template. Use {{email}} and {{password}}.
   * Example: {"username":"{{email}}","pass":"{{password}}"}
   */
  requestBody: string
  otpLength: number
  otpMaxAttempts: number
  otpSubject: string
  otpBody: string
  /** Max incorrect password/HTTP/entity attempts before Fail (default 5). */
  maxAttempts: number
  /** Entity mode: chatbot entity to look up credentials against. */
  entityId: string
  /** Entity attribute key matched to the visitor email. */
  entityEmailAttribute: string
  /** Entity attribute key matched to the visitor password. */
  entityPasswordAttribute: string
  /** Entity attribute used as user id (default: id). */
  entityUserIdAttribute: string
  /** SSO mode: chatbot template key (kind = sso) configured under Templates. */
  ssoTemplateKey: string
  /**
   * When true (default), skip the Sign-in UI if {{vars._signed_in}} is already set
   * and continue on the Success edge.
   */
  skipIfSignedIn: boolean
}

export function parseSignInConfig(config: Record<string, unknown> | undefined | null): SignInConfig {
  const raw = config ?? {}
  const modeRaw = String(raw.mode ?? 'http')
  const mode: SignInMode =
    modeRaw === 'password' ||
    modeRaw === 'otp' ||
    modeRaw === 'http' ||
    modeRaw === 'sso' ||
    modeRaw === 'entity' ||
    modeRaw === 'sign_out'
      ? modeRaw
      : 'http'
  const otpLength = Number(raw.otpLength ?? 6)
  const otpMaxAttempts = Number(raw.otpMaxAttempts ?? 5)
  const maxAttempts = Number(raw.maxAttempts ?? raw.otpMaxAttempts ?? 5)
  return {
    mode,
    prompt: String(raw.prompt ?? 'Sign in to continue'),
    connectionId: String(raw.connectionId ?? '').trim(),
    emailTemplateId: String(raw.emailTemplateId ?? '').trim(),
    successStatusMin: Number(raw.successStatusMin ?? 200) || 200,
    successStatusMax: Number(raw.successStatusMax ?? 299) || 299,
    userIdPath: String(raw.userIdPath ?? 'user.id').trim(),
    tokenPath: String(raw.tokenPath ?? 'token').trim(),
    profilePath: String(raw.profilePath ?? 'user').trim(),
    userIdVariable: String(raw.userIdVariable ?? 'user_id').trim() || 'user_id',
    tokenVariable: String(raw.tokenVariable ?? 'auth_token').trim() || 'auth_token',
    profileVariable: String(raw.profileVariable ?? 'user').trim() || 'user',
    emailVariable: String(raw.emailVariable ?? 'email').trim() || 'email',
    requestEmailKey: String(raw.requestEmailKey ?? 'email').trim() || 'email',
    requestPasswordKey: String(raw.requestPasswordKey ?? 'password').trim() || 'password',
    requestBody: String(raw.requestBody ?? '').trim(),
    otpLength: Number.isFinite(otpLength) ? Math.max(4, Math.min(12, Math.round(otpLength))) : 6,
    otpMaxAttempts: Number.isFinite(otpMaxAttempts)
      ? Math.max(1, Math.min(20, Math.round(otpMaxAttempts)))
      : 5,
    otpSubject: String(raw.otpSubject ?? 'Your sign-in code').trim() || 'Your sign-in code',
    otpBody:
      String(raw.otpBody ?? 'Your verification code is {{otp.code}}.').trim() ||
      'Your verification code is {{otp.code}}.',
    maxAttempts: Number.isFinite(maxAttempts)
      ? Math.max(1, Math.min(20, Math.round(maxAttempts)))
      : 5,
    entityId: String(raw.entityId ?? '').trim(),
    entityEmailAttribute: String(raw.entityEmailAttribute ?? 'email').trim() || 'email',
    entityPasswordAttribute: String(raw.entityPasswordAttribute ?? 'password').trim() || 'password',
    entityUserIdAttribute: String(raw.entityUserIdAttribute ?? 'id').trim() || 'id',
    ssoTemplateKey: String(raw.ssoTemplateKey ?? '').trim(),
    skipIfSignedIn: raw.skipIfSignedIn !== false,
  }
}

/** Resolve SSO IdP settings from a chatbot SSO template (or null if missing). */
export function resolveSignInSsoTemplate(
  templateKey: string,
  templatesByKey: Record<string, unknown> | null | undefined,
): SsoContent | null {
  const key = templateKey.trim()
  if (!key || !templatesByKey) return null
  const raw = templatesByKey[key]
  if (raw == null) return null
  // templateExprValue spreads content fields onto the expr object
  return parseSsoContent(raw)
}

function xmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function newSamlRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `_${crypto.randomUUID().replace(/-/g, '')}`
  }
  return `_ff${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Build a SAML 2.0 AuthnRequest for HTTP-Redirect binding
 * (deflate + base64 → SAMLRequest query param). Azure AADSTS750054
 * occurs when the SSO URL is opened without this parameter.
 */
export function buildSamlRedirectAuthnRequest(args: {
  destination: string
  issuer: string
  acsUrl: string
}): string {
  const id = newSamlRequestId()
  const issueInstant = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"` +
    ` xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"` +
    ` ID="${xmlAttr(id)}"` +
    ` Version="2.0"` +
    ` IssueInstant="${xmlAttr(issueInstant)}"` +
    ` Destination="${xmlAttr(args.destination)}"` +
    ` AssertionConsumerServiceURL="${xmlAttr(args.acsUrl)}"` +
    ` ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">` +
    `<saml:Issuer>${xmlAttr(args.issuer)}</saml:Issuer>` +
    `<samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" AllowCreate="true"/>` +
    `</samlp:AuthnRequest>`
  )
}

export function encodeSamlRedirectRequest(xml: string): string {
  const deflated = deflateSync(new TextEncoder().encode(xml), { level: 9 })
  return bytesToBase64(deflated)
}

/** Build an OIDC/SAML authorize URL from an SSO template. */
export function buildSignInSsoAuthorizeUrl(
  sso: Pick<
    SsoContent,
    | 'protocol'
    | 'oidcAuthorizationUrl'
    | 'oidcClientId'
    | 'oidcScopes'
    | 'samlSsoUrl'
    | 'samlEntityId'
    | 'samlAcsUrl'
  >,
  args: { redirectUri: string; state: string },
): string | null {
  try {
    if (sso.protocol === 'saml') {
      const destination = sso.samlSsoUrl.trim()
      const issuer = sso.samlEntityId.trim()
      // Prefer the live callback URL passed by the chat (API ACS) so SSO can return
      // without remounting the conversation. Template ACS is the value to register at the IdP.
      const acsUrl = args.redirectUri.trim() || sso.samlAcsUrl.trim()
      if (!destination || !issuer || !acsUrl) return null
      const xml = buildSamlRedirectAuthnRequest({ destination, issuer, acsUrl })
      const url = new URL(destination)
      url.searchParams.set('SAMLRequest', encodeSamlRedirectRequest(xml))
      if (args.state) url.searchParams.set('RelayState', args.state)
      return url.toString()
    }
    const base = sso.oidcAuthorizationUrl.trim()
    const clientId = sso.oidcClientId.trim()
    if (!base || !clientId) return null
    const url = new URL(base)
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', sso.oidcScopes.trim() || 'openid email profile')
    url.searchParams.set('redirect_uri', args.redirectUri)
    url.searchParams.set('state', args.state)
    return url.toString()
  } catch {
    return null
  }
}

export const SSO_PENDING_STORAGE_KEY = 'ff-chat-sso-pending'

export type {
  PendingSsoLaunch,
  ChatSsoSnapshot,
  SsoCallbackResult,
} from '@/features/chat/chatSsoSession'

export {
  storePendingSsoLaunch,
  readPendingSsoLaunch,
  clearPendingSsoLaunch,
  storeSsoCallbackResult,
  readSsoCallbackResult,
  clearSsoCallbackResult,
  chatSsoCallbackUrl,
  packSsoRelayState,
  isSsoMessage,
  SSO_RESULT_STORAGE_KEY,
  SSO_MESSAGE_SOURCE,
} from '@/features/chat/chatSsoSession'

/** Read a claim by exact key first (Azure URIs contain dots). */
export function getSsoClaim(claims: Record<string, unknown>, path: string): unknown {
  const key = path.trim()
  if (!key) return undefined
  if (Object.prototype.hasOwnProperty.call(claims, key)) return claims[key]
  return getByPath(claims, key)
}

const EMAIL_CLAIM_FALLBACKS = [
  'email',
  'mail',
  'Email',
  'preferred_username',
  'upn',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
]

const USER_ID_CLAIM_FALLBACKS = [
  'sub',
  'oid',
  'id',
  'user_id',
  'http://schemas.microsoft.com/identity/claims/objectidentifier',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
]

const NAME_CLAIM_FALLBACKS = [
  'name',
  'displayName',
  'display_name',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
  'http://schemas.microsoft.com/identity/claims/displayname',
]

function firstClaim(
  claims: Record<string, unknown>,
  keys: string[],
): string {
  for (const key of keys) {
    const raw = getSsoClaim(claims, key)
    if (raw == null) continue
    const text = String(raw).trim()
    if (text) return text
  }
  return ''
}

/**
 * Normalize IdP attributes into a stable user object for {{vars.user}} / profileVariable.
 * Keeps raw claims and adds email / id / name aliases.
 */
export function normalizeSsoUserClaims(
  claims: Record<string, unknown>,
  sso: Pick<SsoContent, 'emailClaim' | 'userIdClaim' | 'providerName'>,
): Record<string, unknown> {
  const email = firstClaim(claims, [sso.emailClaim, ...EMAIL_CLAIM_FALLBACKS])
  const id =
    firstClaim(claims, [sso.userIdClaim, ...USER_ID_CLAIM_FALLBACKS]) ||
    (email ? `sso:${email}` : '')
  const name = firstClaim(claims, NAME_CLAIM_FALLBACKS) || email || sso.providerName || 'SSO User'
  return {
    ...claims,
    email,
    id,
    sub: id,
    name,
    provider: sso.providerName || null,
    [sso.emailClaim]: getSsoClaim(claims, sso.emailClaim) ?? email,
    [sso.userIdClaim]: getSsoClaim(claims, sso.userIdClaim) ?? id,
  }
}

/** Simulated IdP claims for designer preview when live redirect is not wired. */
export function buildSignInSsoPreviewClaims(
  sso: Pick<SsoContent, 'emailClaim' | 'userIdClaim' | 'previewEmail' | 'providerName'>,
  emailOverride?: string,
): Record<string, unknown> {
  const email = (emailOverride ?? sso.previewEmail).trim() || 'sso.user@example.com'
  return normalizeSsoUserClaims(
    {
      [sso.emailClaim]: email,
      [sso.userIdClaim]: `sso:${email}`,
      name: sso.providerName || 'SSO User',
      iss: 'flowforge-preview',
    },
    sso,
  )
}

export type SignInCredentials = {
  email: string
  password?: string
  otpCode?: string
  /** SSO: IdP claims payload (preview or callback). */
  ssoClaims?: Record<string, unknown>
}

/** Build the HTTP login JSON body from field keys or a JSON template. */
export function buildSignInRequestBody(
  cfg: Pick<SignInConfig, 'requestEmailKey' | 'requestPasswordKey' | 'requestBody'>,
  email: string,
  password: string,
): Record<string, unknown> {
  const template = cfg.requestBody.trim()
  if (template) {
    const filled = template.replace(/\{\{\s*(email|password)\s*\}\}/gi, (_m, key: string) => {
      const value = key.toLowerCase() === 'password' ? password : email
      // Placeholders sit inside JSON strings: {"pass":"{{password}}"}
      return JSON.stringify(value).slice(1, -1)
    })
    try {
      const parsed = JSON.parse(filled) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      /* fall through to key map */
    }
  }
  return {
    [cfg.requestEmailKey]: email,
    [cfg.requestPasswordKey]: password,
  }
}

function getByPath(value: unknown, path: string): unknown {
  if (!path.trim()) return undefined
  let cur: unknown = value
  for (const part of path.split('.').filter(Boolean)) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

function nextNodeId(
  edges: DesignerEdge[],
  fromId: string,
  handle?: string | null,
): string | null {
  const hit =
    edges.find((e) => e.source === fromId && (handle ? e.sourceHandle === handle : !e.sourceHandle)) ??
    edges.find((e) => e.source === fromId && (!handle || e.sourceHandle === handle)) ??
    edges.find((e) => e.source === fromId)
  return hit?.target ?? null
}

function generateOtpCode(length: number): string {
  const n = Math.max(4, Math.min(12, Math.round(length)))
  const bytes = new Uint8Array(n)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < n; i++) out += String(bytes[i]! % 10)
  return out
}

async function verifyViaHttp(args: {
  connectionId: string
  email: string
  password: string
  body: Record<string, unknown>
  successMin: number
  successMax: number
  chatbotId?: string
  instanceId?: string
  sessionId?: string | null
  path?: string
}): Promise<{
  ok: boolean
  body: unknown
  status: number
  error?: string
  responseHeaders?: Record<string, string>
}> {
  const { executeHttpConnection, isFlowForgeApiConfigured } = await import('@/shared/lib/flowforgeApi')
  if (!isFlowForgeApiConfigured()) {
    return { ok: false, body: null, status: 0, error: 'API not configured for HTTP sign-in' }
  }
  try {
    const result = await executeHttpConnection({
      connectionId: args.connectionId,
      chatbotId: args.chatbotId,
      instanceId: args.instanceId,
      sessionId: args.sessionId ?? undefined,
      method: 'POST',
      path: args.path || '/',
      body: args.body,
    })
    const status = Number(result.status ?? 0)
    const body = result.data ?? result
    const ok =
      result.ok !== false && status >= args.successMin && status <= args.successMax
    return {
      ok,
      body,
      status,
      responseHeaders: result.headers,
      error: ok
        ? undefined
        : result.error ||
          (result.ok === false
            ? `Upstream HTTP ${status}`
            : `HTTP ${status} outside success range ${args.successMin}-${args.successMax}`),
    }
  } catch (e) {
    return {
      ok: false,
      body: null,
      status: 0,
      error: e instanceof Error ? e.message : 'HTTP sign-in failed',
    }
  }
}

function recordFieldValue(record: Record<string, unknown>, attribute: string): unknown {
  if (!attribute) return undefined
  if (attribute === 'id') return record.id
  if (Object.prototype.hasOwnProperty.call(record, attribute)) return record[attribute]
  const lower = attribute.toLowerCase()
  for (const [key, value] of Object.entries(record)) {
    if (key.toLowerCase() === lower) return value
  }
  return undefined
}

function omitRecordField(record: Record<string, unknown>, attribute: string): Record<string, unknown> {
  if (!attribute) return { ...record }
  const lower = attribute.toLowerCase()
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    if (key.toLowerCase() === lower) continue
    out[key] = value
  }
  return out
}

function passwordMatches(stored: unknown, entered: string): Promise<boolean> {
  return import('@/features/entities/entityPassword').then(({ verifyPassword }) =>
    verifyPassword(entered, stored),
  )
}

function resolveAttributeKey(
  attrs: { key: string; label?: string | null }[],
  configured: string,
  aliases: string[],
): string {
  const configuredKey = configured.trim()
  if (!configuredKey) return configuredKey
  if (attrs.some((a) => a.key === configuredKey)) return configuredKey
  const lower = configuredKey.toLowerCase()
  const caseMatch = attrs.find((a) => a.key.toLowerCase() === lower)
  if (caseMatch) return caseMatch.key
  const aliasSet = new Set(aliases.map((a) => a.toLowerCase()))
  const byKey = attrs.find((a) => aliasSet.has(a.key.toLowerCase()))
  if (byKey) return byKey.key
  const byLabel = attrs.find((a) => aliasSet.has((a.label ?? '').trim().toLowerCase()))
  if (byLabel) return byLabel.key
  return configuredKey
}

async function verifyViaEntity(args: {
  entityId: string
  emailAttribute: string
  passwordAttribute: string
  userIdAttribute: string
  email: string
  password: string
  chatbotId?: string
}): Promise<{ ok: boolean; body: unknown; error?: string }> {
  const entityId = args.entityId.trim()
  if (!entityId) return { ok: false, body: null, error: 'Select an entity on this Sign-in step' }
  const chatbotId = args.chatbotId?.trim()
  if (!chatbotId) return { ok: false, body: null, error: 'Chatbot context is required for entity sign-in' }

  try {
    const { assertEntityLinkAllows, entityOpToLinkOp, listEntityRecords, toRecordPayload } =
      await import('@/features/entities/entityApi')
    await assertEntityLinkAllows(entityId, chatbotId, entityOpToLinkOp('get'))

    const { supabase } = await import('@/shared/lib/supabase')
    const [{ data: entity, error: entityError }, { data: attrs, error: attrsError }] = await Promise.all([
      supabase.from('chatbot_entities').select('id, kind').eq('id', entityId).single(),
      supabase.from('entity_attributes').select('key, label').eq('entity_id', entityId).order('sort_order'),
    ])
    if (entityError || !entity) {
      return { ok: false, body: null, error: entityError?.message ?? 'Entity not found' }
    }
    if (attrsError) {
      return { ok: false, body: null, error: attrsError.message }
    }

    const attributeRows = attrs ?? []
    const emailAttribute = resolveAttributeKey(attributeRows, args.emailAttribute, [
      'email',
      'e_mail',
      'mail',
      'username',
      'user_name',
      'login',
    ])
    const passwordAttribute = resolveAttributeKey(attributeRows, args.passwordAttribute, [
      'password',
      'pass',
      'passwd',
      'pwd',
      'secret',
    ])
    const rawUserIdAttr = args.userIdAttribute.trim() || 'id'
    const userIdAttribute =
      rawUserIdAttr === 'id'
        ? 'id'
        : resolveAttributeKey(attributeRows, rawUserIdAttr, ['user_id', 'userid', 'uid'])

    const rows = await listEntityRecords(entity)
    const emailNeedle = args.email.trim().toLowerCase()
    const match = rows.find((row) => {
      const payload = toRecordPayload(row)
      const emailValue = recordFieldValue(payload, emailAttribute)
      return String(emailValue ?? '')
        .trim()
        .toLowerCase() === emailNeedle
    })

    if (!match) {
      return { ok: false, body: null, error: 'Invalid email or password' }
    }

    const payload = toRecordPayload(match)
    const storedPassword = recordFieldValue(payload, passwordAttribute)
    if (!(await passwordMatches(storedPassword, args.password))) {
      return { ok: false, body: null, error: 'Invalid email or password' }
    }

    const userId = recordFieldValue(payload, userIdAttribute) ?? payload.id
    const safeProfile = omitRecordField(payload, passwordAttribute)
    return {
      ok: true,
      body: {
        email: args.email,
        user: { ...safeProfile, id: userId },
        userId,
        verified: true,
        source: 'entity',
      },
    }
  } catch (e) {
    return {
      ok: false,
      body: null,
      error: e instanceof Error ? e.message : 'Entity sign-in failed',
    }
  }
}

/**
 * Phase 1 of Sign-in OTP: email the visitor a code, then wait for Verify.
 */
export async function sendSignInOtpChallenge(args: {
  state: PreviewEngineState
  node: DesignerNode
  email: string
  connectionsById?: Record<string, Record<string, unknown>>
  chatbotId?: string
  instanceId?: string
  sessionId?: string | null
  resend?: boolean
}): Promise<PreviewEngineState> {
  const cfg = parseSignInConfig(args.node.config)
  const email = args.email.trim()
  if (!email) throw new Error('Enter your email first')
  if (cfg.mode !== 'otp') throw new Error('This Sign-in step is not in OTP mode')
  if (!cfg.connectionId) throw new Error('Select an email connection on this Sign-in step')

  const existing = args.state.otpChallenge
  if (
    !args.resend &&
    existing?.nodeId === args.node.id &&
    existing.to === email &&
    (existing.delivery === 'sent' || existing.delivery === 'mocked')
  ) {
    return args.state
  }

  const code = generateOtpCode(cfg.otpLength)
  const subject = applyOtpEmailTemplate(
    cfg.otpSubject,
    args.state.vars,
    args.state.stepOutputs,
    code,
    args.state.media,
    args.state.templates,
  )
  const body = applyOtpEmailTemplate(
    cfg.otpBody,
    args.state.vars,
    args.state.stepOutputs,
    code,
    args.state.media,
    args.state.templates,
  )
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
  const sentAt = new Date().toISOString()
  const connection = args.connectionsById?.[cfg.connectionId]

  const { isFlowForgeApiConfigured, sendEmailConnection } = await import('@/shared/lib/flowforgeApi')

  let delivery: PreviewOtpChallenge['delivery'] = 'failed'
  let error: string | null = null
  let messages = args.state.messages

  if (!isFlowForgeApiConfigured()) {
    delivery = 'mocked'
    messages = [
      ...messages,
      {
        id: crypto.randomUUID(),
        role: 'system' as const,
        text: `OTP emailed to ${email} (mocked — VITE_FLOWFORGE_API_URL not set). Preview code: ${code}`,
        createdAt: sentAt,
      },
    ]
  } else {
    try {
      const isPublicSession = !!args.sessionId
      let result: { ok: boolean; error?: string | null }

      if (isPublicSession) {
        result = await sendEmailConnection({
          connectionId: cfg.connectionId,
          chatbotId: args.chatbotId,
          instanceId: args.instanceId,
          sessionId: args.sessionId ?? undefined,
          to: email,
          subject,
          body,
        })
      } else {
        const host = String(connection?.smtpHost ?? '').trim()
        const fromEmail = String(connection?.fromEmail ?? '').trim()
        if (!connection || !host || !fromEmail) {
          throw new Error(
            'Could not load email connection secrets. Open Data → Connections, edit the email connection, confirm SMTP Host and From Email are saved, then try again.',
          )
        }
        result = await sendEmailConnection({
          connection,
          to: email,
          subject,
          body,
        })
      }

      if (result.ok) {
        delivery = 'sent'
        messages = [
          ...messages,
          {
            id: crypto.randomUUID(),
            role: 'system' as const,
            text: `Verification code sent to ${email}`,
            createdAt: sentAt,
          },
        ]
      } else {
        error = result.error ?? 'Failed to send OTP email'
        messages = [
          ...messages,
          {
            id: crypto.randomUUID(),
            role: 'system' as const,
            text: `OTP email failed: ${error}`,
            createdAt: sentAt,
          },
        ]
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to send OTP email'
      messages = [
        ...messages,
        {
          id: crypto.randomUUID(),
          role: 'system' as const,
          text: `OTP email failed: ${error}`,
          createdAt: sentAt,
        },
      ]
    }
  }

  const challenge: PreviewOtpChallenge = {
    nodeId: args.node.id,
    code,
    expiresAt,
    attempts: args.resend && existing?.nodeId === args.node.id ? existing.attempts : 0,
    maxAttempts: cfg.otpMaxAttempts,
    sentAt,
    to: email,
    delivery,
    error,
  }

  const waiting =
    args.state.phase.kind === 'waiting_input'
      ? {
          ...args.state.phase,
          validationError: error ?? undefined,
        }
      : args.state.phase

  return {
    ...args.state,
    messages,
    otpChallenge: challenge,
    phase: waiting,
  }
}

/**
 * Complete a Sign-in step from collected credentials.
 * Modes: password (HTTP if connection set, else capture-only), otp (code match vs challenge),
 * http (required connection), entity (lookup + password match), sso (IdP claims / preview simulation).
 * Wrong OTP codes / incorrect logins stay on the step until max attempts, then Fail.
 */
export async function completeSignInStep(args: {
  state: PreviewEngineState
  node: DesignerNode
  edges: DesignerEdge[]
  nodes: DesignerNode[]
  credentials: SignInCredentials
  /** @deprecated Prefer state.otpChallenge — kept for callers that pass the code explicitly. */
  otpExpected?: string | null
  chatbotId?: string
  instanceId?: string
  sessionId?: string | null
  httpPath?: string
  /** Chatbot templates by key — required for SSO mode. */
  templatesByKey?: Record<string, unknown> | null
}): Promise<PreviewEngineState> {
  const cfg = parseSignInConfig(args.node.config)

  if (cfg.mode === 'sign_out') {
    const vars: Record<string, unknown> = { ...args.state.vars, _signed_in: false }
    delete vars[cfg.emailVariable]
    delete vars[cfg.userIdVariable]
    delete vars[cfg.tokenVariable]
    delete vars[cfg.profileVariable]
    const now = new Date().toISOString()
    const nextId =
      nextNodeId(args.edges, args.node.id, 'success') ?? nextNodeId(args.edges, args.node.id)
    return {
      ...args.state,
      vars,
      messages: [
        ...args.state.messages,
        {
          id: crypto.randomUUID(),
          role: 'system',
          text: 'Signed out',
          createdAt: now,
        },
      ],
      runs: [
        ...args.state.runs,
        {
          id: crypto.randomUUID(),
          nodeId: args.node.id,
          nodeKey: args.node.key,
          nodeLabel: args.node.label || args.node.key,
          type: args.node.type,
          typeLabel: nodeTypeLabel(args.node.type),
          status: 'Succeeded',
          startedAt: now,
          finishedAt: now,
          durationMs: 0,
          inputs: { mode: 'sign_out' },
          processed: { signedOut: true },
          outputs: { ok: true, _signed_in: false },
          savedAs: null,
        },
      ],
      stepOutputs: {
        ...args.state.stepOutputs,
        [args.node.key]: { ok: true, signedOut: true },
      },
      currentId: nextId,
      phase: nextId ? { kind: 'typing' } : { kind: 'finished' },
      otpChallenge: null,
      signInAttempts: null,
    }
  }

  let ok = false
  let body: unknown = null
  let errorMsg: string | undefined
  let httpStatus = 0
  let httpRequestBody: Record<string, unknown> | undefined
  let httpPathUsed = '/'
  let otpChallenge = args.state.otpChallenge ?? null
  let signInAttempts = args.state.signInAttempts ?? null

  if (cfg.mode === 'sso') {
    const sso = resolveSignInSsoTemplate(cfg.ssoTemplateKey, args.templatesByKey ?? args.state.templates)
    if (!sso) {
      throw new Error(
        cfg.ssoTemplateKey
          ? `SSO template "${cfg.ssoTemplateKey}" was not found. Create it under Templates.`
          : 'Select an SSO template on this Sign-in step (Templates → SSO / IdP).',
      )
    }
    const claims = normalizeSsoUserClaims(
      args.credentials.ssoClaims && typeof args.credentials.ssoClaims === 'object'
        ? (args.credentials.ssoClaims as Record<string, unknown>)
        : buildSignInSsoPreviewClaims(sso, args.credentials.email),
      sso,
    )
    const emailFromClaim = String(
      getSsoClaim(claims, sso.emailClaim) ?? claims.email ?? args.credentials.email ?? '',
    ).trim()
    if (!emailFromClaim) throw new Error('SSO did not return an email claim')
    const userIdRaw = getSsoClaim(claims, sso.userIdClaim) ?? claims.id ?? claims.sub
    const userId =
      userIdRaw != null && String(userIdRaw).trim() ? String(userIdRaw) : `sso:${emailFromClaim}`
    const token =
      claims.access_token != null && String(claims.access_token).trim()
        ? String(claims.access_token)
        : claims.id_token != null && String(claims.id_token).trim()
          ? String(claims.id_token)
          : null
    const profile = claims
    const email = emailFromClaim
    const now = new Date().toISOString()
    const handle = 'success'
    const nextId = nextNodeId(args.edges, args.node.id, handle) ?? nextNodeId(args.edges, args.node.id)
    const vars = {
      ...args.state.vars,
      [cfg.emailVariable]: email,
      [cfg.userIdVariable]: userId,
      [cfg.tokenVariable]: token,
      [cfg.profileVariable]: profile,
      _signed_in: true,
    }
    const messages = [
      ...args.state.messages,
      {
        id: crypto.randomUUID(),
        role: 'user' as const,
        text: `${sso.providerName || 'SSO'}: ${email}`,
        createdAt: now,
      },
    ]
    const runs = [
      ...args.state.runs,
      {
        id: crypto.randomUUID(),
        nodeId: args.node.id,
        nodeKey: args.node.key,
        nodeLabel: args.node.label || args.node.key,
        type: args.node.type,
        typeLabel: nodeTypeLabel(args.node.type),
        status: 'Succeeded' as const,
        startedAt: now,
        finishedAt: now,
        durationMs: 0,
        inputs: {
          mode: cfg.mode,
          protocol: sso.protocol,
          provider: sso.providerName,
          templateKey: cfg.ssoTemplateKey,
          email,
        },
        processed: {
          handle,
          claims: claims as Json,
          user: profile as Json,
        },
        outputs: {
          ok: true,
          userId,
          token,
          error: null,
          data: claims as Json,
          user: profile as Json,
        },
        savedAs: `{{vars.${cfg.profileVariable}}}`,
      },
    ]
    return {
      ...args.state,
      vars,
      stepOutputs: {
        ...args.state.stepOutputs,
        [args.node.key]: { ok: true, email, userId, token, profile, user: profile },
      },
      messages,
      runs,
      currentId: nextId,
      phase: nextId ? { kind: 'typing' } : { kind: 'finished' },
      otpChallenge: null,
      signInAttempts: null,
    }
  }

  const email = args.credentials.email.trim()
  if (!email) throw new Error('Email is required')

  if (cfg.mode === 'otp') {
    const code = String(args.credentials.otpCode ?? '').replace(/\D/g, '')
    if (!code) throw new Error('Enter the verification code')

    let challenge = otpChallenge
    if (!challenge || challenge.nodeId !== args.node.id) {
      // Fall back to explicit expected code (legacy callers) without attempt tracking.
      const expected = String(args.otpExpected ?? '').replace(/\D/g, '')
      if (!expected) throw new Error('Send a verification code to your email first')
      challenge = {
        nodeId: args.node.id,
        code: expected,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        attempts: 0,
        maxAttempts: cfg.otpMaxAttempts,
        sentAt: new Date().toISOString(),
        to: email,
        delivery: 'mocked',
      }
    }

    if (Date.now() > Date.parse(challenge.expiresAt)) {
      const error = 'That code has expired. Resend a new code.'
      return stayOnSignIn(args.state, args.node, cfg, error, { otpChallenge: challenge })
    }

    if (challenge.attempts >= challenge.maxAttempts) {
      errorMsg = 'Too many incorrect attempts'
      ok = false
      otpChallenge = challenge
    } else if (code !== challenge.code.replace(/\D/g, '')) {
      const attempts = challenge.attempts + 1
      challenge = { ...challenge, attempts }
      const remaining = Math.max(0, challenge.maxAttempts - attempts)
      if (remaining > 0) {
        const error = `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`
        return stayOnSignIn(args.state, args.node, cfg, error, { otpChallenge: challenge }, code)
      }
      errorMsg = 'Incorrect code. Too many attempts.'
      ok = false
      otpChallenge = challenge
    } else {
      ok = true
      body = { email, verified: true }
      otpChallenge = null
    }
  } else if (cfg.mode === 'entity') {
    const password = String(args.credentials.password ?? '')
    if (!password) throw new Error('Password is required')
    const result = await verifyViaEntity({
      entityId: cfg.entityId,
      emailAttribute: cfg.entityEmailAttribute,
      passwordAttribute: cfg.entityPasswordAttribute,
      userIdAttribute: cfg.entityUserIdAttribute,
      email,
      password,
      chatbotId: args.chatbotId,
    })
    ok = result.ok
    body = result.body
    errorMsg = result.error
  } else if (cfg.mode === 'http' || (cfg.mode === 'password' && cfg.connectionId)) {
    if (!cfg.connectionId) throw new Error('Select an HTTP connection for Sign-in')
    const password = String(args.credentials.password ?? '')
    if (!password) throw new Error('Password is required')
    const requestBody = buildSignInRequestBody(cfg, email, password)
    httpRequestBody = requestBody
    httpPathUsed = args.httpPath || String(args.node.config.path ?? '/')
    const result = await verifyViaHttp({
      connectionId: cfg.connectionId,
      email,
      password,
      body: requestBody,
      successMin: cfg.successStatusMin,
      successMax: cfg.successStatusMax,
      chatbotId: args.chatbotId,
      instanceId: args.instanceId,
      sessionId: args.sessionId,
      path: httpPathUsed,
    })
    ok = result.ok
    body = result.body
    errorMsg = result.error
    httpStatus = result.status
  } else {
    // password capture-only (no connection): accept non-empty password
    const password = String(args.credentials.password ?? '')
    if (!password) throw new Error('Password is required')
    ok = true
    body = { email, captured: true }
  }

  // Incorrect HTTP / entity login: re-prompt until maxAttempts, then Fail.
  const tracksCredentialAttempts = cfg.mode === 'entity' || cfg.mode === 'http' || (cfg.mode === 'password' && !!cfg.connectionId)
  if (!ok && tracksCredentialAttempts) {
    const prev =
      signInAttempts?.nodeId === args.node.id
        ? signInAttempts
        : { nodeId: args.node.id, attempts: 0, maxAttempts: cfg.maxAttempts }
    const attempts = prev.attempts + 1
    const nextAttempts = { ...prev, attempts, maxAttempts: cfg.maxAttempts }
    const remaining = Math.max(0, cfg.maxAttempts - attempts)
    if (remaining > 0) {
      const baseError = errorMsg?.trim() || 'Incorrect email or password'
      const error = `${baseError}. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`
      return stayOnSignIn(args.state, args.node, cfg, error, { signInAttempts: nextAttempts }, email)
    }
    errorMsg = errorMsg?.trim()
      ? `${errorMsg.trim()}. Too many attempts.`
      : 'Incorrect email or password. Too many attempts.'
    signInAttempts = nextAttempts
  }

  if (ok) {
    signInAttempts = null
    if (cfg.mode !== 'otp') otpChallenge = null
  }

  const userId =
    cfg.mode === 'entity'
      ? (getByPath(body, 'userId') ?? getByPath(body, cfg.userIdPath) ?? (ok ? email : undefined))
      : (getByPath(body, cfg.userIdPath) ?? (ok ? email : undefined))
  const token = cfg.mode === 'entity' ? undefined : getByPath(body, cfg.tokenPath)
  const profile =
    cfg.mode === 'entity'
      ? (getByPath(body, 'user') ?? (ok ? { email } : undefined))
      : (getByPath(body, cfg.profilePath) ?? (ok ? { email } : undefined))

  const vars = { ...args.state.vars }
  vars[cfg.emailVariable] = email
  if (ok) {
    if (userId !== undefined) vars[cfg.userIdVariable] = userId
    if (token !== undefined) vars[cfg.tokenVariable] = token
    if (profile !== undefined) vars[cfg.profileVariable] = profile
    vars._signed_in = true
  }

  const now = new Date().toISOString()
  const handle = ok ? 'success' : 'fail'
  const nextId = nextNodeId(args.edges, args.node.id, handle) ?? nextNodeId(args.edges, args.node.id)

  const messages = [
    ...args.state.messages,
    {
      id: crypto.randomUUID(),
      role: 'user' as const,
      text: cfg.mode === 'otp' ? String(args.credentials.otpCode ?? email) : email,
      createdAt: now,
    },
  ]
  if (!ok && errorMsg) {
    messages.push({
      id: crypto.randomUUID(),
      role: 'system' as const,
      text: errorMsg,
      createdAt: now,
    })
  }

  const runs = [
    ...args.state.runs,
    {
      id: crypto.randomUUID(),
      nodeId: args.node.id,
      nodeKey: args.node.key,
      nodeLabel: args.node.label || args.node.key,
      type: args.node.type,
      typeLabel: nodeTypeLabel(args.node.type),
      status: (ok ? 'Succeeded' : 'Failed') as 'Succeeded' | 'Failed',
      startedAt: now,
      finishedAt: now,
      durationMs: 0,
      inputs: {
        mode: cfg.mode,
        email,
        connectionId: cfg.connectionId || undefined,
        entityId: cfg.mode === 'entity' ? cfg.entityId || undefined : undefined,
        path: httpRequestBody ? httpPathUsed : undefined,
        successStatusMin: httpRequestBody ? cfg.successStatusMin : undefined,
        successStatusMax: httpRequestBody ? cfg.successStatusMax : undefined,
        attempts: signInAttempts?.attempts,
        maxAttempts: tracksCredentialAttempts ? cfg.maxAttempts : undefined,
      },
      processed: {
        handle,
        method: httpRequestBody ? 'POST' : undefined,
        path: httpRequestBody ? httpPathUsed : undefined,
        body: (httpRequestBody ?? body) as Json,
        responseStatus: httpRequestBody ? httpStatus : undefined,
        responseError: errorMsg,
        failureReason: ok ? undefined : errorMsg,
      },
      outputs: {
        ok,
        userId,
        token,
        status: httpRequestBody ? httpStatus : undefined,
        error: errorMsg ?? null,
        data: body as Json,
      },
      savedAs: ok ? `{{vars.${cfg.userIdVariable}}}` : null,
    },
  ]

  // Exhausted attempts with no Fail edge: stay put so the visitor can try again / resend.
  if (!ok && !nextId) {
    return {
      ...args.state,
      vars,
      messages,
      runs,
      otpChallenge: cfg.mode === 'otp' ? null : args.state.otpChallenge,
      signInAttempts: tracksCredentialAttempts ? signInAttempts : args.state.signInAttempts,
      phase: {
        kind: 'waiting_input',
        nodeId: args.node.id,
        prompt: interpolate(
          cfg.prompt,
          args.state.vars,
          args.state.stepOutputs,
          args.state.media,
          true,
          args.state.templates,
        ),
        answerType: 'sign_in',
        startedAt: now,
        validationError: errorMsg ?? 'Sign-in failed',
      },
    }
  }

  return {
    ...args.state,
    vars,
    stepOutputs: {
      ...args.state.stepOutputs,
      [args.node.key]: { ok, email, userId, token, profile },
    },
    messages,
    runs,
    currentId: nextId,
    phase: nextId ? { kind: 'typing' } : { kind: 'finished' },
    otpChallenge: ok ? null : cfg.mode === 'otp' ? null : otpChallenge,
    signInAttempts: ok || !tracksCredentialAttempts ? null : signInAttempts,
  }
}

function stayOnSignIn(
  state: PreviewEngineState,
  node: DesignerNode,
  cfg: SignInConfig,
  error: string,
  extras: {
    otpChallenge?: PreviewOtpChallenge | null
    signInAttempts?: PreviewSignInAttempts | null
  },
  enteredText?: string,
): PreviewEngineState {
  const now = new Date().toISOString()
  const waiting =
    state.phase.kind === 'waiting_input'
      ? { ...state.phase, validationError: error }
      : {
          kind: 'waiting_input' as const,
          nodeId: node.id,
          prompt: interpolate(
            cfg.prompt,
            state.vars,
            state.stepOutputs,
            state.media,
            true,
            state.templates,
          ),
          answerType: 'sign_in',
          startedAt: now,
          validationError: error,
        }

  return {
    ...state,
    otpChallenge: extras.otpChallenge !== undefined ? extras.otpChallenge : state.otpChallenge,
    signInAttempts: extras.signInAttempts !== undefined ? extras.signInAttempts : state.signInAttempts,
    messages: [
      ...state.messages,
      ...(enteredText
        ? [
            {
              id: crypto.randomUUID(),
              role: 'user' as const,
              text: enteredText,
              createdAt: now,
            },
          ]
        : []),
      {
        id: crypto.randomUUID(),
        role: 'system' as const,
        text: error,
        createdAt: now,
      },
    ],
    phase: waiting,
  }
}
