import { Plus, Trash2 } from 'lucide-react'
import type { InstalledEntity } from '@/features/entities/entityApi'
import type { EntityJoin } from '@/features/entities/entityJoins'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Select } from '@/shared/ui/select'
import { Label } from '@/shared/ui/label'

export function EntityJoinFields({ config, entities, onChange, readOnly }: { config: Record<string, unknown>; entities: InstalledEntity[]; onChange: (patch: Record<string, unknown>) => void; readOnly?: boolean }) {
  const joins = (config.joins ?? []) as EntityJoin[]
  const base = entities.find(entity => entity.id === config.entityId)
  const selected = (config.selectedColumns ?? []) as string[]
  const patchJoin = (index: number, patch: Partial<EntityJoin>) => onChange({ joins: joins.map((join, i) => i === index ? { ...join, ...patch } : join), selectedColumns: [], columnMode: 'all' })
  const columns = [
    ...(base?.attributes ?? []).map(field => ({ key: field.key, label: `${base?.name}: ${field.label || field.key}` })),
    ...joins.flatMap(join => (entities.find(entity => entity.id === join.entityId)?.attributes ?? []).map(field => ({ key: `${join.alias}.${field.key}`, label: `${join.alias || 'Join'}: ${field.label || field.key}` }))),
  ]
  return <div className="space-y-4">
    <div className="space-y-3">
      <Label>Join entities</Label>
      <p className="text-xs text-[var(--color-ink-muted)]">Match a column on the main entity to another entity. Left joins keep unmatched records; inner joins only return matches. Multiple matches produce multiple rows. Joined fields appear under their alias. Filters apply to the main entity.</p>
      {joins.map((join, index) => <div key={index} className="space-y-2 rounded-xl border border-[var(--color-border)] p-3">
        <Select aria-label={`Join ${index + 1} entity`} disabled={readOnly} value={join.entityId} onChange={event => patchJoin(index, { entityId: event.target.value, foreignColumn: '' })}>
          <option value="">Select entity</option>
          {entities.filter(entity => entity.can_query).map(entity => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
        </Select>
        <Input aria-label={`Join ${index + 1} alias`} disabled={readOnly} value={join.alias} placeholder="Alias, e.g. customer" onChange={event => patchJoin(index, { alias: event.target.value })} />
        <Select aria-label={`Join ${index + 1} type`} disabled={readOnly} value={join.kind} onChange={event => patchJoin(index, { kind: event.target.value as EntityJoin['kind'] })}>
          <option value="left">Left join — keep all main records</option><option value="inner">Inner join — matching records only</option>
        </Select>
        <Select aria-label={`Join ${index + 1} main column`} disabled={readOnly} value={join.localColumn} onChange={event => patchJoin(index, { localColumn: event.target.value })}>
          <option value="">Main entity column</option>{base?.attributes.map(field => <option key={field.key} value={field.key}>{field.label || field.key}</option>)}
        </Select>
        <Select aria-label={`Join ${index + 1} matching column`} disabled={readOnly} value={join.foreignColumn} onChange={event => patchJoin(index, { foreignColumn: event.target.value })}>
          <option value="">Joined entity column</option>{entities.find(entity => entity.id === join.entityId)?.attributes.map(field => <option key={field.key} value={field.key}>{field.label || field.key}</option>)}
        </Select>
        <Button variant="ghost" size="sm" disabled={readOnly} onClick={() => onChange({ joins: joins.filter((_, i) => i !== index), selectedColumns: [], columnMode: 'all' })}><Trash2 className="h-4 w-4" />Remove join</Button>
      </div>)}
      <Button variant="secondary" size="sm" disabled={readOnly || !base} onClick={() => {
        let index = joins.length + 1
        while (joins.some(join => join.alias === `joined_${index}`)) index++
        onChange({ joins: [...joins, { entityId: '', alias: `joined_${index}`, kind: 'left', localColumn: '', foreignColumn: '' }] })
      }}><Plus className="h-4 w-4" />Add join</Button>
    </div>
    <div className="space-y-2">
      <Label>Output columns</Label>
      <Select aria-label="Output columns" disabled={readOnly} value={String(config.columnMode ?? 'all')} onChange={event => onChange({ columnMode: event.target.value, selectedColumns: [] })}>
        <option value="all">All columns</option><option value="selected">Choose columns</option>
      </Select>
      {config.columnMode === 'selected' ? <div className="max-h-64 space-y-2 overflow-auto">
        {columns.map(column => <label key={column.key} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={readOnly} checked={selected.includes(column.key)} onChange={event => onChange({ selectedColumns: event.target.checked ? [...selected, column.key] : selected.filter(key => key !== column.key) })} />{column.label}<span className="text-xs text-[var(--color-ink-muted)]">{column.key}</span></label>)}
        {!selected.length ? <p className="text-xs text-[var(--color-danger)]">Choose at least one column.</p> : null}
      </div> : null}
    </div>
  </div>
}
