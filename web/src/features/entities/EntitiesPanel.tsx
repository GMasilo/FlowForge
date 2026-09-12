import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Database, Download, FileSpreadsheet, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  createDynamicRecord,
  createEntity,
  createStaticRecord,
  deleteAttribute,
  deleteDynamicRecord,
  deleteEntity,
  deleteStaticRecord,
  ensureEntityPrimaryKey,
  entityVisibilityLabel,
  fetchInstalledEntities,
  installEntityOnChatbot,
  keyFromName,
  listEntityLinks,
  listEntityShares,
  listInstallableEntities,
  listEntityRecords,
  setEntityShares,
  uninstallEntityFromChatbot,
  updateEntityLinkFlags,
  updateEntityVisibility,
  updateDynamicRecord,
  updateStaticRecord,
  upsertAttribute,
  type EntityCrudFlags,
  type EntityRecordView,
  type EntityWithMeta,
  type InstalledEntity,
} from '@/features/entities/entityApi'
import {
  downloadEntityRecordsExcel,
  pickEntitySpreadsheetFile,
  type EntityExcelColumn,
  type EntityExcelParseResult,
} from '@/features/entities/entityExcel'
import { importEntityFromExcel } from '@/features/entities/entityExcelImport'
import { ENTITY_PRIMARY_KEY, ensurePrimaryKeyColumn, isEntityPrimaryKey } from '@/features/entities/entityPrimaryKey'
import { coalesceEntityFilters, queryEntityRecords } from '@/features/entities/entityQuery'
import { EntityQueryBuilder } from '@/features/designer/inspector/EntityQueryBuilder'
import type { EntityFiltersConfig } from '@/features/designer/model/flowSchema'
import type { EntityAttribute, EntityKind, EntityVisibility, VariableType } from '@/shared/types/database'
import { coerceEntityValue, isBlankEntityValue } from '@/features/entities/entityValueValidation'
import { isPasswordHash } from '@/features/entities/entityPassword'
import { canEdit } from '@/shared/types/database'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { supabase } from '@/shared/lib/supabase'
import { Button } from '@/shared/ui/button'
import { CollapsibleSection } from '@/shared/ui/collapsible-section'
import { DateTimePicker } from '@/shared/ui/date-time-picker'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import { FieldError } from '@/shared/ui/field-error'
import { Badge } from '@/shared/ui/badge'
import { cn } from '@/shared/lib/utils'

const ATTR_TYPES: VariableType[] = ['string', 'number', 'boolean', 'date', 'array', 'object', 'password']

const FULL_CRUD: EntityCrudFlags = {
  can_query: true,
  can_create: true,
  can_update: true,
  can_delete: true,
}

export function EntitiesPanel({ chatbotId }: { chatbotId: string }) {
  const { instance, role } = useRequiredInstance()
  const { user } = useAuth()
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
    queryFn: () => fetchInstalledEntities(chatbotId),
  })

  const installable = useQuery({
    queryKey: ['installable-entities', instance.id, chatbotId],
    queryFn: () => listInstallableEntities({ instanceId: instance.id, chatbotId }),
    enabled: editable,
  })

  const selected = useMemo(
    () => entities.data?.find((e) => e.id === selectedId) ?? entities.data?.[0] ?? null,
    [entities.data, selectedId],
  )

  async function refreshEntities() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['chatbot-entities', chatbotId] }),
      qc.invalidateQueries({ queryKey: ['entity-attributes'] }),
      qc.invalidateQueries({ queryKey: ['installable-entities', instance.id, chatbotId] }),
    ])
  }

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
      await refreshEntities()
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
      await refreshEntities()
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
      await refreshEntities()
    },
    onError: (e: Error) => setError(e.message),
  })

  const install = useMutation({
    mutationFn: async (entityId: string) => {
      await installEntityOnChatbot({
        chatbotId,
        entityId,
        addedBy: user?.id ?? null,
        can_query: true,
        can_create: false,
        can_update: false,
        can_delete: false,
      })
    },
    onSuccess: async (_void, entityId) => {
      setError(null)
      await refreshEntities()
      setSelectedId(entityId)
      setSectionOpen(true)
    },
    onError: (e: Error) => setError(e.message),
  })

  const uninstall = useMutation({
    mutationFn: async (entityId: string) => {
      if (!window.confirm('Uninstall this shared entity from this chatbot?')) return
      await uninstallEntityFromChatbot({ chatbotId, entityId })
    },
    onSuccess: async () => {
      setSelectedId(null)
      await refreshEntities()
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
          <Database className="h-4 w-4 text-teal-700" />
          Entities
        </span>
      }
      description="Own entities or install shared ones from other chatbots. Schema edits stay on the owning chatbot; install grants control query/create/update/delete."
      badge={
        entities.data?.length ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
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
        <div className="grid gap-3 rounded-xl border border-teal-200/70 bg-teal-50/40 p-3 sm:grid-cols-[1fr_160px_auto]">
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
        <div className="space-y-3 rounded-xl border border-teal-200/70 bg-teal-50/40 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Import entity from Excel</h4>
              <p className="text-xs text-slate-600">
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
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
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
                  <tr key={`${col.key}-${index}`} className="border-t border-slate-100">
                    <td className="px-2 py-1.5 text-slate-800">
                      {col.label}
                      {primaryKey ? ' (PK)' : ''}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-xs text-slate-600">{col.key}</td>
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
        <p className="text-sm text-[var(--color-ink-muted)]">No entities yet. Create one or install a shared entity below.</p>
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
                    selected?.id === e.id ? 'bg-teal-50 ring-1 ring-teal-200' : 'hover:bg-slate-50',
                  )}
                >
                  <span className="text-sm font-semibold text-slate-800">{e.name}</span>
                  <span className="font-mono text-[10px] text-slate-500">{e.key}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    <Badge>{e.kind}</Badge>
                    {e.owned ? (
                      <Badge>{entityVisibilityLabel(e.visibility)}</Badge>
                    ) : (
                      <Badge>Installed</Badge>
                    )}
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
              instanceId={instance.id}
              onDeleted={() => remove.mutate(selected.id)}
              onUninstalled={() => uninstall.mutate(selected.id)}
            />
          ) : null}
        </div>
      )}

      {editable && (installable.data?.length ?? 0) > 0 ? (
        <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <h4 className="text-sm font-semibold text-slate-900">Install from organisation</h4>
          <p className="text-xs text-slate-600">
            Global and shared entities from other chatbots. Installs with query-only by default — adjust CRUD on the entity.
          </p>
          <ul className="space-y-1">
            {installable.data!.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{e.name}</p>
                  <p className="font-mono text-[10px] text-slate-500">
                    {e.key} · {entityVisibilityLabel(e.visibility)}
                  </p>
                </div>
                <Button size="sm" variant="secondary" disabled={install.isPending} onClick={() => install.mutate(e.id)}>
                  Install
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </CollapsibleSection>
  )
}

function EntityEditor({
  entity,
  editable,
  chatbotId,
  instanceId,
  onDeleted,
  onUninstalled,
}: {
  entity: InstalledEntity
  editable: boolean
  chatbotId: string
  instanceId: string
  onDeleted: () => void
  onUninstalled: () => void
}) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const owned = entity.owned
  const schemaEditable = editable && owned
  const recordFlags: EntityCrudFlags = owned
    ? FULL_CRUD
    : {
        can_query: entity.can_query,
        can_create: entity.can_create,
        can_update: entity.can_update,
        can_delete: entity.can_delete,
      }

  const records = useQuery({
    queryKey: ['entity-records', entity.id, entity.kind],
    queryFn: () => listEntityRecords(entity),
    enabled: recordFlags.can_query || owned,
  })

  const members = useQuery({
    queryKey: ['instance-members-profiles', instanceId],
    enabled: owned && editable,
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('instance_members')
        .select('user_id, role, profiles(email, display_name)')
        .eq('instance_id', instanceId)
      if (qError) throw qError
      return data ?? []
    },
  })

  const chatbots = useQuery({
    queryKey: ['instance-chatbots-for-entity-share', instanceId],
    enabled: owned && editable,
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('chatbots')
        .select('id, name')
        .eq('instance_id', instanceId)
        .is('deleted_at', null)
        .order('name')
      if (qError) throw qError
      return (data ?? []).filter((b) => b.id !== chatbotId)
    },
  })

  const links = useQuery({
    queryKey: ['entity-links', entity.id],
    enabled: owned && editable,
    queryFn: () => listEntityLinks(entity.id),
  })

  const [visibility, setVisibility] = useState<EntityVisibility>(entity.visibility)
  const [shareUserIds, setShareUserIds] = useState<string[]>([])
  const [savingShare, setSavingShare] = useState(false)

  useEffect(() => {
    setVisibility(entity.visibility)
  }, [entity.id, entity.visibility])

  useEffect(() => {
    if (!owned || !editable) return
    void listEntityShares(entity.id)
      .then(setShareUserIds)
      .catch(() => setShareUserIds([]))
  }, [entity.id, owned, editable])

  useEffect(() => {
    if (!owned || !schemaEditable) return
    const pk = entity.attributes.find((a) => isEntityPrimaryKey(a.key))
    if (pk?.required && pk.is_unique && pk.is_identifier && pk.value_type === 'string') return
    void ensureEntityPrimaryKey(entity.id)
      .then(() =>
        Promise.all([
          qc.invalidateQueries({ queryKey: ['chatbot-entities', chatbotId] }),
          qc.invalidateQueries({ queryKey: ['entity-attributes', entity.id] }),
        ]),
      )
      .catch(() => {
        /* migration / race — create paths also ensure */
      })
  }, [entity.id, entity.attributes, chatbotId, qc, owned, schemaEditable])

  async function refreshAll() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['chatbot-entities', chatbotId] }),
      qc.invalidateQueries({ queryKey: ['entity-attributes', entity.id] }),
      qc.invalidateQueries({ queryKey: ['entity-records', entity.id] }),
      qc.invalidateQueries({ queryKey: ['entity-links', entity.id] }),
      qc.invalidateQueries({ queryKey: ['installable-entities', instanceId, chatbotId] }),
    ])
  }

  async function saveVisibilityAndShares() {
    setSavingShare(true)
    setError(null)
    try {
      await updateEntityVisibility(entity.id, visibility)
      await setEntityShares(entity.id, visibility === 'shared' ? shareUserIds : [])
      await refreshAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update sharing')
    } finally {
      setSavingShare(false)
    }
  }

  async function upsertBotLink(targetChatbotId: string, flags: EntityCrudFlags, linkId?: string) {
    setError(null)
    try {
      if (linkId) {
        await updateEntityLinkFlags(linkId, flags)
      } else {
        await installEntityOnChatbot({
          chatbotId: targetChatbotId,
          entityId: entity.id,
          addedBy: user?.id ?? null,
          ...flags,
        })
      }
      await refreshAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update chatbot access')
    }
  }

  async function removeBotLink(targetChatbotId: string) {
    setError(null)
    try {
      await uninstallEntityFromChatbot({ chatbotId: targetChatbotId, entityId: entity.id })
      await refreshAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove chatbot access')
    }
  }

  const memberOptions = useMemo(() => {
    return (members.data ?? [])
      .map((m) => {
        const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
        const label =
          (profile && typeof profile === 'object' && 'display_name' in profile
            ? String((profile as { display_name?: string | null }).display_name ?? '').trim()
            : '') ||
          (profile && typeof profile === 'object' && 'email' in profile
            ? String((profile as { email?: string | null }).email ?? '')
            : '') ||
          m.user_id
        return { id: m.user_id, label }
      })
      .filter((m) => m.id !== user?.id)
  }, [members.data, user?.id])

  const linksByChatbot = useMemo(() => {
    const map = new Map<string, NonNullable<typeof links.data>[number]>()
    for (const l of links.data ?? []) {
      if (l.chatbot_id === chatbotId) continue
      map.set(l.chatbot_id, l)
    }
    return map
  }, [links.data, chatbotId])

  return (
    <div className="min-w-0 space-y-5 rounded-xl border border-slate-200/90 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{entity.name}</h3>
          <p className="text-xs text-slate-500">
            <span className="font-mono">{entity.key}</span> · {entity.kind}
            {entity.kind === 'dynamic' ? ` · ${records.data?.length ?? entity.dynamic_count ?? 0} records` : null}
            {owned ? null : ' · Installed from another chatbot'}
          </p>
        </div>
        {editable && owned ? (
          <Button size="sm" variant="danger" onClick={onDeleted}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete entity
          </Button>
        ) : null}
        {editable && !owned ? (
          <Button size="sm" variant="secondary" onClick={onUninstalled}>
            Uninstall
          </Button>
        ) : null}
      </div>

      {error ? <FieldError>{error}</FieldError> : null}

      {owned && editable ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
          <h4 className="text-sm font-semibold text-slate-900">Visibility &amp; sharing</h4>
          <div>
            <Label>Visibility</Label>
            <Select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as EntityVisibility)}
            >
              <option value="private">Private — not listed for others (you can still install elsewhere)</option>
              <option value="global">Global — listed for organisation install</option>
              <option value="shared">Shared — listed for selected people</option>
            </Select>
          </div>
          {visibility === 'shared' ? (
            <div>
              <Label>Share with</Label>
              <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
                {memberOptions.length ? (
                  memberOptions.map((m) => (
                    <label key={m.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={shareUserIds.includes(m.id)}
                        onChange={(e) =>
                          setShareUserIds((ids) =>
                            e.target.checked ? [...ids, m.id] : ids.filter((id) => id !== m.id),
                          )
                        }
                      />
                      {m.label}
                    </label>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">No other users in this organisation.</p>
                )}
              </div>
            </div>
          ) : null}
          <Button size="sm" disabled={savingShare} onClick={() => void saveVisibilityAndShares()}>
            {savingShare ? 'Saving…' : 'Save visibility'}
          </Button>

          <div className="border-t border-slate-200 pt-3">
            <Label>Share with chatbots (CRUD)</Label>
            <p className="mb-2 text-[11px] text-slate-500">
              Toggle permissions to install this entity onto another chatbot. Clear all flags or use Remove to uninstall.
            </p>
            <ul className="space-y-2">
              {(chatbots.data ?? []).map((bot) => {
                const link = linksByChatbot.get(bot.id)
                const flags: EntityCrudFlags = link
                  ? {
                      can_query: link.can_query,
                      can_create: link.can_create,
                      can_update: link.can_update,
                      can_delete: link.can_delete,
                    }
                  : { can_query: false, can_create: false, can_update: false, can_delete: false }
                return (
                  <li
                    key={bot.id}
                    className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-slate-800">{bot.name}</span>
                      {link ? (
                        <span className="ml-2 text-[11px] text-teal-700">Installed</span>
                      ) : (
                        <span className="ml-2 text-[11px] text-slate-400">Not installed</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700">
                      {(['can_query', 'can_create', 'can_update', 'can_delete'] as const).map((key) => (
                        <label key={key} className="inline-flex cursor-pointer items-center gap-1">
                          <input
                            type="checkbox"
                            checked={flags[key]}
                            onChange={(e) => {
                              const next = { ...flags, [key]: e.target.checked }
                              const anyOn = next.can_query || next.can_create || next.can_update || next.can_delete
                              if (!anyOn && link) {
                                void removeBotLink(bot.id)
                                return
                              }
                              if (!anyOn) return
                              void upsertBotLink(bot.id, next, link?.id)
                            }}
                          />
                          {key.replace('can_', '')}
                        </label>
                      ))}
                      {link ? (
                        <Button size="sm" variant="ghost" onClick={() => void removeBotLink(bot.id)}>
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  </li>
                )
              })}
              {!chatbots.data?.length ? (
                <li className="text-xs text-slate-500">No other chatbots in this organisation.</li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}

      {!owned ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200/80">
          Schema is read-only. Record access:{' '}
          {[
            recordFlags.can_query ? 'query' : null,
            recordFlags.can_create ? 'create' : null,
            recordFlags.can_update ? 'update' : null,
            recordFlags.can_delete ? 'delete' : null,
          ]
            .filter(Boolean)
            .join(', ') || 'none'}
          .
        </p>
      ) : null}

      <AttributesTable
        entity={entity}
        editable={schemaEditable}
        onError={setError}
        onChanged={() => void refreshAll()}
      />

      {recordFlags.can_query || owned ? (
        <RecordsTable
          entity={entity}
          records={records.data ?? []}
          loading={records.isLoading}
          canCreate={editable && recordFlags.can_create}
          canUpdate={editable && recordFlags.can_update}
          canDelete={editable && recordFlags.can_delete}
          onError={setError}
          onChanged={() => void refreshAll()}
        />
      ) : (
        <p className="text-sm text-slate-500">This chatbot cannot query records on this entity.</p>
      )}
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
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
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
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
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
              <tr key={row.id} className="border-t border-slate-100">
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
                      <span className="text-[11px] text-slate-400">Primary key</span>
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-rose-600 hover:underline"
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
                <td colSpan={editable ? 7 : 6} className="px-3 py-4 text-sm text-slate-500">
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
  canCreate,
  canUpdate,
  canDelete,
  onError,
  onChanged,
}: {
  entity: EntityWithMeta
  records: EntityRecordView[]
  loading: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  onError: (msg: string | null) => void
  onChanged: () => void
}) {
  const showActions = canCreate || canDelete
  const attrs = entity.attributes
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({})
  const [newRow, setNewRow] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [filters, setFilters] = useState<EntityFiltersConfig>({ logic: 'and', clauses: [] })

  const activeFilters = useMemo(() => coalesceEntityFilters({ filters }), [filters])
  const filteredRecords = useMemo(
    () => queryEntityRecords(records, activeFilters, (raw) => raw),
    [records, activeFilters],
  )
  const queryActive = activeFilters.clauses.some((c) => c.attribute.trim())

  useEffect(() => {
    const next: Record<string, Record<string, string>> = {}
    for (const r of records) {
      next[r.id] = {}
      for (const a of attrs) {
        const raw = r.values[a.key]
        // Never put password hashes into editable drafts — blank means "keep existing".
        next[r.id]![a.key] =
          a.value_type === 'password' && isPasswordHash(raw) ? '' : valueToCell(raw)
      }
    }
    setDrafts(next)
  }, [records, attrs])

  useEffect(() => {
    setFilters({ logic: 'and', clauses: [] })
  }, [entity.id])

  async function saveCell(recordId: string, attrKey: string, raw: string, valueType: VariableType) {
    if (!canUpdate) return
    if (isEntityPrimaryKey(attrKey)) return
    const record = records.find((r) => r.id === recordId)
    if (!record) return
    // Blank password field = leave the stored hash unchanged.
    if (valueType === 'password' && isBlankEntityValue(raw)) {
      setDrafts((d) => ({
        ...d,
        [recordId]: { ...(d[recordId] ?? {}), [attrKey]: '' },
      }))
      return
    }
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
    if (!canCreate) return
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
    if (!canDelete) return
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
        <p className="text-sm text-slate-500">Add attributes first, then enter values in the table.</p>
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
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          {queryActive ? `${filteredRecords.length}/${records.length}` : records.length}
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
                records: queryActive ? filteredRecords : records,
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
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="space-y-3">
          <EntityQueryBuilder
            attributes={attrs}
            filters={filters}
            valueMode="plain"
            onChange={setFilters}
          />
          <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                {attrs.map((a) => (
                  <th key={a.id} className="px-2 py-2 font-semibold">
                    {a.label || a.key}
                    {isEntityPrimaryKey(a.key) ? ' (PK)' : ''}
                    {a.required ? ' *' : ''}
                    {a.is_unique && !isEntityPrimaryKey(a.key) ? ' ‡' : ''}
                  </th>
                ))}
                {showActions ? <th className="px-2 py-2 font-semibold" /> : null}
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  {attrs.map((a) => {
                    const primaryKey = isEntityPrimaryKey(a.key)
                    const display = drafts[r.id]?.[a.key] ?? (primaryKey ? r.id : '')
                    return (
                    <td key={a.id} className="px-2 py-1.5">
                      <RecordCell
                        disabled={!canUpdate || savingId === r.id || primaryKey}
                        valueType={a.value_type}
                        value={display}
                        hasStoredPassword={a.value_type === 'password' && isPasswordHash(r.values[a.key])}
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
                  {showActions ? (
                    <td className="px-2 py-1.5 text-right">
                      {canDelete ? (
                        <button
                          type="button"
                          className="text-xs text-rose-600 hover:underline"
                          onClick={() => void removeRecord(r.id)}
                        >
                          Delete
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}

              {canCreate ? (
                <tr className="border-t border-dashed border-teal-200 bg-teal-50/30">
                  {attrs.map((a) => {
                    const primaryKey = isEntityPrimaryKey(a.key)
                    return (
                    <td key={a.id} className="px-2 py-1.5">
                      {primaryKey ? (
                        <Input
                          className="h-8 font-mono text-xs text-slate-400"
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
                  {showActions ? (
                    <td className="px-2 py-1.5 text-right">
                      <Button size="sm" onClick={() => void addRecord()}>
                        Add
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ) : null}

              {!filteredRecords.length && !canCreate ? (
                <tr>
                  <td colSpan={attrs.length + (showActions ? 1 : 0)} className="px-3 py-4 text-sm text-slate-500">
                    {queryActive ? 'No records match these filters.' : 'No records yet.'}
                  </td>
                </tr>
              ) : null}

              {!filteredRecords.length && canCreate && queryActive ? (
                <tr>
                  <td colSpan={attrs.length + (showActions ? 1 : 0)} className="px-3 py-3 text-sm text-slate-500">
                    No records match these filters ({records.length} total).
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
  hasStoredPassword,
}: {
  value: string
  valueType: VariableType
  disabled: boolean
  onChange: (v: string) => void
  onCommit: (v: string) => void
  hasStoredPassword?: boolean
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

  if (valueType === 'password') {
    return (
      <Input
        className="h-8 text-xs"
        disabled={disabled}
        type="password"
        autoComplete="new-password"
        value={value}
        placeholder={hasStoredPassword ? '•••••••• (unchanged)' : 'Set password'}
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
