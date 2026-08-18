import { applyPathParams, type HttpConnectionConfig } from '@/features/connections/connectionConfig'
import type { ConnectionInputParam } from '@/features/connections/responseSchema'

export type BuiltHttpRequest = {
  method: string
  path: string
  query: Record<string, string>
  headers: Array<{ key: string; value: string }>
  body: unknown
}

export function resolveParamValues(
  params: ConnectionInputParam[],
  values: Record<string, string>,
): { values: Record<string, string>; missing: string[] } {
  const resolved: Record<string, string> = {}
  const missing: string[] = []
  for (const param of params) {
    if (!param.key.trim()) continue
    const key = param.key.trim()
    const raw = (values[key] ?? param.defaultValue ?? '').trim()
    if (!raw && param.required) missing.push(param.label || key)
    resolved[key] = raw
  }
  return { values: resolved, missing }
}

export function buildHttpRequest(
  connection: HttpConnectionConfig,
  options: {
    method?: string
    path?: string
    paramValues?: Record<string, string>
    bodyOverride?: string
  } = {},
): BuiltHttpRequest {
  const { values } = resolveParamValues(connection.inputParams, options.paramValues ?? {})
  const method = (options.method || connection.defaultMethod || 'GET').toUpperCase()
  let path = options.path?.trim() || connection.defaultPath || '/'
  const pathParams: Record<string, string> = {}
  const query: Record<string, string> = {}
  const headers: Array<{ key: string; value: string }> = []
  const bodyObj: Record<string, string> = {}

  for (const param of connection.inputParams) {
    if (!param.key.trim()) continue
    const key = param.key.trim()
    const value = values[key] ?? ''
    if (!value) continue
    if (param.location === 'path') pathParams[key] = value
    else if (param.location === 'query') query[key] = value
    else if (param.location === 'header') headers.push({ key, value })
    else bodyObj[key] = value
  }

  path = applyPathParams(path, { ...pathParams, ...values })

  let body: unknown = undefined
  if (options.bodyOverride?.trim()) {
    try {
      body = JSON.parse(options.bodyOverride)
    } catch {
      body = options.bodyOverride
    }
  } else if (Object.keys(bodyObj).length && !['GET', 'HEAD'].includes(method)) {
    body = bodyObj
  }

  return { method, path, query, headers, body }
}
