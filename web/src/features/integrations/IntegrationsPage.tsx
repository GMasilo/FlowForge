import { useMemo, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import {
  Box,
  Cloud,
  FileSpreadsheet,
  HardDrive,
  MessageSquare,
  Pencil,
  Plus,
  Puzzle,
  Search,
  Trash2,
  Users,
} from 'lucide-react'
import { PlanLockedState } from '@/features/billing/PlanLockedState'
import { useAuth } from '@/features/auth/AuthProvider'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import {
  INTEGRATION_CATALOG,
  catalogItem,
  providerLabel,
  type IntegrationCatalogItem,
} from '@/features/integrations/integrationCatalog'
import {
  createIntegration,
  listIntegrations,
  getIntegrationSecrets,
  softDeleteIntegration,
  updateIntegration,
  setIntegrationStatus,
} from '@/features/integrations/integrationApi'
import { supabase } from '@/shared/lib/supabase'
import {
  canAdmin,
  instanceFeatureEnabled,
  type Integration,
  type IntegrationProvider,
  type IntegrationStatus,
  type Json,
} from '@/shared/types/database'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { Badge } from '@/shared/ui/badge'
import { FieldError } from '@/shared/ui/field-error'
import { PAGE_HELP } from '@/shared/help/pageHelp'
import { PageHeader } from '@/shared/ui/page-header'
import { cn } from '@/shared/lib/utils'

type FormState = {
  id?: string
  chatbotId: string
  provider: IntegrationProvider
  name: string
  status: IntegrationStatus
  config: Record<string, string>
  secrets: Record<string, string>
}

function blankForm(provider: IntegrationProvider = 'google_drive', chatbotId = ''): FormState {
  const item = catalogItem(provider)
  const config: Record<string, string> = {}
  const secrets: Record<string, string> = {}
  for (const f of item?.configFields ?? []) config[f.key] = ''
  for (const f of item?.secretFields ?? []) secrets[f.key] = ''
  return {
    chatbotId,
    provider,
    name: item?.label ?? '',
    status: 'disconnected',
    config,
    secrets,
  }
}

function ProviderIcon({ provider, className }: { provider: IntegrationProvider; className?: string }) {
  const c = className ?? 'h-6 w-6'
  switch (provider) {
    case 'microsoft_onedrive':
    case 'sharepoint':
      return <Cloud className={c} />
    case 'google_drive':
    case 'dropbox':
    case 'box':
      return <HardDrive className={c} />
    case 's3':
      return <Box className={c} />
    case 'slack':
    case 'microsoft_teams':
      return <MessageSquare className={c} />
    case 'google_sheets':
      return <FileSpreadsheet className={c} />
    case 'notion':
      return <Users className={c} />
    default:
      return <Puzzle className={c} />
  }
}

function providerAccent(provider: IntegrationProvider): string {
  switch (provider) {
    case 'microsoft_onedrive':
    case 'sharepoint':
    case 'microsoft_teams':
      return 'from-blue-500 via-sky-500 to-cyan-500'
    case 'google_drive':
    case 'google_sheets':
      return 'from-emerald-500 via-green-500 to-lime-500'
    case 'dropbox':
      return 'from-sky-600 via-blue-600 to-indigo-500'
    case 'box':
      return 'from-blue-700 via-blue-600 to-sky-500'
    case 'slack':
      return 'from-purple-500 via-fuchsia-500 to-pink-500'
    case 'notion':
      return 'from-slate-700 via-slate-600 to-zinc-500'
    case 's3':
      return 'from-orange-500 via-amber-500 to-yellow-500'
    default:
      return 'from-teal-500 via-cyan-500 to-sky-500'
  }
}

function statusBadge(status: IntegrationStatus) {
  if (status === 'connected')
    return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">Connected</Badge>
  if (status === 'error')
    return <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200">Error</Badge>
  return <Badge>Disconnected</Badge>
}

function recordFromJson(value: Json | null | undefined): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(value)) {
    if (v == null) out[k] = ''
    else if (typeof v === 'string') out[k] = v
    else out[k] = String(v)
  }
  return out
}

export function IntegrationsPage() {
  const { instance, role } = useRequiredInstance()
  const integrationsEnabled = instanceFeatureEnabled(instance, 'integrations')
  const { user } = useAuth()
  const qc = useQueryClient()
  const isAdmin = canAdmin(role)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'all' | IntegrationCatalogItem['category']>('all')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(blankForm())
  const [error, setError] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)

  const chatbots = useQuery({
    queryKey: ['instance-chatbots-for-integrations', instance.id],
    enabled: isAdmin && integrationsEnabled,
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('chatbots')
        .select('id, name')
        .eq('instance_id', instance.id)
        .is('deleted_at', null)
        .order('name')
      if (qError) throw qError
      return data ?? []
    },
  })

  const integrations = useQuery({
    queryKey: ['integrations', instance.id],
    enabled: isAdmin && integrationsEnabled,
    queryFn: () => listIntegrations(instance.id),
  })

  const chatbotNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const b of chatbots.data ?? []) map.set(b.id, b.name)
    return map
  }, [chatbots.data])

  const filtered = useMemo(() => {
    let rows = integrations.data ?? []
    const q = query.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.provider.includes(q) ||
          providerLabel(r.provider).toLowerCase().includes(q),
      )
    }
    if (category !== 'all') {
      rows = rows.filter((r) => catalogItem(r.provider)?.category === category)
    }
    return rows
  }, [integrations.data, query, category])

  const save = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Sign in required')
      const name = form.name.trim()
      if (!name) throw new Error('Name is required')
      const config = form.config as unknown as Json
      // Leave blank secret fields unchanged on edit (password inputs often look empty).
      let secrets = form.secrets as unknown as Json
      if (form.id) {
        const existing = recordFromJson(await getIntegrationSecrets(form.id))
        const merged: Record<string, string> = { ...existing }
        for (const [k, v] of Object.entries(form.secrets)) {
          if (String(v ?? '').trim() !== '') merged[k] = String(v)
        }
        secrets = merged as unknown as Json
        await updateIntegration({
          id: form.id,
          name,
          config,
          secrets,
          status: form.status,
        })
      } else {
        const chatbotId = form.chatbotId.trim()
        if (!chatbotId) throw new Error('Choose the owning chatbot')
        await createIntegration({
          instanceId: instance.id,
          chatbotId,
          provider: form.provider,
          name,
          config,
          secrets,
          status: form.status,
          createdBy: user.id,
        })
      }
    },
    onSuccess: async () => {
      setOpen(false)
      setPicking(false)
      setForm(blankForm())
      setError(null)
      await qc.invalidateQueries({ queryKey: ['integrations', instance.id] })
    },
    onError: (e: Error) => setError(e.message),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!window.confirm('Remove this integration? Flow steps that reference it will stop working until reconfigured.'))
        return
      await softDeleteIntegration(id)
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['integrations', instance.id] })
    },
    onError: (e: Error) => setError(e.message),
  })

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: IntegrationStatus }) => {
      await setIntegrationStatus(id, status)
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['integrations', instance.id] })
    },
  })

  if (!integrationsEnabled) {
    return <PlanLockedState feature="integrations" title="Integrations" />
  }

  if (!isAdmin) {
    return <Navigate to={`/instances/${instance.id}`} replace />
  }

  async function startEdit(row: Integration) {
    const item = catalogItem(row.provider)
    const secretsJson = await getIntegrationSecrets(row.id)
    const config = recordFromJson(row.config)
    const secrets = recordFromJson(secretsJson)
    for (const f of item?.configFields ?? []) if (config[f.key] === undefined) config[f.key] = ''
    for (const f of item?.secretFields ?? []) if (secrets[f.key] === undefined) secrets[f.key] = ''
    setForm({
      id: row.id,
      chatbotId: row.chatbot_id,
      provider: row.provider,
      name: row.name,
      status: row.status,
      config,
      secrets,
    })
    setPicking(false)
    setOpen(true)
    setError(null)
  }

  function startCreate(provider: IntegrationProvider) {
    const defaultChatbotId = form.chatbotId || chatbots.data?.[0]?.id || ''
    setForm(blankForm(provider, defaultChatbotId))
    setPicking(false)
    setOpen(true)
    setError(null)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  const item = catalogItem(form.provider)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description={`Organisation integrations for ${instance.name}. Prefer creating them on a chatbot’s Data → Integrations tab so they install on that bot. Slack accounts here can still power Alerts.`}
        help={PAGE_HELP.integrations}
        actions={
          <Button
            onClick={() => {
              setPicking(true)
              setOpen(false)
              setError(null)
            }}
          >
            <Plus className="h-4 w-4" />
            Add integration
          </Button>
        }
      />

      {error ? <FieldError>{error}</FieldError> : null}

      {picking ? (
        <Card className="space-y-4 border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)]/20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-[var(--color-ink)]">Choose a provider</h2>
            <Button type="button" variant="secondary" size="sm" onClick={() => setPicking(false)}>
              Cancel
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INTEGRATION_CATALOG.map((c) => (
              <button
                key={c.provider}
                type="button"
                onClick={() => startCreate(c.provider)}
                className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left transition hover:border-[var(--color-accent)]/50 hover:shadow-sm"
              >
                <span
                  className={cn(
                    'grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white',
                    providerAccent(c.provider),
                  )}
                >
                  <ProviderIcon provider={c.provider} className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[var(--color-ink)]">{c.label}</span>
                  <span className="mt-0.5 block text-xs text-[var(--color-ink-muted)]">{c.description}</span>
                </span>
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      {open ? (
        <Card className="space-y-3 border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)]/20">
          <h2 className="text-base font-semibold text-[var(--color-ink)]">
            {form.id ? 'Edit integration' : `Configure ${item?.label ?? form.provider}`}
          </h2>
          {item ? <p className="text-sm text-[var(--color-ink-muted)]">{item.description}</p> : null}
          <form className="space-y-3" onSubmit={onSubmit}>
            {!form.id ? (
              <div>
                <Label>Owning chatbot</Label>
                <Select
                  value={form.chatbotId}
                  onChange={(e) => setForm((f) => ({ ...f, chatbotId: e.target.value }))}
                  required
                >
                  <option value="">Select chatbot…</option>
                  {(chatbots.data ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
                  The integration is owned by this chatbot and auto-installed there. Install it on other chatbots from their Data tab.
                </p>
              </div>
            ) : (
              <p className="text-xs text-[var(--color-ink-muted)]">
                Owned by{' '}
                <span className="font-medium text-[var(--color-ink)]">
                  {chatbotNameById.get(form.chatbotId) ?? form.chatbotId}
                </span>
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Display name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as IntegrationStatus }))}
                >
                  <option value="disconnected">Disconnected</option>
                  <option value="connected">Connected</option>
                  <option value="error">Error</option>
                </Select>
              </div>
            </div>

            {(item?.configFields.length ?? 0) > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Settings</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {item!.configFields.map((f) => (
                    <div key={f.key}>
                      <Label>{f.label}</Label>
                      <Input
                        type={f.type === 'url' ? 'url' : 'text'}
                        value={form.config[f.key] ?? ''}
                        placeholder={f.placeholder}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            config: { ...prev.config, [f.key]: e.target.value },
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {(item?.secretFields.length ?? 0) > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
                  Secrets (stored securely, admin-only)
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {item!.secretFields.map((f) => (
                    <div key={f.key} className={f.multiline ? 'sm:col-span-2' : undefined}>
                      <Label>{f.label}</Label>
                      {f.multiline ? (
                        <Textarea
                          autoComplete="off"
                          rows={5}
                          className="font-mono text-xs"
                          value={form.secrets[f.key] ?? ''}
                          placeholder={f.placeholder ?? (form.id ? 'Leave blank to keep existing' : undefined)}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              secrets: { ...prev.secrets, [f.key]: e.target.value },
                            }))
                          }
                        />
                      ) : (
                        <Input
                          type="password"
                          autoComplete="off"
                          value={form.secrets[f.key] ?? ''}
                          placeholder={f.placeholder ?? (form.id ? '••••••••' : undefined)}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              secrets: { ...prev.secrets, [f.key]: e.target.value },
                            }))
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? 'Saving…' : form.id ? 'Save changes' : 'Create integration'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setOpen(false)
                  setForm(blankForm())
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-muted)]" />
          <Input
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search integrations…"
          />
        </div>
        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value as typeof category)}
        >
          <option value="all">All categories</option>
          <option value="storage">Storage</option>
          <option value="productivity">Productivity</option>
          <option value="communication">Communication</option>
          <option value="other">Other</option>
        </Select>
      </div>

      {integrations.isLoading ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Loading integrations…</p>
      ) : filtered.length ? (
        <div className="ff-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((row) => (
            <article
              key={row.id}
              className="ff-hover-lift group flex aspect-square flex-col overflow-hidden rounded-2xl border border-[var(--color-border)]/90 bg-[var(--color-surface)] shadow-[var(--shadow-soft)]"
            >
              <div className={cn('relative h-[38%] bg-gradient-to-br', providerAccent(row.provider))}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35),transparent_50%)]" />
                <div className="absolute bottom-3 left-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/95 text-slate-800 shadow-md">
                  <ProviderIcon provider={row.provider} />
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-2 p-3 pt-4">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-[var(--color-ink)]">{row.name}</h3>
                  <p className="mt-0.5 truncate text-[11px] text-[var(--color-ink-muted)]">
                    {providerLabel(row.provider)}
                    {row.chatbot_id
                      ? ` · ${chatbotNameById.get(row.chatbot_id) ?? 'Chatbot'}`
                      : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">{statusBadge(row.status)}</div>
                <p className="text-[10px] text-[var(--color-ink-muted)]">
                  Updated {formatDistanceToNow(new Date(row.updated_at), { addSuffix: true })}
                </p>
                <div className="mt-auto flex gap-1.5 pt-1">
                  <Button size="sm" variant="secondary" className="flex-1" onClick={() => void startEdit(row)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      toggleStatus.mutate({
                        id: row.id,
                        status: row.status === 'connected' ? 'disconnected' : 'connected',
                      })
                    }
                    title={row.status === 'connected' ? 'Mark disconnected' : 'Mark connected'}
                  >
                    {row.status === 'connected' ? 'Off' : 'On'}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => remove.mutate(row.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Card className="border-dashed text-center">
          <Puzzle className="mx-auto h-8 w-8 text-[var(--color-ink-muted)]" />
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            {query || category !== 'all'
              ? 'No integrations match your filters.'
              : 'No integrations yet. Add OneDrive, Google Drive, or another provider to use in flow steps.'}
          </p>
        </Card>
      )}
    </div>
  )
}
