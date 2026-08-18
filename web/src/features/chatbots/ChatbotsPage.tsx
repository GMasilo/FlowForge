import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { AlertTriangle, Bot, Plus, RotateCcw, Trash2, Upload } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { canAdmin, canEdit } from '@/shared/types/database'
import { supabase } from '@/shared/lib/supabase'
import { pickJsonFile } from '@/shared/lib/downloadJson'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { FieldError } from '@/shared/ui/field-error'
import { PageHeader } from '@/shared/ui/page-header'
import { getPublishStatus } from '@/features/designer/utils/flowPublish'
import { parseFlowExport } from '@/features/designer/utils/flowTransfer'
import type { DesignerEdge, DesignerNode } from '@/features/designer/model/flowSchema'
import type { FlowGlobalExport } from '@/features/designer/utils/flowTransfer'
import {
  loadFlowBundle,
  replaceFlowInDb,
  versionCompareHint,
} from '@/features/chatbots/chatbotFlowTransfer'
import { cn } from '@/shared/lib/utils'

type BotRow = {
  id: string
  name: string
  description: string | null
  updated_at: string
  deleted_at: string | null
  chatbot_flows:
    | { version: number | null; published_at: string | null; has_draft_changes: boolean | null; published_graph: unknown }
    | { version: number | null; published_at: string | null; has_draft_changes: boolean | null; published_graph: unknown }[]
    | null
}

type ParsedImport = {
  nodes: DesignerNode[]
  edges: DesignerEdge[]
  globals: FlowGlobalExport[]
  entities?: { id: string; key: string }[]
  meta: {
    chatbotId?: string
    chatbotName?: string
    chatbotDescription?: string | null
    flowName?: string
    flowVersion?: number
    exportedAt?: string
  }
}

type ImportDialog = {
  parsed: ParsedImport
  idMatch: BotRow | null
  nameMatches: BotRow[]
  /** selected existing target, or 'new' */
  choice: string
}

function flowVersionOf(bot: BotRow): number {
  const flowRaw = Array.isArray(bot.chatbot_flows) ? bot.chatbot_flows[0] : bot.chatbot_flows
  return flowRaw?.version ?? 1
}

export function ChatbotsPage() {
  const { instance, role } = useRequiredInstance()
  const { user } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [importDialog, setImportDialog] = useState<ImportDialog | null>(null)
  const [showDeleted, setShowDeleted] = useState(false)
  const importBusyRef = useRef(false)
  const editable = canEdit(role)
  const isAdmin = canAdmin(role)

  const chatbots = useQuery({
    queryKey: ['chatbots', instance.id, showDeleted],
    queryFn: async () => {
      let q = supabase
        .from('chatbots')
        .select('*, chatbot_flows(version, published_at, has_draft_changes, published_graph)')
        .eq('instance_id', instance.id)
        .order('updated_at', { ascending: false })
      if (showDeleted) {
        q = q.not('deleted_at', 'is', null)
      } else {
        q = q.is('deleted_at', null)
      }
      const { data, error: qError } = await q
      if (qError) throw qError
      return data as BotRow[]
    },
  })

  const softDelete = useMutation({
    mutationFn: async (chatbotId: string) => {
      const { error } = await supabase.rpc('soft_delete_chatbot', { p_chatbot_id: chatbotId })
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['chatbots', instance.id] })
    },
  })

  const restore = useMutation({
    mutationFn: async (chatbotId: string) => {
      const { error } = await supabase.rpc('restore_chatbot', { p_chatbot_id: chatbotId })
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['chatbots', instance.id] })
    },
  })

  const create = useMutation({
    mutationFn: async () => {
      const { data, error: insertError } = await supabase
        .from('chatbots')
        .insert({
          instance_id: instance.id,
          name: name.trim(),
          description: description.trim() || null,
          created_by: user!.id,
        })
        .select('*')
        .single()
      if (insertError) throw insertError
      return data
    },
    onSuccess: async () => {
      setName('')
      setDescription('')
      setOpen(false)
      setError(null)
      await qc.invalidateQueries({ queryKey: ['chatbots', instance.id] })
    },
    onError: (err: Error) => setError(err.message),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!editable) return
    create.mutate()
  }

  const versionHint = useMemo(() => {
    if (!importDialog) return null
    const targetId = importDialog.choice === 'new' ? null : importDialog.choice
    const target =
      (targetId &&
        (importDialog.idMatch?.id === targetId
          ? importDialog.idMatch
          : importDialog.nameMatches.find((b) => b.id === targetId))) ||
      null
    if (!target) return null
    return versionCompareHint(importDialog.parsed.meta.flowVersion, flowVersionOf(target))
  }, [importDialog])

  async function startImport() {
    if (!editable || importBusyRef.current) return
    setImportError(null)
    try {
      const raw = await pickJsonFile()
      const parsed = parseFlowExport(raw)
      const bots = chatbots.data ?? []

      const idMatch =
        parsed.meta.chatbotId != null ? (bots.find((b) => b.id === parsed.meta.chatbotId) ?? null) : null
      const nameKey = (parsed.meta.chatbotName ?? '').trim().toLowerCase()
      const nameMatches = nameKey
        ? bots.filter((b) => b.name.trim().toLowerCase() === nameKey && b.id !== idMatch?.id)
        : []

      const defaultChoice = idMatch?.id ?? (nameMatches.length === 1 ? nameMatches[0]!.id : 'new')

      setImportDialog({
        parsed,
        idMatch,
        nameMatches,
        choice: defaultChoice,
      })
    } catch (e) {
      if (e instanceof Error && e.message === 'No file selected') return
      setImportError(e instanceof Error ? e.message : 'Import failed')
    }
  }

  async function confirmImport() {
    if (!importDialog || !editable || importBusyRef.current || !user) return
    importBusyRef.current = true
    setImportBusy(true)
    setImportError(null)
    try {
      const { parsed, choice } = importDialog
      const label = parsed.meta.chatbotName || parsed.meta.flowName || 'Imported chatbot'
      let chatbotId = choice

      if (choice === 'new') {
        const { data: created, error: insertError } = await supabase
          .from('chatbots')
          .insert({
            instance_id: instance.id,
            name: label,
            description: parsed.meta.chatbotDescription ?? null,
            created_by: user.id,
          })
          .select('id')
          .single()
        if (insertError) throw insertError
        chatbotId = created.id
      }

      const bundle = await loadFlowBundle(chatbotId)
      await replaceFlowInDb({
        chatbotId,
        flowId: bundle.flow.id,
        nodes: parsed.nodes,
        edges: parsed.edges,
        globals: parsed.globals,
        entitiesExport: parsed.entities,
        chatbotMeta:
          choice === 'new'
            ? undefined
            : {
                name: parsed.meta.chatbotName,
                description: parsed.meta.chatbotDescription,
              },
      })

      setImportDialog(null)
      await qc.invalidateQueries({ queryKey: ['chatbots', instance.id] })
      await qc.invalidateQueries({ queryKey: ['flow-bundle', chatbotId] })
      await qc.invalidateQueries({ queryKey: ['chatbot', chatbotId] })
      navigate(`/instances/${instance.id}/chatbots/${chatbotId}/design`)
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      importBusyRef.current = false
      setImportBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chatbots"
        description={`Design conversational flows for ${instance.name}.`}
        actions={
          <div className="flex flex-wrap gap-2">
            {isAdmin ? (
              <Button
                variant="secondary"
                onClick={() => setShowDeleted((v) => !v)}
              >
                {showDeleted ? 'Show active' : 'Show deleted'}
              </Button>
            ) : null}
            {editable && !showDeleted ? (
              <>
                <Button variant="secondary" onClick={() => void startImport()} disabled={importBusy}>
                  <Upload className="h-4 w-4" />
                  Import
                </Button>
                <Button onClick={() => setOpen((v) => !v)}>
                  <Plus className="h-4 w-4" />
                  New chatbot
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      {importError ? <FieldError>{importError}</FieldError> : null}

      {importDialog ? (
        <Card className="ff-page-enter border-teal-200/60">
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-800">Import flow</h2>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                {importDialog.parsed.meta.chatbotName || importDialog.parsed.meta.flowName || 'Untitled'}
                {' · '}
                {importDialog.parsed.nodes.length} steps · {importDialog.parsed.edges.length} connections
                {importDialog.parsed.globals.length
                  ? ` · ${importDialog.parsed.globals.length} globals`
                  : ''}
                {importDialog.parsed.meta.flowVersion != null
                  ? ` · file v${importDialog.parsed.meta.flowVersion}`
                  : ''}
                {importDialog.parsed.meta.exportedAt
                  ? ` · exported ${new Date(importDialog.parsed.meta.exportedAt).toLocaleString()}`
                  : ''}
              </p>
            </div>

            {importDialog.idMatch ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm text-amber-950">
                Matched existing chatbot by id: <strong>{importDialog.idMatch.name}</strong>
                {` (local v${flowVersionOf(importDialog.idMatch)})`}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Destination</Label>
              <div className="space-y-2">
                {importDialog.idMatch ? (
                  <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                    <input
                      type="radio"
                      className="mt-1"
                      name="import-target"
                      checked={importDialog.choice === importDialog.idMatch.id}
                      onChange={() =>
                        setImportDialog({ ...importDialog, choice: importDialog.idMatch!.id })
                      }
                    />
                    <span>
                      <span className="font-medium">Replace “{importDialog.idMatch.name}”</span>
                      <span className="block text-[11px] text-slate-500">Same id as in the file</span>
                    </span>
                  </label>
                ) : null}

                {importDialog.nameMatches.map((bot) => (
                  <label
                    key={bot.id}
                    className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <input
                      type="radio"
                      className="mt-1"
                      name="import-target"
                      checked={importDialog.choice === bot.id}
                      onChange={() => setImportDialog({ ...importDialog, choice: bot.id })}
                    />
                    <span>
                      <span className="font-medium">Replace “{bot.name}”</span>
                      <span className="block text-[11px] text-slate-500">
                        Same name · local v{flowVersionOf(bot)} · edited{' '}
                        {formatDistanceToNow(new Date(bot.updated_at), { addSuffix: true })}
                      </span>
                    </span>
                  </label>
                ))}

                <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <input
                    type="radio"
                    className="mt-1"
                    name="import-target"
                    checked={importDialog.choice === 'new'}
                    onChange={() => setImportDialog({ ...importDialog, choice: 'new' })}
                  />
                  <span>
                    <span className="font-medium">Create a new chatbot</span>
                    <span className="block text-[11px] text-slate-500">
                      Uses “{importDialog.parsed.meta.chatbotName || importDialog.parsed.meta.flowName || 'Imported chatbot'}”
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {importDialog.choice !== 'new' && versionHint ? (
              <div
                className={cn(
                  'flex gap-2 rounded-xl border px-3 py-2 text-sm',
                  (() => {
                    const target =
                      importDialog.idMatch?.id === importDialog.choice
                        ? importDialog.idMatch
                        : importDialog.nameMatches.find((b) => b.id === importDialog.choice)
                    const localV = target ? flowVersionOf(target) : undefined
                    const fileV = importDialog.parsed.meta.flowVersion
                    const older = fileV != null && localV != null && fileV < localV
                    return older
                      ? 'border-rose-200 bg-rose-50 text-rose-900'
                      : 'border-sky-200 bg-sky-50 text-sky-950'
                  })(),
                )}
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{versionHint}</span>
              </div>
            ) : null}

            {importDialog.choice !== 'new' ? (
              <p className="text-[11px] text-slate-500">
                Replacing overwrites the draft flow and cannot be undone from the UI. Export first if unsure.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={importBusy}
                onClick={() => void confirmImport()}
              >
                {importBusy
                  ? 'Importing…'
                  : importDialog.choice === 'new'
                    ? 'Create & import'
                    : 'Replace & import'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={importBusy}
                onClick={() => setImportDialog(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {open ? (
        <Card className="ff-page-enter border-teal-200/60">
          <form className="space-y-3" onSubmit={onSubmit}>
            <div>
              <Label htmlFor="bot-name">Name</Label>
              <Input id="bot-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="bot-desc">Description</Label>
              <Textarea id="bot-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            {error ? <FieldError>{error}</FieldError> : null}
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create chatbot'}
            </Button>
          </form>
        </Card>
      ) : null}

      {chatbots.isLoading ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Loading…</p>
      ) : chatbots.data?.length ? (
        <div className="ff-stagger grid gap-4 sm:grid-cols-2">
          {chatbots.data.map((bot) => {
            const flowRaw = Array.isArray(bot.chatbot_flows) ? bot.chatbot_flows[0] : bot.chatbot_flows
            const publishStatus = flowRaw
              ? getPublishStatus({
                  version: flowRaw.version ?? 1,
                  published_at: flowRaw.published_at ?? null,
                  has_draft_changes: flowRaw.has_draft_changes ?? true,
                  published_graph: flowRaw.published_graph ?? null,
                })
              : getPublishStatus({
                  version: 1,
                  published_at: null,
                  has_draft_changes: true,
                  published_graph: null,
                })

            return (
            <Card key={bot.id} className="ff-hover-lift group relative flex flex-col gap-4 overflow-hidden">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 opacity-80" />
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-gradient-to-br from-teal-500/15 to-cyan-500/20 p-2.5 text-teal-700 ring-1 ring-teal-600/10">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-semibold">{bot.name}</h2>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        publishStatus.kind === 'live' && 'bg-emerald-50 text-emerald-800',
                        publishStatus.kind === 'draft' && 'bg-amber-50 text-amber-800',
                        publishStatus.kind === 'never' && 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {publishStatus.label}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--color-ink-muted)]">
                    {bot.description || 'No description'}
                  </p>
                  <p className="mt-2 text-[11px] font-medium text-slate-400">
                    Edited {formatDistanceToNow(new Date(bot.updated_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {showDeleted ? (
                  isAdmin ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={restore.isPending}
                      onClick={() => {
                        if (!window.confirm(`Restore “${bot.name}”?`)) return
                        restore.mutate(bot.id)
                      }}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Restore
                    </Button>
                  ) : null
                ) : (
                  <>
                    <Link to={`/instances/${instance.id}/chatbots/${bot.id}/design`}>
                      <Button size="sm">Open designer</Button>
                    </Link>
                    <Link to={`/instances/${instance.id}/chatbots/${bot.id}`}>
                      <Button size="sm" variant="secondary">
                        Settings
                      </Button>
                    </Link>
                    {isAdmin ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={softDelete.isPending}
                        onClick={() => {
                          if (!window.confirm(`Delete “${bot.name}”? You can restore it later.`)) return
                          softDelete.mutate(bot.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
            </Card>
            )
          })}
        </div>
      ) : (
        <Card className="border-dashed border-teal-300/50 bg-teal-50/30 text-center">
          <p className="text-sm text-[var(--color-ink-muted)]">
            {showDeleted ? 'No deleted chatbots.' : 'No chatbots yet.'}
          </p>
        </Card>
      )}
    </div>
  )
}
