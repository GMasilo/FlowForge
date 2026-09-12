import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { PlanLockedState } from '@/features/billing/PlanLockedState'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { canAdmin, instanceFeatureEnabled, type AgentQueue, type Json } from '@/shared/types/database'
import { supabase } from '@/shared/lib/supabase'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { FieldError } from '@/shared/ui/field-error'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { PAGE_HELP, SECTION_HELP } from '@/shared/help/pageHelp'
import { SectionHeading } from '@/shared/ui/help-tooltip'
import { PageHeader } from '@/shared/ui/page-header'
import { Textarea } from '@/shared/ui/textarea'

type RoutingRules = {
  requiredSkills: string[]
  matchAny: boolean
  autoAssign: boolean
  priorityBoost?: number
}

type AgentProfileRow = {
  user_id: string
  display_name: string | null
  skills: string[]
  max_concurrent: number
}

type OrgUser = {
  user_id: string
  email: string | null
  role: string
}

function parseRoutingRules(raw: unknown): RoutingRules {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const skillsRaw = o.requiredSkills
  const skills = Array.isArray(skillsRaw)
    ? skillsRaw.map((s) => String(s ?? '').trim()).filter(Boolean)
    : []
  return {
    requiredSkills: skills,
    matchAny: o.matchAny === true,
    autoAssign: o.autoAssign !== false,
    priorityBoost: typeof o.priorityBoost === 'number' ? o.priorityBoost : undefined,
  }
}

export function AgentConsolePage() {
  const { instance, role } = useRequiredInstance()
  const agentConsoleEnabled = instanceFeatureEnabled(instance, 'agent_console')
  const qc = useQueryClient()
  const editable = canAdmin(role)
  const [error, setError] = useState<string | null>(null)
  const [queueForm, setQueueForm] = useState({
    name: '',
    description: '',
    slaFirst: 300,
    slaResolve: 3600,
    skills: '',
    matchAny: false,
    autoAssign: true,
    isDefault: false,
  })

  const queues = useQuery({
    queryKey: ['agent-queues', instance.id],
    enabled: agentConsoleEnabled,
    queryFn: async () => {
      await supabase.rpc('ensure_default_agent_queue', { p_instance_id: instance.id })
      const { data, error: qError } = await supabase
        .from('agent_queues')
        .select('*')
        .eq('instance_id', instance.id)
        .order('name')
      if (qError) throw qError
      return (data ?? []) as AgentQueue[]
    },
  })

  const members = useQuery({
    queryKey: ['org-users-agent-console', instance.id],
    queryFn: async () => {
      const { data, error: qError } = await supabase.rpc('list_organisation_users', {
        p_instance_id: instance.id,
      })
      if (qError) throw qError
      const rows = Array.isArray(data) ? data : []
      return rows as OrgUser[]
    },
  })

  const profiles = useQuery({
    queryKey: ['agent-profiles', instance.id],
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('agent_profiles')
        .select('user_id, display_name, skills, max_concurrent')
        .eq('instance_id', instance.id)
      if (qError) throw qError
      return (data ?? []) as AgentProfileRow[]
    },
  })

  const operators = useMemo(() => {
    return (members.data ?? []).filter((m) =>
      ['owner', 'admin', 'editor', 'agent'].includes(m.role),
    )
  }, [members.data])

  const profileByUser = useMemo(() => {
    const map = new Map<string, AgentProfileRow>()
    for (const p of profiles.data ?? []) map.set(p.user_id, p)
    return map
  }, [profiles.data])

  const createQueue = useMutation({
    mutationFn: async () => {
      const name = queueForm.name.trim()
      if (!name) throw new Error('Queue name is required')
      const skills = queueForm.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const routing_rules = {
        requiredSkills: skills,
        matchAny: queueForm.matchAny,
        autoAssign: queueForm.autoAssign,
      }
      if (queueForm.isDefault) {
        await supabase
          .from('agent_queues')
          .update({ is_default: false })
          .eq('instance_id', instance.id)
          .eq('is_default', true)
      }
      const { error: insertError } = await supabase.from('agent_queues').insert({
        instance_id: instance.id,
        name,
        description: queueForm.description.trim() || null,
        sla_first_response_seconds: queueForm.slaFirst,
        sla_resolve_seconds: queueForm.slaResolve,
        routing_rules,
        is_default: queueForm.isDefault,
      })
      if (insertError) throw insertError
    },
    onSuccess: async () => {
      setQueueForm({
        name: '',
        description: '',
        slaFirst: 300,
        slaResolve: 3600,
        skills: '',
        matchAny: false,
        autoAssign: true,
        isDefault: false,
      })
      setError(null)
      await qc.invalidateQueries({ queryKey: ['agent-queues', instance.id] })
    },
    onError: (e: Error) => setError(e.message),
  })

  const updateQueue = useMutation({
    mutationFn: async (args: {
      id: string
      patch: Partial<AgentQueue> & { routing_rules?: RoutingRules }
    }) => {
      if (args.patch.is_default) {
        await supabase
          .from('agent_queues')
          .update({ is_default: false })
          .eq('instance_id', instance.id)
          .eq('is_default', true)
      }
      const patch = {
        ...args.patch,
        updated_at: new Date().toISOString(),
        ...(args.patch.routing_rules
          ? { routing_rules: args.patch.routing_rules as unknown as Json }
          : {}),
      }
      const { error: upError } = await supabase
        .from('agent_queues')
        .update(patch)
        .eq('id', args.id)
        .eq('instance_id', instance.id)
      if (upError) throw upError
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['agent-queues', instance.id] })
    },
    onError: (e: Error) => setError(e.message),
  })

  const deleteQueue = useMutation({
    mutationFn: async (id: string) => {
      const row = (queues.data ?? []).find((q) => q.id === id)
      if (row?.is_default) throw new Error('Cannot delete the default queue')
      const { error: delError } = await supabase
        .from('agent_queues')
        .delete()
        .eq('id', id)
        .eq('instance_id', instance.id)
      if (delError) throw delError
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['agent-queues', instance.id] })
    },
    onError: (e: Error) => setError(e.message),
  })

  const saveProfile = useMutation({
    mutationFn: async (args: {
      userId: string
      displayName: string
      skills: string[]
      maxConcurrent: number
    }) => {
      const { error: upError } = await supabase.from('agent_profiles').upsert(
        {
          instance_id: instance.id,
          user_id: args.userId,
          display_name: args.displayName.trim() || null,
          skills: args.skills,
          max_concurrent: Math.max(1, args.maxConcurrent),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'instance_id,user_id' },
      )
      if (upError) throw upError
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['agent-profiles', instance.id] })
    },
    onError: (e: Error) => setError(e.message),
  })

  async function onCreateQueue(e: FormEvent) {
    e.preventDefault()
    setError(null)
    createQueue.mutate()
  }

  if (!agentConsoleEnabled) {
    return <PlanLockedState feature="agent_console" title="Agent console" />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent console"
        description="Queues, routing skills, and agent concurrency for the live inbox."
        help={PAGE_HELP.agentConsole}
      />

      {error ? <FieldError>{error}</FieldError> : null}

      <Card>
        <SectionHeading title="Queues" help={SECTION_HELP.queues} size="lg" className="mt-0" />
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Handoff steps can target a queue. Routing rules match agent skills for auto-assign when
          agents are online and under their concurrency limit.
        </p>

        {editable ? (
          <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={onCreateQueue}>
            <div>
              <Label>Name</Label>
              <Input
                value={queueForm.name}
                onChange={(e) => setQueueForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label>Required skills (comma-separated)</Label>
              <Input
                value={queueForm.skills}
                onChange={(e) => setQueueForm((f) => ({ ...f, skills: e.target.value }))}
                placeholder="billing, refunds"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={queueForm.description}
                onChange={(e) => setQueueForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <Label>First-response SLA (seconds)</Label>
              <Input
                type="number"
                min={30}
                value={queueForm.slaFirst}
                onChange={(e) => setQueueForm((f) => ({ ...f, slaFirst: Number(e.target.value) || 300 }))}
              />
            </div>
            <div>
              <Label>Resolve SLA (seconds)</Label>
              <Input
                type="number"
                min={60}
                value={queueForm.slaResolve}
                onChange={(e) =>
                  setQueueForm((f) => ({ ...f, slaResolve: Number(e.target.value) || 3600 }))
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={queueForm.matchAny}
                onChange={(e) => setQueueForm((f) => ({ ...f, matchAny: e.target.checked }))}
              />
              Match any required skill (otherwise all)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={queueForm.autoAssign}
                onChange={(e) => setQueueForm((f) => ({ ...f, autoAssign: e.target.checked }))}
              />
              Auto-assign when escalating
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={queueForm.isDefault}
                onChange={(e) => setQueueForm((f) => ({ ...f, isDefault: e.target.checked }))}
              />
              Make default queue
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" size="sm" disabled={createQueue.isPending}>
                <Plus className="h-3.5 w-3.5" />
                Add queue
              </Button>
            </div>
          </form>
        ) : null}

        <ul className="mt-6 divide-y divide-[var(--color-border)]">
          {(queues.data ?? []).map((q) => {
            const rules = parseRoutingRules(q.routing_rules)
            return (
              <li key={q.id} className="space-y-3 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {q.name}
                      {q.is_default ? (
                        <span className="ml-2 text-xs font-normal text-[var(--color-ink-muted)]">
                          default
                        </span>
                      ) : null}
                    </div>
                    {q.description ? (
                      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{q.description}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                      SLA first {q.sla_first_response_seconds}s · resolve {q.sla_resolve_seconds}s ·
                      skills {rules.requiredSkills.length ? rules.requiredSkills.join(', ') : 'any'} ·
                      auto-assign {rules.autoAssign ? 'on' : 'off'}
                    </p>
                  </div>
                  {editable && !q.is_default ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteQueue.mutate(q.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
                {editable ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Input
                      defaultValue={rules.requiredSkills.join(', ')}
                      placeholder="skills"
                      onBlur={(e) => {
                        const skills = e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean)
                        updateQueue.mutate({
                          id: q.id,
                          patch: {
                            routing_rules: {
                              ...rules,
                              requiredSkills: skills,
                            },
                          },
                        })
                      }}
                    />
                    <Input
                      type="number"
                      defaultValue={q.sla_first_response_seconds}
                      onBlur={(e) => {
                        const n = Number(e.target.value)
                        if (!n || n === q.sla_first_response_seconds) return
                        updateQueue.mutate({
                          id: q.id,
                          patch: { sla_first_response_seconds: n },
                        })
                      }}
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={rules.autoAssign}
                        onChange={(e) =>
                          updateQueue.mutate({
                            id: q.id,
                            patch: {
                              routing_rules: { ...rules, autoAssign: e.target.checked },
                            },
                          })
                        }
                      />
                      Auto-assign
                    </label>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      </Card>

      <Card>
        <SectionHeading title="Agent profiles" help={SECTION_HELP.agentProfiles} size="lg" className="mt-0" />
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Skills must match queue routing rules for auto-assign. Max concurrent limits claim and
          assign.
        </p>
        <ul className="mt-4 divide-y divide-[var(--color-border)]">
          {operators.map((m) => {
            const profile = profileByUser.get(m.user_id)
            const skills = (profile?.skills ?? []).join(', ')
            return (
              <li key={m.user_id} className="grid gap-3 py-4 sm:grid-cols-4 sm:items-end">
                <div className="sm:col-span-1">
                  <div className="text-sm font-medium">{m.email || m.user_id}</div>
                  <div className="text-xs text-[var(--color-ink-muted)]">{m.role}</div>
                </div>
                <div>
                  <Label>Display name</Label>
                  <Input
                    disabled={!editable}
                    defaultValue={profile?.display_name ?? ''}
                    id={`dn-${m.user_id}`}
                  />
                </div>
                <div>
                  <Label>Skills</Label>
                  <Input
                    disabled={!editable}
                    defaultValue={skills}
                    placeholder="billing, refunds"
                    id={`sk-${m.user_id}`}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label>Max concurrent</Label>
                    <Input
                      disabled={!editable}
                      type="number"
                      min={1}
                      defaultValue={profile?.max_concurrent ?? 5}
                      id={`mc-${m.user_id}`}
                    />
                  </div>
                  {editable ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        const dn = (document.getElementById(`dn-${m.user_id}`) as HTMLInputElement)
                          ?.value
                        const sk = (document.getElementById(`sk-${m.user_id}`) as HTMLInputElement)
                          ?.value
                        const mc = Number(
                          (document.getElementById(`mc-${m.user_id}`) as HTMLInputElement)?.value,
                        )
                        saveProfile.mutate({
                          userId: m.user_id,
                          displayName: dn ?? '',
                          skills: (sk ?? '')
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                          maxConcurrent: mc || 5,
                        })
                      }}
                    >
                      Save
                    </Button>
                  ) : null}
                </div>
              </li>
            )
          })}
          {!operators.length ? (
            <li className="py-4 text-sm text-[var(--color-ink-muted)]">No operators yet.</li>
          ) : null}
        </ul>
      </Card>
    </div>
  )
}
