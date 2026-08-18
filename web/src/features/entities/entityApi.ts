import { supabase } from '@/shared/lib/supabase'
import type {
  ChatbotEntity,
  EntityAttribute,
  EntityKind,
  EntityStaticRecord,
  Json,
  VariableType,
} from '@/shared/types/database'
import { validateAndCoerceEntityValues } from '@/features/entities/entityValueValidation'

export type EntityWithMeta = ChatbotEntity & {
  attributes: EntityAttribute[]
  static_records?: EntityStaticRecord[]
  dynamic_count?: number
}

export type EntityRecordView = {
  id: string
  values: Record<string, unknown>
  sort_order?: number
  created_at?: string
  updated_at?: string
}

function asValues(raw: Json | null | undefined): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  return {}
}

export async function fetchChatbotEntities(chatbotId: string): Promise<EntityWithMeta[]> {
  const { data: entities, error } = await supabase
    .from('chatbot_entities')
    .select('*')
    .eq('chatbot_id', chatbotId)
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  if (!entities?.length) return []

  const ids = entities.map((e) => e.id)
  const [{ data: attrs, error: attrsError }, { data: staticRows, error: staticError }, { data: dynamicRows, error: dynamicError }] =
    await Promise.all([
      supabase.from('entity_attributes').select('*').in('entity_id', ids).order('sort_order'),
      supabase.from('entity_static_records').select('*').in('entity_id', ids).order('sort_order'),
      supabase.from('entity_dynamic_records').select('id, entity_id').in('entity_id', ids),
    ])
  if (attrsError) throw attrsError
  if (staticError) throw staticError
  if (dynamicError) throw dynamicError

  const attrsBy = new Map<string, EntityAttribute[]>()
  for (const a of attrs ?? []) {
    const list = attrsBy.get(a.entity_id) ?? []
    list.push(a)
    attrsBy.set(a.entity_id, list)
  }
  const staticBy = new Map<string, EntityStaticRecord[]>()
  for (const r of staticRows ?? []) {
    const list = staticBy.get(r.entity_id) ?? []
    list.push(r)
    staticBy.set(r.entity_id, list)
  }
  const dynCount = new Map<string, number>()
  for (const r of dynamicRows ?? []) {
    dynCount.set(r.entity_id, (dynCount.get(r.entity_id) ?? 0) + 1)
  }

  return entities.map((e) => ({
    ...e,
    attributes: attrsBy.get(e.id) ?? [],
    static_records: staticBy.get(e.id) ?? [],
    dynamic_count: dynCount.get(e.id) ?? 0,
  }))
}

export async function createEntity(input: {
  chatbotId: string
  key: string
  name: string
  description?: string
  kind: EntityKind
}): Promise<ChatbotEntity> {
  const { data, error } = await supabase
    .from('chatbot_entities')
    .insert({
      chatbot_id: input.chatbotId,
      key: input.key.trim(),
      name: input.name.trim(),
      description: input.description?.trim() || null,
      kind: input.kind,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateEntity(
  id: string,
  patch: Partial<Pick<ChatbotEntity, 'name' | 'description' | 'key'>>,
): Promise<void> {
  const { error } = await supabase.from('chatbot_entities').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteEntity(id: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_entity', { p_entity_id: id })
  if (error) throw error
}

export async function restoreEntity(id: string): Promise<void> {
  const { error } = await supabase.rpc('restore_entity', { p_entity_id: id })
  if (error) throw error
}

export async function upsertAttribute(input: {
  id?: string
  entityId: string
  key: string
  label?: string
  value_type: VariableType
  required?: boolean
  is_identifier?: boolean
  is_unique?: boolean
  default_value?: Json | null
  sort_order?: number
}): Promise<EntityAttribute> {
  if (input.id) {
    const { data, error } = await supabase
      .from('entity_attributes')
      .update({
        key: input.key.trim(),
        label: input.label?.trim() || null,
        value_type: input.value_type,
        required: !!input.required,
        is_identifier: !!input.is_identifier,
        is_unique: !!input.is_unique,
        default_value: input.default_value ?? null,
        sort_order: input.sort_order ?? 0,
      })
      .eq('id', input.id)
      .select('*')
      .single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase
    .from('entity_attributes')
    .insert({
      entity_id: input.entityId,
      key: input.key.trim(),
      label: input.label?.trim() || null,
      value_type: input.value_type,
      required: !!input.required,
      is_identifier: !!input.is_identifier,
      is_unique: !!input.is_unique,
      default_value: input.default_value ?? null,
      sort_order: input.sort_order ?? 0,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

function normalizeUniqueValue(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'string' && value.trim() === '') return null
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** Rejects create/update when an is_unique attribute already has the same value on another row. */
export async function assertUniqueAttributeValues(args: {
  entityId: string
  kind: EntityKind
  values: Record<string, unknown>
  excludeRecordId?: string
  /** When set, only these keys are checked (partial updates). */
  keys?: string[]
}): Promise<void> {
  const { data: attrs, error: attrsError } = await supabase
    .from('entity_attributes')
    .select('key, label, is_unique')
    .eq('entity_id', args.entityId)
    .eq('is_unique', true)
  if (attrsError) throw attrsError
  const uniqueAttrs = (attrs ?? []).filter((a) => !args.keys || args.keys.includes(a.key))
  if (!uniqueAttrs.length) return

  const entity = { id: args.entityId, kind: args.kind }
  const rows = await listEntityRecords(entity)
  for (const attr of uniqueAttrs) {
    if (!(attr.key in args.values)) continue
    const needle = normalizeUniqueValue(args.values[attr.key])
    if (needle === null) continue
    const clash = rows.find(
      (r) =>
        r.id !== args.excludeRecordId &&
        normalizeUniqueValue(r.values[attr.key]) === needle,
    )
    if (clash) {
      const label = attr.label?.trim() || attr.key
      throw new Error(`"${label}" must be unique — "${needle}" is already used`)
    }
  }
}

export async function deleteAttribute(id: string): Promise<void> {
  const { error } = await supabase.from('entity_attributes').delete().eq('id', id)
  if (error) throw error
}

async function loadEntityAttributes(entityId: string): Promise<EntityAttribute[]> {
  const { data, error } = await supabase
    .from('entity_attributes')
    .select('*')
    .eq('entity_id', entityId)
    .order('sort_order')
  if (error) throw error
  return data ?? []
}

async function coerceValuesForEntity(
  entityId: string,
  values: Record<string, unknown>,
  options?: { partial?: boolean },
): Promise<Record<string, unknown>> {
  const attrs = await loadEntityAttributes(entityId)
  return validateAndCoerceEntityValues(values, attrs, options)
}

export async function createStaticRecord(entityId: string, values: Record<string, unknown>, sortOrder = 0) {
  const coerced = await coerceValuesForEntity(entityId, values)
  await assertUniqueAttributeValues({ entityId, kind: 'static', values: coerced })
  const { data, error } = await supabase
    .from('entity_static_records')
    .insert({ entity_id: entityId, values: coerced as Json, sort_order: sortOrder })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateStaticRecord(id: string, values: Record<string, unknown>, entityId?: string) {
  let resolvedEntityId = entityId
  if (!resolvedEntityId) {
    const { data, error } = await supabase.from('entity_static_records').select('entity_id').eq('id', id).single()
    if (error) throw error
    resolvedEntityId = data.entity_id
  }
  const coerced = await coerceValuesForEntity(resolvedEntityId, values)
  await assertUniqueAttributeValues({
    entityId: resolvedEntityId,
    kind: 'static',
    values: coerced,
    excludeRecordId: id,
  })
  const { error } = await supabase.from('entity_static_records').update({ values: coerced as Json }).eq('id', id)
  if (error) throw error
}

export async function deleteStaticRecord(id: string) {
  const { error } = await supabase.from('entity_static_records').delete().eq('id', id)
  if (error) throw error
}

export async function listEntityRecords(entity: Pick<ChatbotEntity, 'id' | 'kind'>): Promise<EntityRecordView[]> {
  if (entity.kind === 'static') {
    const { data, error } = await supabase
      .from('entity_static_records')
      .select('*')
      .eq('entity_id', entity.id)
      .order('sort_order')
    if (error) throw error
    return (data ?? []).map((r) => ({
      id: r.id,
      values: asValues(r.values),
      sort_order: r.sort_order,
      created_at: r.created_at,
    }))
  }
  const { data, error } = await supabase
    .from('entity_dynamic_records')
    .select('*')
    .eq('entity_id', entity.id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    values: asValues(r.values),
    created_at: r.created_at,
    updated_at: r.updated_at,
  }))
}

export async function createDynamicRecord(entityId: string, values: Record<string, unknown>) {
  const coerced = await coerceValuesForEntity(entityId, values)
  await assertUniqueAttributeValues({ entityId, kind: 'dynamic', values: coerced })
  const { data, error } = await supabase
    .from('entity_dynamic_records')
    .insert({ entity_id: entityId, values: coerced as Json })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateDynamicRecord(
  id: string,
  values: Record<string, unknown>,
  options?: { entityId?: string; merge?: boolean },
) {
  const { data: existing, error: existingError } = await supabase
    .from('entity_dynamic_records')
    .select('entity_id, values')
    .eq('id', id)
    .single()
  if (existingError) throw existingError

  const entityId = options?.entityId ?? existing.entity_id
  const prev = asValues(existing.values)
  const coerced = await coerceValuesForEntity(entityId, values, { partial: options?.merge === true })
  const nextValues = options?.merge ? { ...prev, ...coerced } : coerced

  await assertUniqueAttributeValues({
    entityId,
    kind: 'dynamic',
    values: nextValues,
    excludeRecordId: id,
    keys: Object.keys(coerced),
  })

  const { data, error } = await supabase
    .from('entity_dynamic_records')
    .update({ values: nextValues as Json })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteDynamicRecord(id: string) {
  const { error } = await supabase.from('entity_dynamic_records').delete().eq('id', id)
  if (error) throw error
}

export function filterRecords(
  records: EntityRecordView[],
  attribute: string,
  equals: unknown,
): EntityRecordView[] {
  const attr = attribute.trim()
  if (!attr) return records
  const needle = equals == null ? '' : String(equals)
  return records.filter((r) => String(r.values[attr] ?? '') === needle)
}

export function toRecordPayload(row: EntityRecordView): Record<string, unknown> {
  return { id: row.id, ...row.values }
}

export function keyFromName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const withLetter = /^[A-Za-z]/.test(cleaned) ? cleaned : `E_${cleaned}`
  return withLetter.slice(0, 48) || 'Entity'
}
