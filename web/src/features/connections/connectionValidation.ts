import type { ConnectionKind, ConnectionWithConfig, Json, VariableType } from '@/shared/types/database'
import { parseEmailConfig, parseHttpConfig } from '@/features/connections/connectionConfig'
import {
  defaultExpectedResponse,
  flattenSchemaPaths,
  type ConnectionInputParam,
  type ExpectedResponse,
} from '@/features/connections/responseSchema'

export type ConnectionValidationInfo = {
  id: string
  name: string
  kind: ConnectionKind
  inputParams: ConnectionInputParam[]
  expectedResponse: ExpectedResponse
  responsePaths: Array<{ path: string; type: VariableType; required: boolean }>
  defaultMethod?: string
  defaultPath?: string
  /** False when this user cannot read secrets (linked marketplace connection). */
  canManage?: boolean
}

export function connectionInfoFromRow(c: ConnectionWithConfig): ConnectionValidationInfo {
  const config = (c.config ?? {}) as Json
  if (c.kind === 'http') {
    const cfg = parseHttpConfig(config)
    const schema =
      cfg.expectedResponse.dataType === 'object'
        ? cfg.expectedResponse.schema
        : cfg.expectedResponse.dataType === 'array'
          ? cfg.expectedResponse.itemSchema ?? []
          : []
    const nested = flattenSchemaPaths(schema)
    const responsePaths =
      cfg.expectedResponse.dataType === 'object'
        ? nested.map((p) => ({ ...p, path: `data.${p.path}` }))
        : cfg.expectedResponse.dataType === 'array'
          ? [
              { path: 'data', type: 'array' as VariableType, required: true },
              ...nested.map((p) => ({ ...p, path: `data[].${p.path}` })),
            ]
          : [{ path: 'data', type: cfg.expectedResponse.dataType, required: true }]

    return {
      id: c.id,
      name: c.name,
      kind: 'http',
      inputParams: cfg.inputParams,
      expectedResponse: cfg.expectedResponse,
      responsePaths: [
        { path: 'ok', type: 'boolean', required: true },
        { path: 'status', type: 'number', required: true },
        ...responsePaths,
      ],
      defaultMethod: cfg.defaultMethod,
      defaultPath: cfg.defaultPath,
      canManage: c.canManage,
    }
  }

  if (c.kind === 'payment') {
    return {
      id: c.id,
      name: c.name,
      kind: 'payment',
      inputParams: [],
      expectedResponse: defaultExpectedResponse(),
      responsePaths: [
        { path: 'ok', type: 'boolean', required: true },
        { path: 'status', type: 'string', required: true },
        { path: 'reference', type: 'string', required: true },
      ],
      canManage: c.canManage,
    }
  }

  const cfg = parseEmailConfig(config)
  const nested = flattenSchemaPaths(
    cfg.expectedResponse.dataType === 'object' ? cfg.expectedResponse.schema : [],
  )
  const byPath = new Map<string, { path: string; type: VariableType; required: boolean }>()

  const defaults: Array<{ path: string; type: VariableType; required: boolean }> = [
    { path: 'ok', type: 'boolean', required: true },
    { path: 'message_id', type: 'string', required: false },
    { path: 'to', type: 'string', required: true },
    { path: 'subject', type: 'string', required: true },
    { path: 'body', type: 'string', required: true },
    { path: 'error', type: 'string', required: false },
  ]
  for (const row of defaults) byPath.set(row.path, row)

  for (const param of cfg.inputParams) {
    const key = param.key.trim()
    if (!key || byPath.has(key)) continue
    byPath.set(key, { path: key, type: param.type, required: param.required })
  }

  for (const row of nested) {
    byPath.set(row.path, row)
  }

  return {
    id: c.id,
    name: c.name,
    kind: 'email',
    inputParams: cfg.inputParams,
    expectedResponse: cfg.expectedResponse,
    responsePaths: [...byPath.values()],
    canManage: c.canManage,
  }
}

export function buildConnectionsMap(rows: ConnectionWithConfig[]): Record<string, ConnectionValidationInfo> {
  const map: Record<string, ConnectionValidationInfo> = {}
  for (const row of rows) map[row.id] = connectionInfoFromRow(row)
  return map
}
