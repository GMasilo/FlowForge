import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Puzzle, Trash2 } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import {
  INTEGRATION_CATALOG,
  catalogItem,
  providerLabel,
} from '@/features/integrations/integrationCatalog'
import {
  addIntegrationToChatbot,
  createIntegration,
  getIntegrationSecrets,
  listChatbotIntegrations,
  listInstallableIntegrations,
  removeIntegrationFromChatbot,
  softDeleteIntegration,
  setIntegrationStatus,
  updateIntegration,
} from '@/features/integrations/integrationApi'
import {
  canEdit,
  instanceFeatureEnabled,
  type Integration,
  type IntegrationProvider,
  type IntegrationStatus,
  type Json,
} from '@/shared/types/database'
import { Button } from '@/shared/ui/button'
import { CollapsibleSection } from '@/shared/ui/collapsible-section'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { Badge } from '@/shared/ui/badge'
import { FieldError } from '@/shared/ui/field-error'
import { PlanLockedState } from '@/features/billing/PlanLockedState'

type FormState = {
  id?: string
  provider: IntegrationProvider
  name: string
  status: IntegrationStatus
  config: Record<string, string>
  secrets: Record<string, string>
}

function blankForm(provider: IntegrationProvider = 'google_drive'): FormState {
  const item = catalogItem(provider)
  const config: Record<string, string> = {}
  const secrets: Record<string, string> = {}
  for (const f of item?.configFields ?? []) config[f.key] = ''
  for (const f of item?.secretFields ?? []) secrets[f.key] = ''
  return {
    provider,
    name: item?.label ?? '',
    status: 'disconnected',
    config,
    secrets,
  }
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

function statusBadge(status: IntegrationStatus) {
  if (status === 'connected')
    return <Badge className="bg-emerald-100 text-emerald-800">Connected</Badge>
  if (status === 'error') return <Badge className="bg-rose-100 text-rose-800">Error</Badge>
  return <Badge>Disconnected</Badge>
}

export function ChatbotIntegrationsPanel({ chatbotId }: { chatbotId: string }) {
  const { instance, role } = useRequiredInstance()
  const { user } = useAuth()
  const qc = useQueryClient()
  const editable = canEdit(role)
  const enabled = instanceFeatureEnabled(instance, 'integrations')
  const [sectionOpen, setSectionOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(blankForm())
  const [error, setError] = useState<string | null>(null)

  const installed = useQuery({
    queryKey: ['chatbot-integrations', chatbotId],
    enabled,
    queryFn: () => listChatbotIntegrations(chatbotId),
  })

  const installable = useQuery({
    queryKey: ['installable-integrations', instance.id, chatbotId],
    enabled: enabled && editable,
    queryFn: () => listInstallableIntegrations({ instanceId: instance.id, chatbotId }),
  })

  async function invalidate() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['chatbot-integrations', chatbotId] }),
      qc.invalidateQueries({ queryKey: ['installable-integrations', instance.id, chatbotId] }),
      qc.invalidateQueries({ queryKey: ['integrations', instance.id] }),
      qc.invalidateQueries({ queryKey: ['instance-integrations', instance.id] }),
    ])
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Sign in required')
      const name = form.name.trim()
      if (!name) throw new Error('Name is required')
      const config = form.config as unknown as Json
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
      await invalidate()
    },
    onError: (e: Error) => setError(e.message),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!window.confirm('Delete this integration and its secrets?')) return
      await softDeleteIntegration(id)
    },
    onSuccess: async () => {
      await invalidate()
    },
    onError: (e: Error) => setError(e.message),
  })

  const uninstall = useMutation({
    mutationFn: async (integrationId: string) => {
      if (!window.confirm('Uninstall this integration from this chatbot?')) return
      await removeIntegrationFromChatbot({ chatbotId, integrationId })
    },
    onSuccess: async () => {
      await invalidate()
    },
    onError: (e: Error) => setError(e.message),
  })

  const install = useMutation({
    mutationFn: async (integrationId: string) => {
      if (!user?.id) throw new Error('Sign in required')
      await addIntegrationToChatbot({
        chatbotId,
        integrationId,
        addedBy: user.id,
      })
    },
    onSuccess: async () => {
      await invalidate()
    },
    onError: (e: Error) => setError(e.message),
  })

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: IntegrationStatus }) => {
      await setIntegrationStatus(id, status)
    },
    onSuccess: async () => {
      await invalidate()
    },
  })

  async function startEdit(row: Integration) {
    const item = catalogItem(row.provider)
    const secretsJson = await getIntegrationSecrets(row.id)
    const config = recordFromJson(row.config)
    const secrets = recordFromJson(secretsJson)
    for (const f of item?.configFields ?? []) if (config[f.key] === undefined) config[f.key] = ''
    for (const f of item?.secretFields ?? []) if (secrets[f.key] === undefined) secrets[f.key] = ''
    setForm({
      id: row.id,
      provider: row.provider,
      name: row.name,
      status: row.status,
      config,
      secrets,
    })
    setPicking(false)
    setOpen(true)
    setSectionOpen(true)
    setError(null)
  }

  if (!enabled) {
    return (
      <CollapsibleSection
        open={sectionOpen}
        onOpenChange={setSectionOpen}
        title="Integrations"
        description="Connect Slack, Google Sheets, OneDrive, and other providers for flow steps."
      >
        <PlanLockedState feature="integrations" title="Integrations" />
      </CollapsibleSection>
    )
  }

  const item = catalogItem(form.provider)
  const rows = installed.data ?? []

  return (
    <CollapsibleSection
      open={sectionOpen}
      onOpenChange={setSectionOpen}
      title="Integrations"
      description="Owned by this chatbot, or installed from another chatbot in the organisation. Only installed integrations appear on Integration steps in Design."
      badge={
        rows.length ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {rows.length}
          </span>
        ) : null
      }
      actions={
        editable ? (
          <Button
            size="sm"
            onClick={() => {
              setPicking(true)
              setOpen(false)
              setSectionOpen(true)
              setError(null)
            }}
          >
            <Plus className="h-4 w-4" />
            New integration
          </Button>
        ) : null
      }
    >
      {error ? <FieldError>{error}</FieldError> : null}

      {picking ? (
        <div className="space-y-3 rounded-xl border border-teal-200/70 bg-teal-50/30 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-800">Choose a provider</p>
            <Button type="button" size="sm" variant="secondary" onClick={() => setPicking(false)}>
              Cancel
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {INTEGRATION_CATALOG.map((c) => (
              <button
                key={c.provider}
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:border-teal-300"
                onClick={() => {
                  setForm(blankForm(c.provider))
                  setPicking(false)
                  setOpen(true)
                }}
              >
                <span className="block text-sm font-medium text-slate-800">{c.label}</span>
                <span className="mt-0.5 block text-[11px] text-slate-500">{c.description}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {open ? (
        <form
          className="space-y-3 rounded-xl border border-teal-200/70 bg-teal-50/30 p-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            if (!editable) return
            save.mutate()
          }}
        >
          <p className="text-sm font-medium text-slate-800">
            {form.id ? 'Edit integration' : `Configure ${item?.label ?? form.provider}`}
          </p>
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
          ) : null}

          {(item?.secretFields.length ?? 0) > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {item!.secretFields.map((f) => (
                <div key={f.key} className={f.multiline ? 'sm:col-span-2' : undefined}>
                  <Label>{f.label}</Label>
                  {f.multiline ? (
                    <Textarea
                      autoComplete="off"
                      rows={4}
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
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : form.id ? 'Save changes' : 'Create integration'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {installed.isLoading ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Loading integrations…</p>
      ) : rows.length ? (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-800">{row.name}</span>
                  <Badge>{providerLabel(row.provider)}</Badge>
                  {statusBadge(row.status)}
                  {!row.owned ? <Badge>Installed</Badge> : null}
                </div>
              </div>
              {editable ? (
                <div className="flex flex-wrap gap-1">
                  {row.owned ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => void startEdit(row)}>
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
                      >
                        {row.status === 'connected' ? 'Off' : 'On'}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => remove.mutate(row.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => uninstall.mutate(row.id)}>
                      Uninstall
                    </Button>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--color-ink-muted)]">
          <Puzzle className="mr-1 inline h-4 w-4" />
          No integrations on this chatbot yet. Create one or install from another chatbot below.
        </p>
      )}

      {editable && (installable.data?.length ?? 0) > 0 ? (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Install from organisation
          </p>
          <ul className="space-y-2">
            {installable.data!.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-slate-200 px-3 py-2"
              >
                <div className="min-w-0">
                  <span className="font-medium text-slate-800">{row.name}</span>
                  <span className="ml-2 text-xs text-slate-500">{providerLabel(row.provider)}</span>
                </div>
                <Button size="sm" variant="secondary" disabled={install.isPending} onClick={() => install.mutate(row.id)}>
                  Install
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-[11px] text-slate-500">
        Organisation-wide list (including Slack for Alerts) stays under{' '}
        <Link className="font-medium text-teal-700 hover:underline" to={`/instances/${instance.id}/integrations`}>
          Integrations
        </Link>
        .
      </p>
    </CollapsibleSection>
  )
}
