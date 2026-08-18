import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Check,
  CreditCard,
  Globe,
  Lock,
  Mail,
  Pencil,
  Plus,
  PlugZap,
  Search,
  Share2,
  Sparkles,
  Trash2,
  Workflow,
} from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import {
  defaultEmailConfig,
  defaultHttpConfig,
  defaultPaymentConfig,
  parseEmailConfig,
  parseHttpConfig,
  parsePaymentConfig,
  connectionConfigToJson,
  type EmailConnectionConfig,
  type HttpConnectionConfig,
  type PaymentConnectionConfig,
} from '@/features/connections/connectionConfig'
import { EmailConnectionFields, HttpConnectionFields, PaymentConnectionFields } from '@/features/connections/ConnectionFormFields'
import { ExpectedResponseEditor, InputParamsEditor } from '@/features/connections/SchemaEditors'
import {
  addConnectionToChatbot,
  createChatbotConnection,
  deleteConnection,
  listMarketplaceConnections,
  listMyCreatedConnections,
  removeConnectionFromChatbot,
  setConnectionShares,
  updateChatbotConnection,
  visibilityLabel,
  type MarketplaceConnection,
} from '@/features/connections/connectionApi'
import {
  canEdit,
  type ConnectionKind,
  type ConnectionVisibility,
  type ConnectionWithConfig,
} from '@/shared/types/database'
import { supabase } from '@/shared/lib/supabase'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import { Badge } from '@/shared/ui/badge'
import { FieldError } from '@/shared/ui/field-error'
import { PageHeader } from '@/shared/ui/page-header'
import { cn } from '@/shared/lib/utils'

type TabId = 'mine' | 'forgehub'
type KindFilter = 'all' | ConnectionKind
type ScopeFilter = 'all' | 'global' | 'shared'
type SortMode = 'name-asc' | 'name-desc' | 'recent'

type FormState = {
  id?: string
  chatbotId: string
  name: string
  kind: ConnectionKind
  visibility: ConnectionVisibility
  shareUserIds: string[]
  http: HttpConnectionConfig
  email: EmailConnectionConfig
  payment: PaymentConnectionConfig
}

function blankForm(chatbotId = ''): FormState {
  return {
    chatbotId,
    name: '',
    kind: 'http',
    visibility: 'private',
    shareUserIds: [],
    http: defaultHttpConfig(),
    email: defaultEmailConfig(),
    payment: defaultPaymentConfig(),
  }
}

function kindAccent(kind: ConnectionKind) {
  if (kind === 'http') return 'from-teal-500 via-cyan-500 to-sky-500'
  if (kind === 'payment') return 'from-emerald-500 via-teal-500 to-cyan-500'
  return 'from-orange-500 via-amber-500 to-yellow-500'
}

function KindIcon({ kind }: { kind: ConnectionKind }) {
  if (kind === 'http') return <Globe className="h-6 w-6" />
  if (kind === 'payment') return <CreditCard className="h-6 w-6" />
  return <Mail className="h-6 w-6" />
}

export function ConnectionsPage() {
  const { instance, role } = useRequiredInstance()
  const { user } = useAuth()
  const qc = useQueryClient()
  const editable = canEdit(role)
  const [tab, setTab] = useState<TabId>('mine')
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connections"
        description={`Manage your integrations for ${instance.name}, or discover shared ones in ForgeHub.`}
      />

      <div className="flex w-fit rounded-xl border border-[var(--color-border)]/80 bg-slate-50/80 p-1">
        <button
          type="button"
          onClick={() => setTab('mine')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition',
            tab === 'mine'
              ? 'bg-[var(--color-accent)] text-white shadow-sm'
              : 'text-slate-600 hover:bg-white hover:text-slate-900',
          )}
        >
          <Lock className="h-3.5 w-3.5" />
          My connections
        </button>
        <button
          type="button"
          onClick={() => setTab('forgehub')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition',
            tab === 'forgehub'
              ? 'bg-[var(--color-accent)] text-white shadow-sm'
              : 'text-slate-600 hover:bg-white hover:text-slate-900',
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          ForgeHub
        </button>
      </div>

      {error ? <FieldError>{error}</FieldError> : null}

      {tab === 'mine' ? (
        <MyConnectionsTab
          editable={editable}
          userId={user?.id}
          instanceId={instance.id}
          onError={setError}
          invalidate={() => {
            void qc.invalidateQueries({ queryKey: ['my-created-connections', instance.id] })
            void qc.invalidateQueries({ queryKey: ['marketplace-connections', instance.id] })
          }}
        />
      ) : (
        <ForgeHubTab
          editable={editable}
          userId={user?.id}
          instanceId={instance.id}
          onError={setError}
        />
      )}
    </div>
  )
}

function MyConnectionsTab({
  editable,
  userId,
  instanceId,
  onError,
  invalidate,
}: {
  editable: boolean
  userId?: string
  instanceId: string
  onError: (msg: string | null) => void
  invalidate: () => void
}) {
  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(blankForm())

  const chatbots = useQuery({
    queryKey: ['chatbots', instanceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chatbots')
        .select('id, name')
        .eq('instance_id', instanceId)
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })

  const mine = useQuery({
    queryKey: ['my-created-connections', instanceId, userId],
    enabled: !!userId,
    queryFn: () => listMyCreatedConnections({ instanceId, userId: userId! }),
  })

  const members = useQuery({
    queryKey: ['instance-members-profiles', instanceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instance_members')
        .select('user_id, role, profiles(email, display_name)')
        .eq('instance_id', instanceId)
      if (error) throw error
      return data ?? []
    },
  })

  const memberOptions = useMemo(() => {
    return (members.data ?? [])
      .filter((m) => m.user_id !== userId)
      .map((m) => {
        const profile = m.profiles as { display_name?: string | null; email?: string | null } | null
        return {
          id: m.user_id as string,
          label: profile?.display_name || profile?.email || m.user_id,
        }
      })
  }, [members.data, userId])

  const filtered = useMemo(() => {
    let rows = mine.data ?? []
    if (kindFilter !== 'all') rows = rows.filter((r) => r.kind === kindFilter)
    const q = query.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.chatbot_name ?? '').toLowerCase().includes(q) ||
          r.visibility.includes(q) ||
          r.kind.includes(q),
      )
    }
    return rows
  }, [mine.data, kindFilter, query])

  const save = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Sign in required')
      const name = form.name.trim()
      if (!name) throw new Error('Name is required')
      if (!form.chatbotId) throw new Error('Choose which chatbot owns this connection')
      const config = connectionConfigToJson(form.kind, form)
      if (form.id) {
        await updateChatbotConnection({
          id: form.id,
          name,
          kind: form.kind,
          config,
          visibility: form.visibility,
        })
        await setConnectionShares(form.id, form.visibility === 'shared' ? form.shareUserIds : [])
      } else {
        const created = await createChatbotConnection({
          instanceId,
          chatbotId: form.chatbotId,
          name,
          kind: form.kind,
          config,
          visibility: form.visibility,
          createdBy: userId,
        })
        if (form.visibility === 'shared' && form.shareUserIds.length) {
          await setConnectionShares(created.id, form.shareUserIds)
        }
      }
    },
    onSuccess: () => {
      setOpen(false)
      setForm(blankForm())
      onError(null)
      invalidate()
    },
    onError: (e: Error) => onError(e.message),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!window.confirm('Delete this connection and its secrets?')) return
      await deleteConnection(id)
    },
    onSuccess: () => {
      onError(null)
      invalidate()
    },
    onError: (e: Error) => onError(e.message),
  })

  async function startEdit(row: ConnectionWithConfig & { chatbot_name?: string | null }) {
    const { data: shares } = await supabase.from('connection_shares').select('user_id').eq('connection_id', row.id)
    setForm({
      id: row.id,
      chatbotId: row.chatbot_id,
      name: row.name,
      kind: row.kind,
      visibility: row.visibility,
      shareUserIds: (shares ?? []).map((s) => s.user_id),
      http: row.kind === 'http' ? parseHttpConfig(row.config) : defaultHttpConfig(),
      email: row.kind === 'email' ? parseEmailConfig(row.config) : defaultEmailConfig(),
      payment: row.kind === 'payment' ? parsePaymentConfig(row.config) : defaultPaymentConfig(),
    })
    setOpen(true)
    onError(null)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!editable) return
    save.mutate()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your connections…"
          />
        </div>
        <Select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as KindFilter)}>
          <option value="all">All kinds</option>
          <option value="http">HTTP</option>
          <option value="email">Email</option>
          <option value="payment">Payment</option>
        </Select>
        {editable ? (
          <Button
            onClick={() => {
              setForm(blankForm(chatbots.data?.[0]?.id ?? ''))
              setOpen(true)
              onError(null)
            }}
          >
            <Plus className="h-4 w-4" />
            New connection
          </Button>
        ) : null}
      </div>

      {open ? (
        <Card className="space-y-3 border-teal-200/70 bg-teal-50/30">
          <h2 className="text-base font-semibold text-slate-800">
            {form.id ? 'Edit connection' : 'New connection'}
          </h2>
          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <Label>Owning chatbot</Label>
                <Select
                  value={form.chatbotId}
                  disabled={!!form.id}
                  onChange={(e) => setForm((f) => ({ ...f, chatbotId: e.target.value }))}
                  required
                >
                  <option value="">Select…</option>
                  {(chatbots.data ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Kind</Label>
                <Select
                  value={form.kind}
                  disabled={!!form.id}
                  onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as ConnectionKind }))}
                >
                  <option value="http">HTTP</option>
                  <option value="email">Email (SMTP)</option>
                  <option value="payment">Payment</option>
                </Select>
              </div>
              <div>
                <Label>Visibility</Label>
                <Select
                  value={form.visibility}
                  onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value as ConnectionVisibility }))}
                >
                  <option value="private">Private — owning chatbot only</option>
                  <option value="global">Global — listed in ForgeHub</option>
                  <option value="shared">Shared — ForgeHub for selected people</option>
                </Select>
              </div>
            </div>

            {form.visibility === 'shared' ? (
              <div>
                <Label>Share with</Label>
                <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
                  {memberOptions.length ? (
                    memberOptions.map((m) => (
                      <label key={m.id} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.shareUserIds.includes(m.id)}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              shareUserIds: e.target.checked
                                ? [...f.shareUserIds, m.id]
                                : f.shareUserIds.filter((id) => id !== m.id),
                            }))
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

            {form.kind === 'http' ? (
              <>
                <HttpConnectionFields value={form.http} onChange={(http) => setForm((f) => ({ ...f, http }))} />
                <InputParamsEditor
                  value={form.http.inputParams}
                  onChange={(inputParams) => setForm((f) => ({ ...f, http: { ...f.http, inputParams } }))}
                />
                <ExpectedResponseEditor
                  value={form.http.expectedResponse}
                  onChange={(expectedResponse) => setForm((f) => ({ ...f, http: { ...f.http, expectedResponse } }))}
                />
              </>
            ) : form.kind === 'payment' ? (
              <PaymentConnectionFields
                value={form.payment}
                onChange={(payment) => setForm((f) => ({ ...f, payment }))}
              />
            ) : (
              <>
                <EmailConnectionFields value={form.email} onChange={(email) => setForm((f) => ({ ...f, email }))} />
                <InputParamsEditor
                  value={form.email.inputParams}
                  onChange={(inputParams) => setForm((f) => ({ ...f, email: { ...f.email, inputParams } }))}
                />
                <ExpectedResponseEditor
                  value={form.email.expectedResponse}
                  onChange={(expectedResponse) => setForm((f) => ({ ...f, email: { ...f.email, expectedResponse } }))}
                />
              </>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? 'Saving…' : form.id ? 'Save changes' : 'Create connection'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {mine.isLoading ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Loading your connections…</p>
      ) : filtered.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((c) => (
            <article
              key={c.id}
              className="group flex aspect-square flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-teal-200"
            >
              <div className={cn('relative h-[38%] bg-gradient-to-br', kindAccent(c.kind))}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35),transparent_50%)]" />
                <div className="absolute bottom-3 left-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/95 text-slate-800 shadow-md">
                  {<KindIcon kind={c.kind} />}
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-2 p-3 pt-4">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-slate-900">{c.name}</h3>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">
                    <Workflow className="mr-1 inline h-3 w-3" />
                    {c.chatbot_name ?? 'Chatbot'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge>{c.kind}</Badge>
                  <Badge>{visibilityLabel(c.visibility)}</Badge>
                </div>
                <p className="text-[10px] text-slate-400">
                  Updated {formatDistanceToNow(new Date(c.updated_at), { addSuffix: true })}
                </p>
                {editable && c.canManage !== false ? (
                  <div className="mt-auto flex gap-1.5 pt-1">
                    <Button size="sm" variant="secondary" className="flex-1" onClick={() => void startEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => remove.mutate(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <p className="mt-auto text-[11px] text-slate-400">Full details available to you as owner.</p>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Card className="border-dashed text-center">
          <PlugZap className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            {query || kindFilter !== 'all'
              ? 'No connections match your filters.'
              : 'You have not created any connections yet.'}
          </p>
        </Card>
      )}
    </div>
  )
}

function ForgeHubTab({
  editable,
  userId,
  instanceId,
  onError,
}: {
  editable: boolean
  userId?: string
  instanceId: string
  onError: (msg: string | null) => void
}) {
  const qc = useQueryClient()
  const [targetChatbotId, setTargetChatbotId] = useState('')
  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('name-asc')
  const [installedOnly, setInstalledOnly] = useState(false)

  const chatbots = useQuery({
    queryKey: ['chatbots', instanceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chatbots')
        .select('id, name')
        .eq('instance_id', instanceId)
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })

  const hub = useQuery({
    queryKey: ['marketplace-connections', instanceId, targetChatbotId || null],
    queryFn: () =>
      listMarketplaceConnections({
        instanceId,
        chatbotId: targetChatbotId || null,
      }),
  })

  const add = useMutation({
    mutationFn: async (connectionId: string) => {
      if (!userId) throw new Error('Sign in required')
      if (!targetChatbotId) throw new Error('Select a chatbot to install into')
      await addConnectionToChatbot({
        chatbotId: targetChatbotId,
        connectionId,
        addedBy: userId,
      })
    },
    onSuccess: async () => {
      onError(null)
      await qc.invalidateQueries({ queryKey: ['marketplace-connections', instanceId] })
      await qc.invalidateQueries({ queryKey: ['chatbot-usable-connections', targetChatbotId] })
    },
    onError: (e: Error) => onError(e.message),
  })

  const remove = useMutation({
    mutationFn: async (connectionId: string) => {
      if (!targetChatbotId) throw new Error('Select a chatbot')
      await removeConnectionFromChatbot({ chatbotId: targetChatbotId, connectionId })
    },
    onSuccess: async () => {
      onError(null)
      await qc.invalidateQueries({ queryKey: ['marketplace-connections', instanceId] })
      await qc.invalidateQueries({ queryKey: ['chatbot-usable-connections', targetChatbotId] })
    },
    onError: (e: Error) => onError(e.message),
  })

  const filtered = useMemo(() => {
    let rows = hub.data ?? []
    if (kindFilter !== 'all') rows = rows.filter((r) => r.kind === kindFilter)
    if (scopeFilter !== 'all') rows = rows.filter((r) => r.visibility === scopeFilter)
    if (installedOnly) rows = rows.filter((r) => r.linked_to_chatbot)
    const q = query.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.chatbot_name ?? '').toLowerCase().includes(q) ||
          r.kind.includes(q) ||
          r.visibility.includes(q),
      )
    }
    rows = [...rows].sort((a, b) => {
      if (sortMode === 'recent') return b.updated_at.localeCompare(a.updated_at)
      const cmp = a.name.localeCompare(b.name)
      return sortMode === 'name-desc' ? -cmp : cmp
    })
    return rows
  }, [hub.data, kindFilter, scopeFilter, installedOnly, query, sortMode])

  const stats = useMemo(() => {
    const rows = hub.data ?? []
    return {
      total: rows.length,
      global: rows.filter((r) => r.visibility === 'global').length,
      shared: rows.filter((r) => r.visibility === 'shared').length,
      installed: rows.filter((r) => r.linked_to_chatbot).length,
    }
  }, [hub.data])

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-teal-200/60 bg-gradient-to-br from-teal-50 via-white to-cyan-50 p-5 shadow-[var(--shadow-soft)]">
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-teal-400/20 blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-600/10 px-2.5 py-1 text-[11px] font-semibold text-teal-800">
              <Sparkles className="h-3.5 w-3.5" />
              ForgeHub
            </div>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">Discover shared integrations</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-600">
              Browse connections published in your organisation. Credentials stay locked — install into a chatbot to use
              them in flows.
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-medium text-slate-500">
              <span>{stats.total} listed</span>
              <span>·</span>
              <span>{stats.global} global</span>
              <span>·</span>
              <span>{stats.shared} shared with you</span>
              {targetChatbotId ? (
                <>
                  <span>·</span>
                  <span>{stats.installed} installed</span>
                </>
              ) : null}
            </div>
          </div>
          <div className="min-w-[220px]">
            <Label>Install into chatbot</Label>
            <Select
              value={targetChatbotId}
              onChange={(e) => setTargetChatbotId(e.target.value)}
              disabled={!editable}
            >
              <option value="">Select chatbot…</option>
              {(chatbots.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ForgeHub…"
          />
        </div>
        <Select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as KindFilter)}>
          <option value="all">All kinds</option>
          <option value="http">HTTP</option>
          <option value="email">Email</option>
          <option value="payment">Payment</option>
        </Select>
        <Select value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value as ScopeFilter)}>
          <option value="all">Global + shared</option>
          <option value="global">Global only</option>
          <option value="shared">Shared with me</option>
        </Select>
        <Select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
          <option value="name-asc">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
          <option value="recent">Recently updated</option>
        </Select>
        <button
          type="button"
          disabled={!targetChatbotId}
          onClick={() => setInstalledOnly((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition',
            installedOnly
              ? 'border-teal-300 bg-teal-50 text-teal-800'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            !targetChatbotId && 'opacity-50',
          )}
          title={targetChatbotId ? 'Show only installed' : 'Select a chatbot first'}
        >
          {installedOnly ? <Check className="h-3.5 w-3.5" /> : null}
          Installed only
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-slate-500 hover:bg-slate-50"
          title={sortMode === 'name-asc' ? 'Sorted A–Z' : sortMode === 'name-desc' ? 'Sorted Z–A' : 'Sorted by recent'}
          onClick={() =>
            setSortMode((m) => (m === 'name-asc' ? 'name-desc' : m === 'name-desc' ? 'recent' : 'name-asc'))
          }
        >
          {sortMode === 'name-desc' ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpAZ className="h-4 w-4" />}
        </button>
      </div>

      {hub.isLoading ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Loading ForgeHub…</p>
      ) : filtered.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((c) => (
            <ForgeHubCard
              key={c.id}
              connection={c}
              editable={editable}
              targetSelected={!!targetChatbotId}
              busy={add.isPending || remove.isPending}
              onAdd={() => add.mutate(c.id)}
              onRemove={() => remove.mutate(c.id)}
            />
          ))}
        </div>
      ) : (
        <Card className="border-dashed text-center">
          <Sparkles className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            {query || kindFilter !== 'all' || scopeFilter !== 'all' || installedOnly
              ? 'No ForgeHub listings match your filters.'
              : 'ForgeHub is empty. Publish a connection as Global or Shared from My connections.'}
          </p>
        </Card>
      )}
    </div>
  )
}

function ForgeHubCard({
  connection: c,
  editable,
  targetSelected,
  busy,
  onAdd,
  onRemove,
}: {
  connection: MarketplaceConnection
  editable: boolean
  targetSelected: boolean
  busy: boolean
  onAdd: () => void
  onRemove: () => void
}) {
  return (
    <article className="group flex aspect-square flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md">
      <div className={cn('relative h-[40%] bg-gradient-to-br', kindAccent(c.kind))}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.4),transparent_45%)]" />
        <div className="absolute left-3 top-3 flex gap-1">
          {c.visibility === 'global' ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-teal-800">
              <Globe className="h-3 w-3" />
              Global
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
              <Share2 className="h-3 w-3" />
              Shared
            </span>
          )}
          {c.linked_to_chatbot ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white">
              <Check className="h-3 w-3" />
              Installed
            </span>
          ) : null}
        </div>
        <div className="absolute bottom-3 left-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/95 text-slate-800 shadow-md ring-1 ring-black/5">
          {<KindIcon kind={c.kind} />}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3 pt-4">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900">{c.name}</h3>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">by {c.chatbot_name ?? 'another chatbot'}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge>{c.kind.toUpperCase()}</Badge>
          <Badge>No secrets shown</Badge>
        </div>
        <p className="text-[10px] text-slate-400">
          Updated {formatDistanceToNow(new Date(c.updated_at), { addSuffix: true })}
        </p>
        {editable ? (
          <div className="mt-auto pt-1">
            {c.linked_to_chatbot ? (
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                disabled={busy || !targetSelected}
                onClick={onRemove}
              >
                Remove install
              </Button>
            ) : (
              <Button
                size="sm"
                className="w-full"
                disabled={busy || !targetSelected}
                onClick={onAdd}
                title={!targetSelected ? 'Select a chatbot first' : 'Install into chatbot'}
              >
                <Plus className="h-3.5 w-3.5" />
                Get
              </Button>
            )}
          </div>
        ) : (
          <p className="mt-auto text-[11px] text-slate-400">Editors can install into a chatbot.</p>
        )}
      </div>
    </article>
  )
}
