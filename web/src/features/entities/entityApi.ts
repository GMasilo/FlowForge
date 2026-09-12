import { supabase } from '@/shared/lib/supabase'
import type {
  ChatbotEntity,
  ChatbotEntityLink,
  EntityAttribute,
  EntityKind,
  EntityStaticRecord,
  EntityVisibility,
  Json,
  VariableType,
} from '@/shared/types/database'
import { validateAndCoerceEntityValues } from '@/features/entities/entityValueValidation'
import {
  ENTITY_PRIMARY_KEY,
  ensurePrimaryKeyValue,
  entityPrimaryKeyAttribute,
  isEntityPrimaryKey,
} from '@/features/entities/entityPrimaryKey'
import { queryEntityRecords } from '@/features/entities/entityQuery'

export type EntityCrudFlags = {
  can_query: boolean
  can_create: boolean
  can_update: boolean
  can_delete: boolean
}

export type EntityWithMeta = ChatbotEntity & {
  attributes: EntityAttribute[]
  static_records?: EntityStaticRecord[]
  dynamic_count?: number
}

export type InstalledEntity = EntityWithMeta &
  EntityCrudFlags & {
    owned: boolean
    link_id?: string
  }

export type EntityRecordView = {
  id: string
  values: Record<string, unknown>
  sort_order?: number
  created_at?: string
  updated_at?: string
}

export type EntityLinkOp = 'query' | 'create' | 'update' | 'delete'

function asValues(raw: Json | null | undefined): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  return {}
}

async function hydrateEntities(entities: ChatbotEntity[]): Promise<EntityWithMeta[]> {
  if (!entities.length) return []
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

export async function fetchChatbotEntities(chatbotId: string): Promise<EntityWithMeta[]> {
  const { data: entities, error } = await supabase
    .from('chatbot_entities')
    .select('*')
    .eq('chatbot_id', chatbotId)
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return hydrateEntities(entities ?? [])
}

/** Owned + installed entities available to this chatbot (with CRUD flags). */
export async function fetchInstalledEntities(chatbotId: string): Promise<InstalledEntity[]> {
  const { data: links, error: linksError } = await supabase
    .from('chatbot_entity_links')
    .select('*')
    .eq('chatbot_id', chatbotId)
  if (linksError) throw linksError
  if (!links?.length) return []

  const entityIds = links.map((l) => l.entity_id)
  const { data: entities, error } = await supabase
    .from('chatbot_entities')
    .select('*')
    .in('id', entityIds)
    .is('deleted_at', null)
    .order('name')
  if (error) throw error

  const hydrated = await hydrateEntities(entities ?? [])
  const byId = new Map(hydrated.map((e) => [e.id, e]))
  const out: InstalledEntity[] = []
  for (const link of links) {
    const entity = byId.get(link.entity_id)
    if (!entity) continue
    out.push({
      ...entity,
      owned: entity.chatbot_id === chatbotId,
      link_id: link.id,
      can_query: link.can_query,
      can_create: link.can_create,
      can_update: link.can_update,
      can_delete: link.can_delete,
    })
  }
  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}

export async function entityLinkAllows(
  entityId: string,
  chatbotId: string,
  op: EntityLinkOp,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('entity_link_allows', {
    p_entity_id: entityId,
    p_chatbot_id: chatbotId,
    p_op: op,
  })
  if (error) throw error
  return !!data
}

export async function assertEntityLinkAllows(
  entityId: string,
  chatbotId: string,
  op: EntityLinkOp,
): Promise<void> {
  const ok = await entityLinkAllows(entityId, chatbotId, op)
  if (!ok) {
    throw new Error(`This chatbot cannot ${op} records on this entity`)
  }
}

export async function updateEntityVisibility(
  entityId: string,
  visibility: EntityVisibility,
): Promise<void> {
  const { error } = await supabase.from('chatbot_entities').update({ visibility }).eq('id', entityId)
  if (error) throw error
}

export async function setEntityShares(entityId: string, userIds: string[]): Promise<void> {
  const unique = [...new Set(userIds)]
  const { error: delError } = await supabase.from('entity_shares').delete().eq('entity_id', entityId)
  if (delError) throw delError
  if (!unique.length) return
  const { error } = await supabase
    .from('entity_shares')
    .insert(unique.map((user_id) => ({ entity_id: entityId, user_id })))
  if (error) throw error
}

export async function listEntityShares(entityId: string): Promise<string[]> {
  const { data, error } = await supabase.from('entity_shares').select('user_id').eq('entity_id', entityId)
  if (error) throw error
  return (data ?? []).map((r) => r.user_id)
}

export async function listEntityLinks(entityId: string): Promise<ChatbotEntityLink[]> {
  const { data, error } = await supabase
    .from('chatbot_entity_links')
    .select('*')
    .eq('entity_id', entityId)
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export async function installEntityOnChatbot(args: {
  chatbotId: string
  entityId: string
  addedBy?: string | null
  can_query?: boolean
  can_create?: boolean
  can_update?: boolean
  can_delete?: boolean
}): Promise<ChatbotEntityLink> {
  const { data, error } = await supabase
    .from('chatbot_entity_links')
    .upsert(
      {
        chatbot_id: args.chatbotId,
        entity_id: args.entityId,
        added_by: args.addedBy ?? null,
        can_query: args.can_query ?? true,
        can_create: args.can_create ?? false,
        can_update: args.can_update ?? false,
        can_delete: args.can_delete ?? false,
      },
      { onConflict: 'chatbot_id,entity_id' },
    )
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateEntityLinkFlags(
  linkId: string,
  flags: Partial<EntityCrudFlags>,
): Promise<void> {
  const { error } = await supabase.from('chatbot_entity_links').update(flags).eq('id', linkId)
  if (error) throw error
}

export async function uninstallEntityFromChatbot(args: {
  chatbotId: string
  entityId: string
}): Promise<void> {
  // Owning chatbot link is protected by RLS; this only removes non-owner installs.
  const { error } = await supabase
    .from('chatbot_entity_links')
    .delete()
    .eq('chatbot_id', args.chatbotId)
    .eq('entity_id', args.entityId)
  if (error) throw error
}

/** Installable catalog: global + shared-to-me entities in the instance (not already owned by this bot). */
export async function listInstallableEntities(args: {
  instanceId: string
  chatbotId: string
}): Promise<EntityWithMeta[]> {
  const { data: bots, error: botsError } = await supabase
    .from('chatbots')
    .select('id')
    .eq('instance_id', args.instanceId)
    .is('deleted_at', null)
  if (botsError) throw botsError
  const botIds = (bots ?? []).map((b) => b.id)
  if (!botIds.length) return []

  const { data: entities, error } = await supabase
    .from('chatbot_entities')
    .select('*')
    .in('chatbot_id', botIds)
    .neq('chatbot_id', args.chatbotId)
    .is('deleted_at', null)
    .in('visibility', ['global', 'shared'])
    .order('name')
  if (error) throw error

  const { data: links } = await supabase
    .from('chatbot_entity_links')
    .select('entity_id')
    .eq('chatbot_id', args.chatbotId)
  const installed = new Set((links ?? []).map((l) => l.entity_id))
  const candidates = (entities ?? []).filter((e) => !installed.has(e.id))
  return hydrateEntities(candidates)
}

export function entityVisibilityLabel(v: EntityVisibility): string {
  switch (v) {
    case 'private':
      return 'Private'
    case 'global':
      return 'Global (organisation)'
    case 'shared':
      return 'Shared'
  }
}

export function entityOpToLinkOp(operation: string): EntityLinkOp {
  switch (operation) {
    case 'create':
      return 'create'
    case 'update':
      return 'update'
    case 'delete':
      return 'delete'
    case 'list':
    case 'get':
    default:
      return 'query'
  }
}

export function entityAllowsOperation(flags: EntityCrudFlags, operation: string): boolean {
  const op = entityOpToLinkOp(operation)
  if (op === 'query') return flags.can_query
  if (op === 'create') return flags.can_create
  if (op === 'update') return flags.can_update
  return flags.can_delete
}

export async function createEntity(input: {
  chatbotId: string
  key: string
  name: string
  description?: string
  kind: EntityKind
  visibility?: EntityVisibility
}): Promise<ChatbotEntity> {
  const { data, error } = await supabase
    .from('chatbot_entities')
    .insert({
      chatbot_id: input.chatbotId,
      key: input.key.trim(),
      name: input.name.trim(),
      description: input.description?.trim() || null,
      kind: input.kind,
      visibility: input.visibility ?? 'private',
    })
    .select('*')
    .single()
  if (error) throw error
  await ensureEntityPrimaryKey(data.id)
  return data
}

/** Ensure the entity has a locked unique primary-key attribute `id`. */
export async function ensureEntityPrimaryKey(entityId: string): Promise<EntityAttribute> {
  const pk = entityPrimaryKeyAttribute(-1)
  const { data: existing, error: lookupError } = await supabase
    .from('entity_attributes')
    .select('*')
    .eq('entity_id', entityId)
    .eq('key', ENTITY_PRIMARY_KEY)
    .maybeSingle()
  if (lookupError) throw lookupError

  if (existing) {
    const { data, error } = await supabase
      .from('entity_attributes')
      .update({
        label: existing.label?.trim() || pk.label,
        value_type: pk.value_type,
        required: true,
        is_identifier: true,
        is_unique: true,
        sort_order: existing.sort_order <= 0 ? existing.sort_order : -1,
      })
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error) throw error
    await clearOtherIdentifiers(entityId)
    return data
  }

  const { data, error } = await supabase
    .from('entity_attributes')
    .insert({
      entity_id: entityId,
      key: pk.key,
      label: pk.label,
      value_type: pk.value_type,
      required: true,
      is_identifier: true,
      is_unique: true,
      sort_order: pk.sort_order,
    })
    .select('*')
    .single()
  if (error) throw error
  await clearOtherIdentifiers(entityId)
  return data
}

async function clearOtherIdentifiers(entityId: string): Promise<void> {
  const { error } = await supabase
    .from('entity_attributes')
    .update({ is_identifier: false })
    .eq('entity_id', entityId)
    .neq('key', ENTITY_PRIMARY_KEY)
    .eq('is_identifier', true)
  if (error) throw error
}

export async function updateEntity(
  id: string,
  patch: Partial<Pick<ChatbotEntity, 'name' | 'description' | 'key' | 'visibility'>>,
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
  const key = input.key.trim()
  if (!key) throw new Error('Attribute key is required')

  if (input.id) {
    const { data: current, error: currentError } = await supabase
      .from('entity_attributes')
      .select('key')
      .eq('id', input.id)
      .single()
    if (currentError) throw currentError
    if (isEntityPrimaryKey(current.key)) {
      if (!isEntityPrimaryKey(key)) throw new Error('Primary key attribute key must remain "id"')
      const { data, error } = await supabase
        .from('entity_attributes')
        .update({
          key: ENTITY_PRIMARY_KEY,
          label: input.label?.trim() || 'Id',
          value_type: 'string',
          required: true,
          is_identifier: true,
          is_unique: true,
          default_value: null,
          sort_order: input.sort_order ?? -1,
        })
        .eq('id', input.id)
        .select('*')
        .single()
      if (error) throw error
      await clearOtherIdentifiers(input.entityId)
      return data
    }
    if (isEntityPrimaryKey(key)) throw new Error('Primary key "id" already exists on this entity')
  } else if (isEntityPrimaryKey(key)) {
    return ensureEntityPrimaryKey(input.entityId)
  }

  const isIdentifier = !!input.is_identifier
  const patch = {
    key,
    label: input.label?.trim() || null,
    value_type: input.value_type,
    required: !!input.required,
    is_identifier: false,
    is_unique: !!input.is_unique,
    default_value: input.default_value ?? null,
    sort_order: input.sort_order ?? 0,
  }

  let targetId = input.id
  if (!targetId) {
    const { data: existing, error: lookupError } = await supabase
      .from('entity_attributes')
      .select('id')
      .eq('entity_id', input.entityId)
      .eq('key', key)
      .maybeSingle()
    if (lookupError) throw lookupError
    targetId = existing?.id
  }

  if (targetId) {
    const { data, error } = await supabase
      .from('entity_attributes')
      .update(patch)
      .eq('id', targetId)
      .select('*')
      .single()
    if (error) throw error
    if (isIdentifier) await ensureEntityPrimaryKey(input.entityId)
    return data
  }

  const { data, error } = await supabase
    .from('entity_attributes')
    .insert({
      entity_id: input.entityId,
      ...patch,
    })
    .select('*')
    .single()
  if (error) throw error
  if (isIdentifier) await ensureEntityPrimaryKey(input.entityId)
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
  const { data, error: lookupError } = await supabase
    .from('entity_attributes')
    .select('key')
    .eq('id', id)
    .single()
  if (lookupError) throw lookupError
  if (isEntityPrimaryKey(data.key)) throw new Error('Primary key "id" cannot be removed')
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
  options?: { partial?: boolean; previous?: Record<string, unknown> },
): Promise<Record<string, unknown>> {
  const attrs = await loadEntityAttributes(entityId)
  const coerced = validateAndCoerceEntityValues(values, attrs, options)
  const { applyPasswordHashesToValues } = await import('@/features/entities/entityPassword')
  return applyPasswordHashesToValues(coerced, attrs, options?.previous)
}

export async function createStaticRecord(entityId: string, values: Record<string, unknown>, sortOrder = 0) {
  await ensureEntityPrimaryKey(entityId)
  const withPk = ensurePrimaryKeyValue(values)
  const recordId = String(withPk[ENTITY_PRIMARY_KEY])
  const coerced = await coerceValuesForEntity(entityId, withPk)
  coerced[ENTITY_PRIMARY_KEY] = recordId
  await assertUniqueAttributeValues({ entityId, kind: 'static', values: coerced })
  const { data, error } = await supabase
    .from('entity_static_records')
    .insert({ id: recordId, entity_id: entityId, values: coerced as Json, sort_order: sortOrder })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateStaticRecord(id: string, values: Record<string, unknown>, entityId?: string) {
  let resolvedEntityId = entityId
  let previousValues: Record<string, unknown> = {}
  if (!resolvedEntityId) {
    const { data, error } = await supabase
      .from('entity_static_records')
      .select('entity_id, values')
      .eq('id', id)
      .single()
    if (error) throw error
    resolvedEntityId = data.entity_id
    previousValues = asValues(data.values)
  } else {
    const { data, error } = await supabase.from('entity_static_records').select('values').eq('id', id).single()
    if (error) throw error
    previousValues = asValues(data.values)
  }
  await ensureEntityPrimaryKey(resolvedEntityId)
  const lockedId = String(previousValues[ENTITY_PRIMARY_KEY] ?? id)
  if (
    values[ENTITY_PRIMARY_KEY] !== undefined &&
    !isBlankPk(values[ENTITY_PRIMARY_KEY]) &&
    String(values[ENTITY_PRIMARY_KEY]) !== lockedId
  ) {
    throw new Error('Primary key "id" cannot be changed')
  }
  const withPk = ensurePrimaryKeyValue(values, { existingId: lockedId })
  const coerced = await coerceValuesForEntity(resolvedEntityId, withPk, { previous: previousValues })
  coerced[ENTITY_PRIMARY_KEY] = lockedId
  await assertUniqueAttributeValues({
    entityId: resolvedEntityId,
    kind: 'static',
    values: coerced,
    excludeRecordId: id,
  })
  const { error } = await supabase.from('entity_static_records').update({ values: coerced as Json }).eq('id', id)
  if (error) throw error
}

function isBlankPk(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
}

export async function deleteStaticRecord(id: string) {
  const { error } = await supabase.from('entity_static_records').delete().eq('id', id)
  if (error) throw error
}

/** Replace all static catalog rows on flow import (fresh UUIDs avoid cross-chatbot id clashes). */
export async function replaceStaticRecordsFromImport(
  entityId: string,
  records: Array<Record<string, unknown>>,
) {
  await ensureEntityPrimaryKey(entityId)
  const { error: delError } = await supabase.from('entity_static_records').delete().eq('entity_id', entityId)
  if (delError) throw delError

  for (const [index, raw] of records.entries()) {
    const { [ENTITY_PRIMARY_KEY]: _drop, ...rest } = raw
    await createStaticRecord(entityId, rest, index)
  }
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
  await ensureEntityPrimaryKey(entityId)
  const withPk = ensurePrimaryKeyValue(values)
  const recordId = String(withPk[ENTITY_PRIMARY_KEY])
  const coerced = await coerceValuesForEntity(entityId, withPk)
  coerced[ENTITY_PRIMARY_KEY] = recordId
  await assertUniqueAttributeValues({ entityId, kind: 'dynamic', values: coerced })
  const { data, error } = await supabase
    .from('entity_dynamic_records')
    .insert({ id: recordId, entity_id: entityId, values: coerced as Json })
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) {
    throw new Error(
      'Entity create did not return a row (often blocked by RLS for anonymous chat). Use a public chat session RPC or sign in as an editor.',
    )
  }
  return data
}

/** Public/anon chat entity ops (security definer; requires active conversation session). */
export async function publicChatEntityOp(args: {
  sessionId: string
  chatbotId: string
  entityId: string
  operation: string
  values?: Record<string, unknown>
  recordId?: string
}): Promise<{
  ok: boolean
  entity?: { id: string; key: string; kind: EntityKind }
  record?: Record<string, unknown> | null
  records?: Array<{ id: string; values: Record<string, unknown> }>
  count?: number
  found?: boolean
  deleted?: boolean
  id?: string
}> {
  const { data, error } = await supabase.rpc('public_chat_entity_op', {
    p_session_id: args.sessionId,
    p_chatbot_id: args.chatbotId,
    p_entity_id: args.entityId,
    p_operation: args.operation,
    p_payload: {
      values: args.values ?? {},
      ...(args.recordId ? { recordId: args.recordId } : {}),
    } as Json,
  })
  if (error) throw error
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Entity operation returned an invalid response')
  }
  return data as {
    ok: boolean
    entity?: { id: string; key: string; kind: EntityKind }
    record?: Record<string, unknown> | null
    records?: Array<{ id: string; values: Record<string, unknown> }>
    count?: number
    found?: boolean
    deleted?: boolean
    id?: string
  }
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
  await ensureEntityPrimaryKey(entityId)
  const prev = asValues(existing.values)
  const lockedId = String(prev[ENTITY_PRIMARY_KEY] ?? id)
  if (
    values[ENTITY_PRIMARY_KEY] !== undefined &&
    !isBlankPk(values[ENTITY_PRIMARY_KEY]) &&
    String(values[ENTITY_PRIMARY_KEY]) !== lockedId
  ) {
    throw new Error('Primary key "id" cannot be changed')
  }
  const withPk = ensurePrimaryKeyValue(values, { existingId: lockedId })
  const coerced = await coerceValuesForEntity(entityId, withPk, {
    partial: options?.merge === true,
    previous: prev,
  })
  const nextValues = options?.merge ? { ...prev, ...coerced } : coerced
  nextValues[ENTITY_PRIMARY_KEY] = lockedId

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
  return queryEntityRecords(
    records,
    {
      logic: 'and',
      clauses: [{ attribute, operator: 'eq', value: equals == null ? '' : String(equals) }],
    },
    () => equals,
  )
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
