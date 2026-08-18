import type { VariableType } from '@/shared/types/database'

export type SchemaField = {
  key: string
  type: VariableType
  required: boolean
  description?: string
  children?: SchemaField[]
}

export type ConnectionInputParam = {
  key: string
  label: string
  type: VariableType
  required: boolean
  /** Where the value is applied for HTTP calls */
  location: 'path' | 'query' | 'body' | 'header'
  defaultValue?: string
  description?: string
}

export type ExpectedResponse = {
  dataType: VariableType
  /** Required when dataType is object (or array of objects via itemSchema) */
  schema: SchemaField[]
  itemSchema?: SchemaField[]
  sampleJson?: string
}

export function emptySchemaField(): SchemaField {
  return { key: '', type: 'string', required: true, children: [] }
}

export function emptyInputParam(): ConnectionInputParam {
  return {
    key: '',
    label: '',
    type: 'string',
    required: true,
    location: 'query',
    defaultValue: '',
    description: '',
  }
}

export function defaultExpectedResponse(): ExpectedResponse {
  return {
    dataType: 'object',
    schema: [],
    itemSchema: [],
    sampleJson: '',
  }
}

/** Flatten schema into dotted paths for autocomplete / validation */
export function flattenSchemaPaths(
  fields: SchemaField[],
  prefix = '',
): Array<{ path: string; type: VariableType; required: boolean }> {
  const out: Array<{ path: string; type: VariableType; required: boolean }> = []
  for (const field of fields) {
    if (!field.key.trim()) continue
    const path = prefix ? `${prefix}.${field.key.trim()}` : field.key.trim()
    out.push({ path, type: field.type, required: field.required })
    if (field.type === 'object' && field.children?.length) {
      out.push(...flattenSchemaPaths(field.children, path))
    }
    if (field.type === 'array' && field.children?.length) {
      // Represent array item fields as path[] .child for designer hints
      out.push(...flattenSchemaPaths(field.children, `${path}[]`))
    }
  }
  return out
}

export function parseSchemaFields(raw: unknown): SchemaField[] {
  if (!Array.isArray(raw)) return []
  return raw.map((row) => {
    if (!row || typeof row !== 'object') return emptySchemaField()
    const r = row as Record<string, unknown>
    const type = (['string', 'number', 'boolean', 'date', 'array', 'object'] as VariableType[]).includes(
      r.type as VariableType,
    )
      ? (r.type as VariableType)
      : 'string'
    return {
      key: String(r.key ?? ''),
      type,
      required: Boolean(r.required ?? true),
      description: String(r.description ?? ''),
      children: parseSchemaFields(r.children),
    }
  })
}

export function parseInputParams(raw: unknown): ConnectionInputParam[] {
  if (!Array.isArray(raw)) return []
  return raw.map((row) => {
    if (!row || typeof row !== 'object') return emptyInputParam()
    const r = row as Record<string, unknown>
    const type = (['string', 'number', 'boolean', 'date', 'array', 'object'] as VariableType[]).includes(
      r.type as VariableType,
    )
      ? (r.type as VariableType)
      : 'string'
    const location = (['path', 'query', 'body', 'header'] as const).includes(r.location as never)
      ? (r.location as ConnectionInputParam['location'])
      : 'query'
    return {
      key: String(r.key ?? ''),
      label: String(r.label ?? r.key ?? ''),
      type,
      required: Boolean(r.required ?? true),
      location,
      defaultValue: String(r.defaultValue ?? ''),
      description: String(r.description ?? ''),
    }
  })
}

export function parseExpectedResponse(raw: unknown): ExpectedResponse {
  const base = defaultExpectedResponse()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base
  const r = raw as Record<string, unknown>
  const dataType = (['string', 'number', 'boolean', 'date', 'array', 'object'] as VariableType[]).includes(
    r.dataType as VariableType,
  )
    ? (r.dataType as VariableType)
    : 'object'
  return {
    dataType,
    schema: parseSchemaFields(r.schema),
    itemSchema: parseSchemaFields(r.itemSchema),
    sampleJson: String(r.sampleJson ?? ''),
  }
}

export function validateValueAgainstSchema(
  value: unknown,
  dataType: VariableType,
  schema: SchemaField[],
  itemSchema: SchemaField[] = [],
  path = 'response',
): string[] {
  const errors: string[] = []

  if (dataType === 'object') {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`Expected ${path} to be an object`)
      return errors
    }
    const obj = value as Record<string, unknown>
    for (const field of schema) {
      if (!field.key.trim()) continue
      const key = field.key.trim()
      const childPath = `${path}.${key}`
      if (!(key in obj) || obj[key] === undefined || obj[key] === null) {
        if (field.required) errors.push(`Missing required field ${childPath}`)
        continue
      }
      errors.push(...validateLeaf(obj[key], field, childPath))
    }
    return errors
  }

  if (dataType === 'array') {
    if (!Array.isArray(value)) {
      errors.push(`Expected ${path} to be an array`)
      return errors
    }
    if (itemSchema.length) {
      value.forEach((item, i) => {
        errors.push(...validateValueAgainstSchema(item, 'object', itemSchema, [], `${path}[${i}]`))
      })
    }
    return errors
  }

  errors.push(...validatePrimitive(value, dataType, path))
  return errors
}

function validateLeaf(value: unknown, field: SchemaField, path: string): string[] {
  if (field.type === 'object') {
    return validateValueAgainstSchema(value, 'object', field.children ?? [], [], path)
  }
  if (field.type === 'array') {
    return validateValueAgainstSchema(value, 'array', [], field.children ?? [], path)
  }
  return validatePrimitive(value, field.type, path)
}

function validatePrimitive(value: unknown, type: VariableType, path: string): string[] {
  switch (type) {
    case 'string':
    case 'date':
      return typeof value === 'string' ? [] : [`${path} must be a string`]
    case 'number':
      return typeof value === 'number' && !Number.isNaN(value) ? [] : [`${path} must be a number`]
    case 'boolean':
      return typeof value === 'boolean' ? [] : [`${path} must be a boolean`]
    default:
      return []
  }
}

export function tryParseSampleJson(sample: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const trimmed = sample.trim()
  if (!trimmed) return { ok: false, error: 'Sample JSON is empty' }
  try {
    return { ok: true, value: JSON.parse(trimmed) }
  } catch {
    return { ok: false, error: 'Sample JSON is invalid' }
  }
}
