import { assertEntityLinkAllows, listEntityRecords, publicChatEntityOp, toRecordPayload } from './entityApi'
import { supabase } from '@/shared/lib/supabase'
import { entityConfigSchema } from '@/features/designer/model/flowSchema'
import { joinEntityRows, selectEntityColumns } from './entityJoins'

export async function entityQueryOutput(outputs: Record<string, unknown>, raw: Record<string, unknown>, chatbotId: string, sessionId?: string) {
  const config = {
    operation: String(raw.operation ?? 'list'), joins: entityConfigSchema.shape.joins.parse(raw.joins),
    columnMode: entityConfigSchema.shape.columnMode.parse(raw.columnMode), selectedColumns: entityConfigSchema.shape.selectedColumns.parse(raw.selectedColumns),
  }
  if (!['list', 'get'].includes(config.operation) || (!config.joins.length && config.columnMode === 'all')) return outputs
  const base = config.operation === 'list' ? outputs.records as Record<string, unknown>[] : outputs.record ? [outputs.record as Record<string, unknown>] : []
  let rows = await joinEntityRows(base, config.joins, async entityId => {
    if (sessionId) {
      // The existing RPC enforces installation and query grants for every joined entity.
      const result = await publicChatEntityOp({ sessionId, chatbotId, entityId, operation: 'list' })
      return (result.records ?? []).map(raw => {
        const row = raw as Record<string, unknown>
        return row.values && typeof row.values === 'object' && !Array.isArray(row.values)
          ? { id: row.id, ...row.values as Record<string, unknown> } : row
      })
    }
    await assertEntityLinkAllows(entityId, chatbotId, 'query')
    const { data, error } = await supabase.from('chatbot_entities').select('id,kind').eq('id', entityId).is('deleted_at', null).single()
    if (error) throw error
    return (await listEntityRecords(data)).map(toRecordPayload)
  })
  if (config.columnMode === 'selected') rows = selectEntityColumns(rows, config.selectedColumns)
  return config.operation === 'list' ? { records: rows, count: rows.length } : { record: rows[0] ?? null, found: rows.length > 0 }
}
