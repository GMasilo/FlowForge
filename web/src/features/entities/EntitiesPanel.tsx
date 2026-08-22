import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Database, Download, FileSpreadsheet, Plus, Trash2 } from 'lucide-react'
import {
  createDynamicRecord,
  createEntity,
  createStaticRecord,
  deleteAttribute,
  deleteDynamicRecord,
  deleteEntity,
  deleteStaticRecord,
  ensureEntityPrimaryKey,
  fetchChatbotEntities,
  keyFromName,
  listEntityRecords,
  updateDynamicRecord,
  updateStaticRecord,
  upsertAttribute,
  type EntityRecordView,
  type EntityWithMeta,
} from '@/features/entities/entityApi'
import {
  downloadEntityRecordsExcel,
  pickEntitySpreadsheetFile,
  type EntityExcelColumn,
  type EntityExcelParseResult,
} from '@/features/entities/entityExcel'
import { importEntityFromExcel } from '@/features/entities/entityExcelImport'
import { ENTITY_PRIMARY_KEY, ensurePrimaryKeyColumn, isEntityPrimaryKey } from '@/features/entities/entityPrimaryKey'
import { EntityFilterBuilder } from '@/features/entities/EntityFilterBuilder'
import { emptyEntityQuerySpec, queryEntityRecords, type EntityQuerySpec } from '@/features/entities/entityQuery'
import type { EntityAttribute, EntityKind, VariableType } from '@/shared/types/database'
import { coerceEntityValue, isBlankEntityValue } from '@/features/entities/entityValueValidation'
import { canEdit } from '@/shared/types/database'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { Button } from '@/shared/ui/button'
import { CollapsibleSection } from '@/shared/ui/collapsible-section'
import { DateTimePicker } from '@/shared/ui/date-time-picker'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import { FieldError } from '@/shared/ui/field-error'
import { Badge } from '@/shared/ui/badge'
import { cn } from '@/shared/lib/utils'

const ATTR_TYPES: VariableType[] = ['string', 'number', 'boolean', 'date', 'array', 'object']

export function EntitiesPanel({ chatbotId }: { chatbotId: string }) {
  const { role } = useRequiredInstance()
  const editable = canEdit(role)
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [importDraft, setImportDraft] = useState<EntityExcelParseResult | null>(null)
  const [importName, setImportName] = useState('')
  const [importKind, setImportKind] = useState<EntityKind>('static')
  const [importColumns, setImportColumns] = useState<EntityExcelColumn[]>([])
  const [sectionOpen, setSectionOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState<EntityKind>('dynamic')

  const entities = useQuery({
    queryKey: ['chatbot-entities', chatbotId],
    queryFn: () => fetchChatbotEntities(chatbotId),
  })

  const selected = useMemo(
    () => entities.data?.find((e) => e.id === selectedId) ?? entities.data?.[0] ?? null,
    [entities.data, selectedId],
  )

  const create = useMutation({
    mutationFn: async () => {
      const name = newName.trim()
      if (!name) throw new Error('Name is required')
      return createEntity({
        chatbotId,
        name,
        key: keyFromName(name),
        kind: newKind,
      })
    },
    onSuccess: async (row) => {
      setCreating(false)
      setNewName('')
      setError(null)
      await qc.invalidateQueries({ queryKey: ['chatbot-entities', chatbotId] })
      setSelectedId(row.id)
    },
    onError: (e: Error) => setError(e.message),
  })

  const importEntity = useMutation({
    mutationFn: async () => {
      if (!importDraft) throw new Error('No spreadsheet loaded')
      return importEntityFromExcel({
        chatbotId,
        name: importName,
        kind: importKind,
        columns: importColumns,
        rows: importDraft.rows,
      })
    },
    onSuccess: async (result) => {
      setImportDraft(null)
      setImportColumns([])
      setImportName('')
      setError(null)
      await qc.invalidateQueries({ queryKey: ['chatbot-entities', chatbotId] })
      setSelectedId(result.entityId)
      setSectionOpen(true)
    },
    onError: (e: Error) => setError(e.message),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!window.confirm('Delete this entity and all of its attributes and records?')) return
      await deleteEntity(id)
    },
    onSuccess: async () => {
      setSelectedId(null)
      await qc.invalidateQueries({ queryKey: ['chatbot-entities', chatbotId] })
    },
    onError: (e: Error) => setError(e.message),
  })

  async function startImport() {
    setError(null)
    setCreating(false)
    try {
      const { parsed } = await pickEntitySpreadsheetFile()
      setImportDraft(parsed)
      setImportName(parsed.suggestedName)
      setImportColumns(ensurePrimaryKeyColumn(parsed.columns.map((c) => ({ ...c }))))
      setImportKind('static')
      setSectionOpen(true)
    } catch (e) {
      if (e instanceof Error && e.message === 'No file selected') return
      setError(e instanceof Error ? e.message : 'Could not read spreadsheet')
    }
  }

  return (
    <CollapsibleSection
      open={sectionOpen}
      onOpenChange={setSectionOpen}
      title={
        <span className="flex items-center gap-2">
          <Database className="h-4 w-4 text-[var(--color-accent)]" />
          Entities
        </span>
      }
      description="Design static catalogs or dynamic tables. Edit attributes and record values in the tables. Use Entity steps in the flow to read/write them."
      badge={
        entities.data?.length ? (
          <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-ink-muted)]">
            {entities.data.length}
          </span>
        ) : null
      }
      actions={
        editable ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setSectionOpen(true)
                void startImport()
              }}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Import Excel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setSectionOpen(true)
                setImportDraft(null)
                setCreating((v) => !v)
              }}
            >
              <Plus className="h-4 w-4" />
              New entity
            </Button>
          </div>
        ) : null
      }
    >
      {error ? <FieldError>{error}</FieldError> : null}

      {creating ? (
        <div className="grid gap-3 rounded-xl border border-[var(--color-accent)]/25 bg-[var(--color-accent-soft)]/40 p-3 sm:grid-cols-[1fr_160px_auto]">
          <div>
            <Label>Name</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Customer" />
          </div>
          <div>
            <Label>Kind</Label>
            <Select value={newKind} onChange={(e) => setNewKind(e.target.value as EntityKind)}>
              <option value="dynamic">Dynamic (store user data)</option>
              <option value="static">Static (design-time catalog)</option>
            </Select>
          </div>
          <div className="flex items-end">
            <Button disabled={create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </div>
      ) : null}

      {importDraft ? (
        <div className="space-y-3 rounded-xl border border-[var(--color-accent)]/25 bg-[var(--color-accent-soft)]/40 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-ink)]">Import entity from Excel</h4>
              <p className="text-xs text-[var(--color-ink-muted)]">
                {importDraft.rows.length} row{importDraft.rows.length === 1 ? '' : 's'} · {importColumns.length}{' '}
                column{importColumns.length === 1 ? '' : 's'}. First row is headers; an optional second row of types
                (string, number, …) is used when present.
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setImportDraft(null)
                setImportColumns([])
              }}
            >
              Cancel
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <div>
              <Label>Name</Label>
              <Input value={importName} onChange={(e) => setImportName(e.target.value)} placeholder="Products" />
            </div>
            <div>
              <Label>Kind</Label>
              <Select value={importKind} onChange={(e) => setImportKind(e.target.value as EntityKind)}>
                <option value="static">Static (design-time catalog)</option>
                <option value="dynamic">Dynamic (store user data)</option>
              </Select>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-[var(--color-surface-2)] text-[11px] uppercase tracking-wide text-[var(--color-ink-muted)]">
                <tr>
                  <th className="px-2 py-2 font-semibold">Column</th>
                  <th className="px-2 py-2 font-semibold">Key</th>
                  <th className="px-2 py-2 font-semibold">Type</th>
                </tr>
              </thead>
              <tbody>
                {importColumns.map((col, index) => {
                  const primaryKey = col.key === 'id'
                  return (
                  <tr key={`${col.key}-${index}`} className="border-t border-[var(--color-border)]/60">
                    <td className="px-2 py-1.5 text-[var(--color-ink)]">
                      {col.label}
                      {primaryKey ? ' (PK)' : ''}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-xs text-[var(--color-ink-muted)]">{col.key}</td>
                    <td className="px-2 py-1.5">
                      <Select
                        className="h-8"
                        disabled={primaryKey}
                        value={col.value_type}
                        onChange={(e) => {
                          const value_type = e.target.value as VariableType
                          setImportColumns((cols) =>
                            cols.map((c, i) => (i === index ? { ...c, value_type } : c)),
                          )
                        }}
                      >
                        {ATTR_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <Button disabled={importEntity.isPending || !importColumns.length} onClick={() => importEntity.mutate()}>
              {importEntity.isPending
                ? 'Importing…'
                : `Create entity (${importDraft.rows.length} record${importDraft.rows.length === 1 ? '' : 's'})`}
            </Button>
          </div>
        </div>
      ) : null}

      {entities.isLoading ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Loading entities…</p>
      ) : !entities.data?.length ? (
        <p className="text-sm text-[var(--color-ink-muted)]">No entities yet. Create one to model structured data.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <ul className="space-y-1">
            {entities.data.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(e.id)}
                  className={cn(
                    'flex w-full flex-col rounded-xl px-3 py-2 text-left transition',
                    selected?.id === e.id ? 'bg-[var(--color-accent-soft)] ring-1 ring-[var(--color-accent)]/25' : 'hover:bg-[var(--color-surface-2)]',
                  )}
                >
                  <span className="text-sm font-semibold text-[var(--color-ink)]">{e.name}</span>
                  <span className="font-mono text-[10px] text-[var(--color-ink-muted)]">{e.key}</span>
                  <span className="mt-1">
                    <Badge>{e.kind}</Badge>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {selected ? (
            <EntityEditor
              key={selected.id}
              entity={selected}
              editable={editable}
              chatbotId={chatbotId}
              onDeleted={() => remove.mutate(selected.id)}
            />
          ) : null}
        </div>
      )}
    </CollapsibleSection>
  )
}

function EntityEditor({
  entity,
  editable,
  chatbotId,
  onDeleted,
}: {
  entity: EntityWithMeta
  editable: boolean
  chatbotId: string
  onDeleted: () => void
}) {
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const records = useQuery({
    queryKey: ['entity-records', entity.id, entity.kind],
    queryFn: () => listEntityRecords(entity),
  })

  useEffect(() => {
    const pk = entity.attributes.find((a) => isEntityPrimaryKey(a.key))
    if (pk?.required && pk.is_unique && pk.is_identifier && pk.value_type === 'string') return
    void ensureEntityPrimaryKey(entity.id)
      .then(() => qc.invalidateQueries({ queryKey: ['chatbot-entities', chatbotId] }))
      .catch(() => {
        /* migration / race — create paths also ensure */
      })
  }, [entity.id, entity.attributes, chatbotId, qc])

  async function refreshAll() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['chatbot-entities', chatbotId] }),
      qc.invalidateQueries({ queryKey: ['entity-records', entity.id] }),
    ])
  }

  return (
    <div className="min-w-0 space-y-5 rounded-xl border border-[var(--color-border)]/90 bg-[var(--color-surface)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-[var(--color-ink)]">{entity.name}</h3>
          <p className="text-xs text-[var(--color-ink-muted)]">
            <span className="font-mono">{entity.key}</span> · {entity.kind}
            {entity.kind === 'dynamic' ? ` · ${records.data?.length ?? entity.dynamic_count ?? 0} records` : null}
          </p>
        </div>
        {editable ? (
          <Button size="sm" variant="danger" onClick={onDeleted}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete entity
          </Button>
        ) : null}
      </div>

      {error ? <FieldError>{error}</FieldError> : null}

      <AttributesTable
        entity={entity}
        editable={editable}
        onError={setError}
        onChanged={() => void refreshAll()}
      />

      <RecordsTable
        entity={entity}
        records={records.data ?? []}
        loading={records.isLoading}
        editable={editable}
        onError={setError}
        onChanged={() => void refreshAll()}
      />
    </div>
  )
}

function AttributesTable({
  entity,
  editable,
  onError,
  onChanged,
}: {
  entity: EntityWithMeta
  editable: boolean
  onError: (msg: string | null) => void
  onChanged: () => void
}) {
  const [rows, setRows] = useState(() => entity.attributes.map(cloneAttr))
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    setRows(entity.attributes.map(cloneAttr))
  }, [entity.attributes])

  async function saveAttr(row: EntityAttribute) {
    const key = row.key.trim()
    if (!key) {
      onError('Attribute key is required')
      return
    }
    setSavingId(row.id)
    onError(null)
    try {
      await upsertAttribute({
        id: row.id,
        entityId: entity.id,
        key,
        label: (row.label ?? key).trim() || key,
        value_type: row.value_type,
        required: row.required,
        is_identifier: row.is_identifier,
        is_unique: row.is_unique,
        default_value: row.default_value,
        sort_order: row.sort_order,
      })
      onChanged()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not save attribute')
    } finally {
      setSavingId(null)
    }
  }

  async function addAttr() {
    onError(null)
    try {
      const base = `Field${entity.attributes.length + 1}`
      await upsertAttribute({
        entityId: entity.id,
        key: base,
        label: base,
        value_type: 'string',
        sort_order: entity.attributes.length,
      })
      onChanged()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not add attribute')
    }
  }

  async function removeAttr(id: string) {
    if (!window.confirm('Remove this attribute? Existing record values for it will remain in JSON until cleaned up.')) {
      return
    }
    onError(null)
    try {
      await deleteAttribute(id)
      onChanged()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not remove attribute')
    }
  }

  return (
    <CollapsibleSection
      nested
      asCard={false}
      defaultOpen={false}
      title="Attributes"
      badge={
        <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-ink-muted)]">
          {rows.length}
        </span>
      }
      actions={
        editable ? (
          <Button size="sm" variant="secondary" onClick={() => void addAttr()}>
            <Plus className="h-3.5 w-3.5" />
            Add attribute
          </Button>
        ) : null
      }
    >
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-[var(--color-surface-2)] text-[11px] uppercase tracking-wide text-[var(--color-ink-muted)]">
            <tr>
              <th className="px-2 py-2 font-semibold">Key</th>
              <th className="px-2 py-2 font-semibold">Label</th>
              <th className="px-2 py-2 font-semibold">Type</th>
              <th className="px-2 py-2 font-semibold">Required</th>
              <th className="px-2 py-2 font-semibold">Unique</th>
              <th className="px-2 py-2 font-semibold">Id</th>
              {editable ? <th className="px-2 py-2 font-semibold" /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const primaryKey = isEntityPrimaryKey(row.key)
              return (
              <tr key={row.id} className="border-t border-[var(--color-border)]/60">
                <td className="px-2 py-1.5">
                  <Input
                    className="h-8 font-mono text-xs"
                    disabled={!editable || savingId === row.id || primaryKey}
                    value={row.key}
                    onChange={(e) =>
                      setRows((list) => list.map((r) => (r.id === row.id ? { ...r, key: e.target.value } : r)))
                    }
                    onBlur={() => void saveAttr(rows.find((r) => r.id === row.id) ?? row)}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    className="h-8 text-xs"
                    disabled={!editable || savingId === row.id}
                    value={row.label ?? ''}
                    onChange={(e) =>
                      setRows((list) =>
                        list.map((r) => (r.id === row.id ? { ...r, label: e.target.value } : r)),
                      )
                    }
                    onBlur={() => void saveAttr(rows.find((r) => r.id === row.id) ?? row)}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Select
                    className="h-8 text-xs"
                    disabled={!editable || savingId === row.id || primaryKey}
                    value={row.value_type}
                    onChange={(e) => {
                      const next = { ...row, value_type: e.target.value as VariableType }
                      setRows((list) => list.map((r) => (r.id === row.id ? next : r)))
                      void saveAttr(next)
                    }}
                  >
                    {ATTR_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-2 py-1.5 text-center">
                  <input
                    type="checkbox"
                    disabled={!editable || savingId === row.id || primaryKey}
                    checked={row.required}
                    onChange={(e) => {
                      const next = { ...row, required: e.target.checked }
                      setRows((list) => list.map((r) => (r.id === row.id ? next : r)))
                      void saveAttr(next)
                    }}
                  />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <input
                    type="checkbox"
                    disabled={!editable || savingId === row.id || primaryKey}
                    checked={row.is_unique}
                    onChange={(e) => {
                      const next = { ...row, is_unique: e.target.checked }
                      setRows((list) => list.map((r) => (r.id === row.id ? next : r)))
                      void saveAttr(next)
                    }}
                  />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <input
                    type="checkbox"
                    disabled
                    checked={primaryKey || row.is_identifier}
                    title={primaryKey ? 'Primary key' : 'Only id is the primary key'}
                  />
                </td>
                {editable ? (
                  <td className="px-2 py-1.5 text-right">
                    {primaryKey ? (
                      <span className="text-[11px] text-[var(--color-ink-muted)]">Primary key</span>
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-[var(--color-danger)] hover:underline"
                        onClick={() => void removeAttr(row.id)}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                ) : null}
              </tr>
              )
            })}
            {!rows.length ? (
              <tr>
                <td colSpan={editable ? 7 : 6} className="px-3 py-4 text-sm text-[var(--color-ink-muted)]">
                  No attributes yet — add columns for this entity.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </CollapsibleSection>
  )
}

function RecordsTable({
  entity,
  records,
  loading,
  editable,
  onError,
  onChanged,
}: {
  entity: EntityWithMeta
  records: EntityRecordView[]
  loading: boolean
  editable: boolean
  onError: (msg: string | null) => void
  onChanged: () => void
}) {
  const attrs = entity.attributes
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({})
  const [newRow, setNewRow] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [browseQuery, setBrowseQuery] = useState<EntityQuerySpec>(() => emptyEntityQuerySpec())

  const visibleRecords = useMemo(
    () => queryEntityRecords(records, browseQuery),
    [records, browseQuery],
  )

  useEffect(() => {
    const next: Record<string, Record<string, string>> = {}
    for (const r of records) {
      next[r.id] = {}
      for (const a of attrs) {
        next[r.id]![a.key] = valueToCell(r.values[a.key])
      }
    }
    setDrafts(next)
  }, [records, attrs])

  async function saveCell(recordId: string, attrKey: string, raw: string, valueType: VariableType) {
    if (isEntityPrimaryKey(attrKey)) return
    const record = records.find((r) => r.id === recordId)
    if (!record) return
    const values = { ...record.values, [attrKey]: coerceAttr(raw, valueType) }
    if (isBlankEntityValue(raw) && !attrs.find((a) => a.key === attrKey)?.required) {
      delete values[attrKey]
    }
    values[ENTITY_PRIMARY_KEY] = record.values[ENTITY_PRIMARY_KEY] ?? recordId
    setSavingId(recordId)
    onError(null)
    try {
      if (entity.kind === 'static') await updateStaticRecord(recordId, values)
      else await updateDynamicRecord(recordId, values)
      onChanged()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not save value')
    } finally {
      setSavingId(null)
    }
  }

  async function addRecord() {
    onError(null)
    try {
      const values: Record<string, unknown> = {}
      for (const a of attrs) {
        if (isEntityPrimaryKey(a.key)) continue
        const raw = newRow[a.key] ?? ''
        if (raw === '' && !a.required) continue
        if (raw === '' && a.required) throw new Error(`${a.label || a.key} is required`)
        const coerced = coerceAttr(raw, a.value_type)
        if (coerced === undefined) {
          if (a.required) throw new Error(`${a.label || a.key} is required`)
          continue
        }
        values[a.key] = coerced
      }
      if (entity.kind === 'static') await createStaticRecord(entity.id, values, records.length)
      else await createDynamicRecord(entity.id, values)
      setNewRow({})
      onChanged()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not add record')
    }
  }

  async function removeRecord(id: string) {
    if (!window.confirm('Delete this record?')) return
    onError(null)
    try {
      if (entity.kind === 'static') await deleteStaticRecord(id)
      else await deleteDynamicRecord(id)
      onChanged()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not delete record')
    }
  }

  if (!attrs.length) {
    return (
      <CollapsibleSection
        nested
        asCard={false}
        defaultOpen={false}
        title={entity.kind === 'static' ? 'Records' : 'Stored records'}
      >
        <p className="text-sm text-[var(--color-ink-muted)]">Add attributes first, then enter values in the table.</p>
      </CollapsibleSection>
    )
  }

  return (
    <CollapsibleSection
      nested
      asCard={false}
      defaultOpen={false}
      title={entity.kind === 'static' ? 'Records' : 'Stored records'}
      badge={
        <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-ink-muted)]">
          {browseQuery.filters.some((f) => f.attribute.trim()) || browseQuery.limit || browseQuery.sortAttribute
            ? `${visibleRecords.length}/${records.length}`
            : records.length}
        </span>
      }
      actions={
        <Button
          size="sm"
          variant="secondary"
          disabled={!attrs.length}
          onClick={() => {
            onError(null)
            try {
              downloadEntityRecordsExcel({
                entityKey: entity.key,
                entityName: entity.name,
                attributes: attrs,
                records: visibleRecords,
              })
            } catch (e) {
              onError(e instanceof Error ? e.message : 'Could not export Excel')
            }
          }}
        >
          <Download className="h-3.5 w-3.5" />
          Export Excel
        </Button>
      }
    >
      {loading ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Loading…</p>
      ) : (
        <div className="space-y-3">
          <EntityFilterBuilder
            title="Browse / query"
            mode="browse"
            attributes={attrs}
            query={browseQuery}
            onChange={setBrowseQuery}
          />
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-[var(--color-surface-2)] text-[11px] uppercase tracking-wide text-[var(--color-ink-muted)]">
              <tr>
                {attrs.map((a) => (
                  <th key={a.id} className="px-2 py-2 font-semibold">
                    {a.label || a.key}
                    {isEntityPrimaryKey(a.key) ? ' (PK)' : ''}
                    {a.required ? ' *' : ''}
                    {a.is_unique && !isEntityPrimaryKey(a.key) ? ' ‡' : ''}
                  </th>
                ))}
                {editable ? <th className="px-2 py-2 font-semibold" /> : null}
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((r) => (
                <tr key={r.id} className="border-t border-[var(--color-border)]/60">
                  {attrs.map((a) => {
                    const primaryKey = isEntityPrimaryKey(a.key)
                    const display = drafts[r.id]?.[a.key] ?? (primaryKey ? r.id : '')
                    return (
                    <td key={a.id} className="px-2 py-1.5">
                      <RecordCell
                        disabled={!editable || savingId === r.id || primaryKey}
                        valueType={a.value_type}
                        value={display}
                        onChange={(v) =>
                          setDrafts((d) => ({
                            ...d,
                            [r.id]: { ...(d[r.id] ?? {}), [a.key]: v },
                          }))
                        }
                        onCommit={(v) => void saveCell(r.id, a.key, v, a.value_type)}
                      />
                    </td>
                    )
                  })}
                  {editable ? (
                    <td className="px-2 py-1.5 text-right">
                      <button
                        type="button"
                        className="text-xs text-[var(--color-danger)] hover:underline"
                        onClick={() => void removeRecord(r.id)}
                      >
                        Delete
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}

              {editable ? (
                <tr className="border-t border-dashed border-[var(--color-accent)]/25 bg-[var(--color-accent-soft)]/30">
                  {attrs.map((a) => {
                    const primaryKey = isEntityPrimaryKey(a.key)
                    return (
                    <td key={a.id} className="px-2 py-1.5">
                      {primaryKey ? (
                        <Input
                          className="h-8 font-mono text-xs text-[var(--color-ink-muted)]"
                          disabled
                          value={newRow[ENTITY_PRIMARY_KEY] ?? ''}
                          placeholder="(auto UUID)"
                          onChange={() => undefined}
                        />
                      ) : (
                        <RecordCell
                          disabled={false}
                          valueType={a.value_type}
                          value={newRow[a.key] ?? ''}
                          onChange={(v) => setNewRow((d) => ({ ...d, [a.key]: v }))}
                          onCommit={() => undefined}
                        />
                      )}
                    </td>
                    )
                  })}
                  <td className="px-2 py-1.5 text-right">
                    <Button size="sm" onClick={() => void addRecord()}>
                      Add
                    </Button>
                  </td>
                </tr>
              ) : null}

              {!visibleRecords.length && !editable ? (
                <tr>
                  <td colSpan={attrs.length + 1} className="px-3 py-4 text-sm text-[var(--color-ink-muted)]">
                    {records.length ? 'No records match this query.' : 'No records yet.'}
                  </td>
                </tr>
              ) : null}
              {!visibleRecords.length && editable && records.length ? (
                <tr>
                  <td colSpan={attrs.length + (editable ? 1 : 0)} className="px-3 py-3 text-sm text-[var(--color-ink-muted)]">
                    No records match this query.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </CollapsibleSection>
  )
}

function RecordCell({
  value,
  valueType,
  disabled,
  onChange,
  onCommit,
}: {
  value: string
  valueType: VariableType
  disabled: boolean
  onChange: (v: string) => void
  onCommit: (v: string) => void
}) {
  if (valueType === 'boolean') {
    return (
      <Select
        className="h-8 text-xs"
        disabled={disabled}
        value={value === 'true' ? 'true' : value === 'false' ? 'false' : ''}
        onChange={(e) => {
          onChange(e.target.value)
          onCommit(e.target.value)
        }}
      >
        <option value="">—</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </Select>
    )
  }

  if (valueType === 'date') {
    return (
      <DateTimePicker
        mode="date"
        size="sm"
        disabled={disabled}
        value={value}
        allowClear
        onChange={(v) => {
          onChange(v)
          onCommit(v)
        }}
      />
    )
  }

  if (valueType === 'array' || valueType === 'object') {
    return (
      <Input
        className="h-8 font-mono text-xs"
        disabled={disabled}
        value={value}
        placeholder={valueType === 'array' ? '[]' : '{}'}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onCommit(e.target.value)}
      />
    )
  }

  return (
    <Input
      className="h-8 text-xs"
      disabled={disabled}
      type={valueType === 'number' ? 'number' : 'text'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onCommit(e.target.value)}
    />
  )
}

function cloneAttr(a: EntityAttribute): EntityAttribute {
  return { ...a }
}

function valueToCell(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function coerceAttr(raw: string, type: VariableType): unknown {
  if (raw.trim() === '') return undefined
  const coerced = coerceEntityValue(raw, type)
  if (!coerced.ok) throw new Error(coerced.error)
  return coerced.value
}
