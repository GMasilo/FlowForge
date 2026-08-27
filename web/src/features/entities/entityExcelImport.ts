import type { EntityKind } from '@/shared/types/database'
import {
  createDynamicRecord,
  createEntity,
  createStaticRecord,
  keyFromName,
  upsertAttribute,
} from '@/features/entities/entityApi'
import { cellToEntityValue, type EntityExcelColumn } from '@/features/entities/entityExcel'
import {
  ENTITY_PRIMARY_KEY,
  ensurePrimaryKeyColumn,
  ensurePrimaryKeyValue,
  isEntityPrimaryKey,
} from '@/features/entities/entityPrimaryKey'

/** Create a new entity + attributes + records from a parsed spreadsheet. */
export async function importEntityFromExcel(input: {
  chatbotId: string
  name: string
  kind: EntityKind
  columns: EntityExcelColumn[]
  rows: Record<string, string>[]
}): Promise<{ entityId: string; recordCount: number }> {
  const name = input.name.trim()
  if (!name) throw new Error('Name is required')
  if (!input.columns.length) throw new Error('Spreadsheet has no columns')

  const columns = ensurePrimaryKeyColumn(input.columns)
  const entity = await createEntity({
    chatbotId: input.chatbotId,
    name,
    key: keyFromName(name),
    kind: input.kind,
  })

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]!
    if (isEntityPrimaryKey(col.key)) continue
    await upsertAttribute({
      entityId: entity.id,
      key: col.key,
      label: col.label || col.key,
      value_type: col.value_type,
      sort_order: i,
    })
  }

  let recordCount = 0
  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i]!
    const values: Record<string, unknown> = {}
    for (const col of columns) {
      const raw = row[col.key] ?? ''
      try {
        const value = cellToEntityValue(raw, col.value_type)
        if (value !== undefined) values[col.key] = value
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'invalid value'
        throw new Error(`Row ${i + 1}, ${col.key}: ${msg}`)
      }
    }
    const withPk = ensurePrimaryKeyValue(values)
    if (!Object.keys(withPk).some((k) => k !== ENTITY_PRIMARY_KEY)) continue
    if (input.kind === 'static') await createStaticRecord(entity.id, withPk, recordCount)
    else await createDynamicRecord(entity.id, withPk)
    recordCount++
  }

  return { entityId: entity.id, recordCount }
}
