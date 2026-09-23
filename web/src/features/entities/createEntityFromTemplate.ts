import { supabase } from '@/shared/lib/supabase'
import { createEntity, deleteEntity, keyFromName } from './entityApi'
import { ENTITY_TEMPLATES } from './entityTemplates'
import type { EntityKind } from '@/shared/types/database'

export async function createEntityFromTemplate(input: { chatbotId: string; name: string; kind: EntityKind; templateKey: string }) {
  const template = ENTITY_TEMPLATES.find(row => row.key === input.templateKey)
  if (!template) throw new Error('Choose a valid entity template.')
  const name = input.name.trim()
  if (!name) throw new Error('Name is required')
  const entity = await createEntity({ chatbotId: input.chatbotId, name, key: keyFromName(name), kind: input.kind, description: template.key === 'blank' ? undefined : template.description })
  if (!template.fields.length) return entity
  try {
    const { error } = await supabase.from('entity_attributes').insert(template.fields.map((field, index) => ({
      entity_id: entity.id, ...field, required: !!field.required, is_unique: !!field.is_unique,
      is_identifier: false, default_value: null, sort_order: index,
    })))
    if (error) throw error
    return entity
  } catch (error) {
    // Only undo the new entity created by this attempt; never touch existing entities.
    try { await deleteEntity(entity.id) } catch {
      throw new Error(`Template setup failed. The incomplete entity "${name}" remains; remove it before retrying.`)
    }
    throw error
  }
}
