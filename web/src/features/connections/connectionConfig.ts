import type { ConnectionKind, Json, VariableType } from '@/shared/types/database'
import {
  defaultExpectedResponse,
  parseExpectedResponse,
  parseInputParams,
  type ConnectionInputParam,
  type ExpectedResponse,
} from '@/features/connections/responseSchema'

export type HttpAuthType = 'none' | 'api_key' | 'bearer' | 'basic'

export type HeaderPair = { key: string; value: string }

export type HttpConnectionConfig = {
  baseUrl: string
  authType: HttpAuthType
  username: string
  password: string
  apiKey: string
  apiKeyHeader: string
  bearerToken: string
  headers: HeaderPair[]
  timeoutMs: number
  defaultMethod: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  defaultPath: string
  inputParams: ConnectionInputParam[]
  expectedResponse: ExpectedResponse
}

export type EmailEncryption = 'none' | 'starttls' | 'ssl'

export type PaymentProvider = 'payfast' | 'custom'

export type PaymentConnectionConfig = {
  provider: PaymentProvider
  merchantId: string
  merchantKey: string
  passphrase: string
  sandbox: boolean
  sharedSecret: string
}

export type EmailConnectionConfig = {
  smtpHost: string
  smtpPort: number
  username: string
  password: string
  encryption: EmailEncryption
  fromEmail: string
  fromName: string
  replyTo: string
  inputParams: ConnectionInputParam[]
  expectedResponse: ExpectedResponse
}

export const defaultHttpConfig = (): HttpConnectionConfig => ({
  baseUrl: '',
  authType: 'none',
  username: '',
  password: '',
  apiKey: '',
  apiKeyHeader: 'X-API-Key',
  bearerToken: '',
  headers: [],
  timeoutMs: 30000,
  defaultMethod: 'GET',
  defaultPath: '/',
  inputParams: [],
  expectedResponse: defaultExpectedResponse(),
})

export const defaultEmailConfig = (): EmailConnectionConfig => ({
  smtpHost: '',
  smtpPort: 587,
  username: '',
  password: '',
  encryption: 'starttls',
  fromEmail: '',
  fromName: '',
  replyTo: '',
  inputParams: [
    {
      key: 'to',
      label: 'To',
      type: 'string',
      required: true,
      location: 'body',
      defaultValue: '',
      description: 'Recipient email',
    },
    {
      key: 'subject',
      label: 'Subject',
      type: 'string',
      required: true,
      location: 'body',
      defaultValue: '',
      description: '',
    },
    {
      key: 'body',
      label: 'Body',
      type: 'string',
      required: true,
      location: 'body',
      defaultValue: '',
      description: '',
    },
  ],
  expectedResponse: {
    dataType: 'object',
    schema: [
      { key: 'ok', type: 'boolean', required: true, children: [] },
      { key: 'message_id', type: 'string', required: false, children: [] },
      { key: 'to', type: 'string', required: true, children: [] },
      { key: 'subject', type: 'string', required: true, children: [] },
      { key: 'body', type: 'string', required: true, children: [] },
      { key: 'error', type: 'string', required: false, children: [] },
    ],
    itemSchema: [],
    sampleJson:
      '{\n  "ok": true,\n  "message_id": "<abc@smtp>",\n  "to": "user@example.com",\n  "subject": "Hello",\n  "body": "Message text",\n  "error": null\n}',
  },
})

export const defaultPaymentConfig = (): PaymentConnectionConfig => ({
  provider: 'payfast',
  merchantId: '',
  merchantKey: '',
  passphrase: '',
  sandbox: true,
  sharedSecret: '',
})

export function parseHttpConfig(raw: Json | null | undefined): HttpConnectionConfig {
  const base = defaultHttpConfig()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base
  const obj = raw as Record<string, unknown>

  const headers: HeaderPair[] = []
  if (Array.isArray(obj.headers)) {
    for (const row of obj.headers) {
      if (row && typeof row === 'object' && !Array.isArray(row)) {
        const r = row as Record<string, unknown>
        headers.push({ key: String(r.key ?? ''), value: String(r.value ?? '') })
      }
    }
  } else if (obj.headers && typeof obj.headers === 'object') {
    for (const [key, value] of Object.entries(obj.headers as Record<string, unknown>)) {
      headers.push({ key, value: String(value ?? '') })
    }
  }

  const authType = (['none', 'api_key', 'bearer', 'basic'] as HttpAuthType[]).includes(
    obj.authType as HttpAuthType,
  )
    ? (obj.authType as HttpAuthType)
    : 'none'

  const defaultMethod = (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const).includes(
    obj.defaultMethod as never,
  )
    ? (obj.defaultMethod as HttpConnectionConfig['defaultMethod'])
    : 'GET'

  return {
    baseUrl: String(obj.baseUrl ?? ''),
    authType,
    username: String(obj.username ?? ''),
    password: String(obj.password ?? ''),
    apiKey: String(obj.apiKey ?? ''),
    apiKeyHeader: String(obj.apiKeyHeader ?? 'X-API-Key'),
    bearerToken: String(obj.bearerToken ?? ''),
    headers,
    timeoutMs: Number(obj.timeoutMs ?? 30000) || 30000,
    defaultMethod,
    defaultPath: String(obj.defaultPath ?? '/'),
    inputParams: parseInputParams(obj.inputParams),
    expectedResponse: parseExpectedResponse(obj.expectedResponse),
  }
}

export function parseEmailConfig(raw: Json | null | undefined): EmailConnectionConfig {
  const base = defaultEmailConfig()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base
  const obj = raw as Record<string, unknown>
  const encryption = (['none', 'starttls', 'ssl'] as EmailEncryption[]).includes(
    obj.encryption as EmailEncryption,
  )
    ? (obj.encryption as EmailEncryption)
    : 'starttls'

  const inputParams = obj.inputParams !== undefined ? parseInputParams(obj.inputParams) : base.inputParams
  const expectedResponse =
    obj.expectedResponse !== undefined ? parseExpectedResponse(obj.expectedResponse) : base.expectedResponse

  return {
    smtpHost: String(obj.smtpHost ?? ''),
    smtpPort: Number(obj.smtpPort ?? 587) || 587,
    username: String(obj.username ?? ''),
    password: String(obj.password ?? ''),
    encryption,
    fromEmail: String(obj.fromEmail ?? ''),
    fromName: String(obj.fromName ?? ''),
    replyTo: String(obj.replyTo ?? ''),
    inputParams,
    expectedResponse,
  }
}

export function parsePaymentConfig(raw: Json | null | undefined): PaymentConnectionConfig {
  const base = defaultPaymentConfig()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base
  const obj = raw as Record<string, unknown>
  const provider = obj.provider === 'custom' ? 'custom' : 'payfast'
  return {
    provider,
    merchantId: String(obj.merchantId ?? ''),
    merchantKey: String(obj.merchantKey ?? ''),
    passphrase: String(obj.passphrase ?? ''),
    sandbox: obj.sandbox === true,
    sharedSecret: String(obj.sharedSecret ?? ''),
  }
}

export function toHttpJson(config: HttpConnectionConfig): Json {
  return {
    baseUrl: config.baseUrl.trim(),
    authType: config.authType,
    username: config.username,
    password: config.password,
    apiKey: config.apiKey,
    apiKeyHeader: config.apiKeyHeader.trim() || 'X-API-Key',
    bearerToken: config.bearerToken,
    headers: config.headers.filter((h) => h.key.trim()),
    timeoutMs: config.timeoutMs,
    defaultMethod: config.defaultMethod,
    defaultPath: config.defaultPath.trim() || '/',
    inputParams: config.inputParams.filter((p) => p.key.trim()),
    expectedResponse: config.expectedResponse,
  }
}

export function toEmailJson(config: EmailConnectionConfig): Json {
  return {
    smtpHost: config.smtpHost.trim(),
    smtpPort: config.smtpPort,
    username: config.username,
    password: config.password,
    encryption: config.encryption,
    fromEmail: config.fromEmail.trim(),
    fromName: config.fromName.trim(),
    replyTo: config.replyTo.trim(),
    inputParams: config.inputParams.filter((p) => p.key.trim()),
    expectedResponse: config.expectedResponse,
  }
}

export function toPaymentJson(config: PaymentConnectionConfig): Json {
  return {
    provider: config.provider,
    merchantId: config.merchantId.trim(),
    merchantKey: config.merchantKey,
    passphrase: config.passphrase,
    sandbox: config.sandbox === true,
    sharedSecret: config.sharedSecret,
  }
}

export function connectionConfigToJson(
  kind: ConnectionKind,
  configs: {
    http: HttpConnectionConfig
    email: EmailConnectionConfig
    payment: PaymentConnectionConfig
  },
): Json {
  if (kind === 'http') return toHttpJson(configs.http)
  if (kind === 'email') return toEmailJson(configs.email)
  return toPaymentJson(configs.payment)
}

export function summarizeConnection(kind: ConnectionKind, config: Json): string[] {
  if (kind === 'http') {
    const c = parseHttpConfig(config)
    const lines = [
      `Base URL: ${c.baseUrl || '—'}`,
      `Auth: ${labelAuth(c.authType)}`,
      `Default: ${c.defaultMethod} ${c.defaultPath}`,
    ]
    if (c.inputParams.length) lines.push(`Input params: ${c.inputParams.length}`)
    lines.push(`Response type: ${c.expectedResponse.dataType}`)
    if (c.expectedResponse.dataType === 'object') {
      lines.push(`Schema fields: ${c.expectedResponse.schema.filter((f) => f.key.trim()).length}`)
    }
    lines.push(`Timeout: ${c.timeoutMs}ms`)
    return lines
  }

  if (kind === 'payment') {
    const c = parsePaymentConfig(config)
    if (c.provider === 'custom') {
      return [
        'Provider: Custom notify',
        c.sharedSecret ? 'Shared secret: set' : 'Shared secret: —',
      ]
    }
    return [
      'Provider: PayFast',
      `Merchant ID: ${c.merchantId || '—'}`,
      c.sandbox ? 'Mode: sandbox' : 'Mode: live',
      c.passphrase ? 'Passphrase: set' : 'Passphrase: —',
    ]
  }

  const c = parseEmailConfig(config)
  return [
    `SMTP: ${c.smtpHost || '—'}:${c.smtpPort}`,
    `Encryption: ${labelEncryption(c.encryption)}`,
    c.username ? `Username: ${c.username}` : 'Username: —',
    `From: ${c.fromName ? `${c.fromName} <${c.fromEmail}>` : c.fromEmail || '—'}`,
    c.replyTo ? `Reply-To: ${c.replyTo}` : null,
    `Input params: ${c.inputParams.length}`,
    `Response type: ${c.expectedResponse.dataType}`,
  ].filter(Boolean) as string[]
}

function labelAuth(type: HttpAuthType) {
  switch (type) {
    case 'none':
      return 'None'
    case 'api_key':
      return 'API key'
    case 'bearer':
      return 'Bearer token'
    case 'basic':
      return 'Username & password'
  }
}

function labelEncryption(type: EmailEncryption) {
  switch (type) {
    case 'none':
      return 'None'
    case 'starttls':
      return 'STARTTLS'
    case 'ssl':
      return 'SSL/TLS'
  }
}

export const HTTP_AUTH_OPTIONS: { value: HttpAuthType; label: string; hint: string }[] = [
  { value: 'none', label: 'No authentication', hint: 'Public endpoint' },
  { value: 'api_key', label: 'API key', hint: 'Send a key in a header' },
  { value: 'bearer', label: 'Bearer token', hint: 'Authorization: Bearer …' },
  { value: 'basic', label: 'Username & password', hint: 'HTTP Basic auth' },
]

export const EMAIL_ENCRYPTION_OPTIONS: { value: EmailEncryption; label: string; portHint: number }[] = [
  { value: 'none', label: 'None', portHint: 25 },
  { value: 'starttls', label: 'STARTTLS (recommended)', portHint: 587 },
  { value: 'ssl', label: 'SSL/TLS', portHint: 465 },
]

export const PAYMENT_PROVIDER_OPTIONS: Array<{ value: PaymentProvider; label: string; hint: string }> = [
  {
    value: 'payfast',
    label: 'PayFast',
    hint: 'Server confirms the ITN with PayFast using your merchant passphrase',
  },
  {
    value: 'custom',
    label: 'Custom notify',
    hint: 'Your gateway POSTs to FlowForge /payment/notify with a shared secret or HMAC',
  },
]

export const VARIABLE_TYPE_OPTIONS: VariableType[] = [
  'string',
  'number',
  'boolean',
  'date',
  'array',
  'object',
]

/** Apply path/query params from step values onto a path template like /users/:id or /users/{{id}} */
export function applyPathParams(pathTemplate: string, params: Record<string, string>): string {
  let path = pathTemplate
  for (const [key, value] of Object.entries(params)) {
    path = path.replaceAll(`:${key}`, encodeURIComponent(value))
    path = path.replaceAll(`{{${key}}}`, encodeURIComponent(value))
    path = path.replaceAll(`{${key}}`, encodeURIComponent(value))
  }
  return path
}
