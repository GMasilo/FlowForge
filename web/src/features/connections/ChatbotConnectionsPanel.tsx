import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Globe, Lock, Pencil, Plus, Share2, Trash2, Users } from 'lucide-react'
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
  createChatbotConnection,
  deleteConnection,
  listOwnedConnections,
  setConnectionShares,
  updateChatbotConnection,
  visibilityLabel,
} from '@/features/connections/connectionApi'
import { canEdit, type ConnectionKind, type ConnectionVisibility } from '@/shared/types/database'
import { supabase } from '@/shared/lib/supabase'
import { Button } from '@/shared/ui/button'
import { CollapsibleSection } from '@/shared/ui/collapsible-section'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import { Badge } from '@/shared/ui/badge'
import { FieldError } from '@/shared/ui/field-error'

type FormState = {
  id?: string
  name: string
  kind: ConnectionKind
  visibility: ConnectionVisibility
  shareUserIds: string[]
  http: HttpConnectionConfig
  email: EmailConnectionConfig
  payment: PaymentConnectionConfig
}

function blankForm(): FormState {
  return {
    name: '',
    kind: 'http',
    visibility: 'private',
    shareUserIds: [],
    http: defaultHttpConfig(),
    email: defaultEmailConfig(),
    payment: defaultPaymentConfig(),
  }
}

export function ChatbotConnectionsPanel({ chatbotId }: { chatbotId: string }) {
  const { instance, role } = useRequiredInstance()
  const { user } = useAuth()
  const qc = useQueryClient()
  const editable = canEdit(role)
  const [open, setOpen] = useState(false)
  const [sectionOpen, setSectionOpen] = useState(false)
  const [form, setForm] = useState<FormState>(blankForm)
  const [error, setError] = useState<string | null>(null)

  const owned = useQuery({
    queryKey: ['owned-connections', chatbotId],
    queryFn: () => listOwnedConnections(chatbotId),
  })

  const members = useQuery({
    queryKey: ['instance-members-profiles', instance.id],
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('instance_members')
        .select('user_id, role, profiles(email, display_name)')
        .eq('instance_id', instance.id)
      if (qError) throw qError
      return data ?? []
    },
  })

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Sign in required')
      const name = form.name.trim()
      if (!name) throw new Error('Name is required')
      const config = connectionConfigToJson(form.kind, form)
      if (form.id) {
        await updateChatbotConnection({
          id: form.id,
          name,
          kind: form.kind,
          config,
          visibility: form.visibility,
        })
        if (form.visibility === 'shared') {
          await setConnectionShares(form.id, form.shareUserIds)
        } else {
          await setConnectionShares(form.id, [])
        }
      } else {
        const created = await createChatbotConnection({
          instanceId: instance.id,
          chatbotId,
          name,
          kind: form.kind,
          config,
          visibility: form.visibility,
          createdBy: user.id,
        })
        if (form.visibility === 'shared' && form.shareUserIds.length) {
          await setConnectionShares(created.id, form.shareUserIds)
        }
      }
    },
    onSuccess: async () => {
      setOpen(false)
      setForm(blankForm())
      setError(null)
      await qc.invalidateQueries({ queryKey: ['owned-connections', chatbotId] })
      await qc.invalidateQueries({ queryKey: ['chatbot-usable-connections', chatbotId] })
      await qc.invalidateQueries({ queryKey: ['marketplace-connections', instance.id] })
    },
    onError: (e: Error) => setError(e.message),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!window.confirm('Delete this connection and its secrets?')) return
      await deleteConnection(id)
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['owned-connections', chatbotId] })
      await qc.invalidateQueries({ queryKey: ['chatbot-usable-connections', chatbotId] })
      await qc.invalidateQueries({ queryKey: ['marketplace-connections', instance.id] })
    },
    onError: (e: Error) => setError(e.message),
  })

  const memberOptions = useMemo(() => {
    return (members.data ?? [])
      .filter((m) => m.user_id !== user?.id)
      .map((m) => {
        const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
        return {
          id: m.user_id as string,
          label: (profile as { display_name?: string | null; email?: string | null } | null)?.display_name
            || (profile as { email?: string | null } | null)?.email
            || m.user_id,
        }
      })
  }, [members.data, user?.id])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!editable) return
    save.mutate()
  }

  async function startEdit(id: string) {
    const row = owned.data?.find((c) => c.id === id)
    if (!row) return
    const { data: shares } = await supabase.from('connection_shares').select('user_id').eq('connection_id', id)
    setForm({
      id: row.id,
      name: row.name,
      kind: row.kind,
      visibility: row.visibility,
      shareUserIds: (shares ?? []).map((s) => s.user_id),
      http: row.kind === 'http' ? parseHttpConfig(row.config) : defaultHttpConfig(),
      email: row.kind === 'email' ? parseEmailConfig(row.config) : defaultEmailConfig(),
      payment: row.kind === 'payment' ? parsePaymentConfig(row.config) : defaultPaymentConfig(),
    })
    setOpen(true)
    setSectionOpen(true)
    setError(null)
  }

  return (
    <CollapsibleSection
      open={sectionOpen}
      onOpenChange={setSectionOpen}
      title="Connections"
      description="Owned by this chatbot. Private by default — promote to global or share with people for ForgeHub."
      badge={
        owned.data?.length ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {owned.data.length}
          </span>
        ) : null
      }
      actions={
        editable ? (
          <Button
            size="sm"
            onClick={() => {
              setForm(blankForm())
              setSectionOpen(true)
              setOpen((v) => !v)
              setError(null)
            }}
          >
            <Plus className="h-4 w-4" />
            New connection
          </Button>
        ) : null
      }
    >
      {error ? <FieldError>{error}</FieldError> : null}

      {open ? (
        <form className="space-y-3 rounded-xl border border-teal-200/70 bg-teal-50/30 p-3" onSubmit={onSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
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
          </div>

          <div>
            <Label>Visibility</Label>
            <Select
              value={form.visibility}
              onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value as ConnectionVisibility }))}
            >
              <option value="private">Private — this chatbot only</option>
              <option value="global">Global — listed in organisation ForgeHub</option>
              <option value="shared">Shared — listed for selected people</option>
            </Select>
            <p className="mt-1 text-[11px] text-slate-500">
              Others never see credentials — only name, kind, and owner.
            </p>
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
      ) : null}

      {owned.isLoading ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Loading connections…</p>
      ) : owned.data?.length ? (
        <ul className="space-y-2">
          {owned.data.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-800">{c.name}</span>
                  <Badge>{c.kind}</Badge>
                  <Badge>
                    {c.visibility === 'private' ? (
                      <Lock className="mr-1 inline h-3 w-3" />
                    ) : c.visibility === 'global' ? (
                      <Globe className="mr-1 inline h-3 w-3" />
                    ) : (
                      <Share2 className="mr-1 inline h-3 w-3" />
                    )}
                    {visibilityLabel(c.visibility)}
                  </Badge>
                </div>
              </div>
              {editable ? (
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" onClick={() => void startEdit(c.id)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => remove.mutate(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--color-ink-muted)]">
          No connections owned by this chatbot yet. Add HTTP or email connections to use in Design.
        </p>
      )}

      <p className="text-[11px] text-slate-500">
        <Users className="mr-1 inline h-3.5 w-3.5" />
        Discover shared connections in{' '}
        <a className="font-medium text-teal-700 hover:underline" href={`/flowforge/instances/${instance.id}/connections`}>
          ForgeHub
        </a>
        .
      </p>
    </CollapsibleSection>
  )
}
