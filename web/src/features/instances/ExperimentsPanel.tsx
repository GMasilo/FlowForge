import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { canEdit, type FlowExperiment, type FlowExperimentVariant } from '@/shared/types/database'
import { supabase } from '@/shared/lib/supabase'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { FieldError } from '@/shared/ui/field-error'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'

type Props = { chatbotId?: string }

export function ExperimentsPanel({ chatbotId }: Props) {
  const { instance, role } = useRequiredInstance()
  const qc = useQueryClient()
  const editable = canEdit(role)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [selectedBot, setSelectedBot] = useState(chatbotId ?? '')

  const bots = useQuery({
    queryKey: ['chatbots-lite', instance.id],
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('chatbots')
        .select('id, name, chatbot_flows(id, version)')
        .eq('instance_id', instance.id)
        .is('deleted_at', null)
      if (qError) throw qError
      return data ?? []
    },
  })

  const experiments = useQuery({
    queryKey: ['flow-experiments', instance.id],
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('flow_experiments')
        .select('*')
        .eq('instance_id', instance.id)
        .order('updated_at', { ascending: false })
      if (qError) throw qError
      return (data ?? []) as FlowExperiment[]
    },
  })

  const funnel = useQuery({
    queryKey: ['analytics-funnel', instance.id],
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('analytics_step_funnel_daily')
        .select('*')
        .eq('instance_id', instance.id)
        .limit(500)
      if (qError) throw qError
      return data ?? []
    },
  })

  const cohorts = useQuery({
    queryKey: ['analytics-cohorts', instance.id],
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('analytics_cohort_weekly')
        .select('*')
        .eq('instance_id', instance.id)
        .order('cohort_week', { ascending: false })
        .limit(12)
      if (qError) throw qError
      return data ?? []
    },
  })

  const revenue = useQuery({
    queryKey: ['analytics-revenue', instance.id],
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('analytics_revenue_daily')
        .select('*')
        .eq('instance_id', instance.id)
        .limit(200)
      if (qError) throw qError
      return data ?? []
    },
  })

  const createExperiment = useMutation({
    mutationFn: async () => {
      const bot = (bots.data ?? []).find((b) => b.id === selectedBot)
      const flowRaw = bot?.chatbot_flows
      const flow = Array.isArray(flowRaw) ? flowRaw[0] : flowRaw
      if (!bot || !flow?.id) throw new Error('Select a chatbot with a flow')
      const { data: exp, error: insertError } = await supabase
        .from('flow_experiments')
        .insert({
          flow_id: flow.id,
          instance_id: instance.id,
          chatbot_id: bot.id,
          name: name.trim(),
          status: 'draft',
          traffic_split: { control: 50, treatment: 50 },
          primary_metric: 'completion',
        })
        .select('*')
        .single()
      if (insertError) throw insertError

      const variants: Omit<FlowExperimentVariant, 'id' | 'created_at'>[] = [
        {
          experiment_id: exp.id,
          variant_key: 'control',
          label: 'Control',
          publish_version_id: null,
          published_graph: null,
          weight: 50,
          is_control: true,
        },
        {
          experiment_id: exp.id,
          variant_key: 'treatment',
          label: 'Treatment',
          publish_version_id: null,
          published_graph: null,
          weight: 50,
          is_control: false,
        },
      ]
      const { error: varError } = await supabase.from('flow_experiment_variants').insert(variants)
      if (varError) throw varError
    },
    onSuccess: async () => {
      setName('')
      await qc.invalidateQueries({ queryKey: ['flow-experiments', instance.id] })
    },
    onError: (e: Error) => setError(e.message),
  })

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error: rpcError } = await supabase.rpc('set_experiment_status', {
        p_experiment_id: id,
        p_status: status,
      })
      if (rpcError) throw rpcError
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['flow-experiments', instance.id] })
    },
    onError: (e: Error) => setError(e.message),
  })

  const [statsId, setStatsId] = useState<string | null>(null)
  const stats = useQuery({
    queryKey: ['experiment-stats', statsId],
    enabled: !!statsId,
    queryFn: async () => {
      const { data, error: rpcError } = await supabase.rpc('get_experiment_stats', {
        p_experiment_id: statsId!,
      })
      if (rpcError) throw rpcError
      return data
    },
  })

  const funnelTop = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of funnel.data ?? []) {
      const botId = String((row as { chatbot_id?: string }).chatbot_id ?? '')
      if (chatbotId && botId && botId !== chatbotId) continue
      const key = String((row as { node_key?: string }).node_key ?? '')
      const n = Number((row as { sessions_reached?: number }).sessions_reached ?? 0)
      map.set(key, (map.get(key) ?? 0) + n)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [funnel.data, chatbotId])

  const visibleExperiments = useMemo(() => {
    const rows = experiments.data ?? []
    if (!chatbotId) return rows
    return rows.filter((e) => e.chatbot_id === chatbotId)
  }, [experiments.data, chatbotId])

  const visibleCohorts = useMemo(() => {
    const rows = cohorts.data ?? []
    if (!chatbotId) return rows
    return rows.filter((c) => String((c as { chatbot_id?: string }).chatbot_id ?? '') === chatbotId)
  }, [cohorts.data, chatbotId])

  const visibleRevenue = useMemo(() => {
    const rows = revenue.data ?? []
    if (!chatbotId) return rows
    return rows.filter((r) => String((r as { chatbot_id?: string }).chatbot_id ?? '') === chatbotId)
  }, [revenue.data, chatbotId])

  function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !selectedBot) return
    createExperiment.mutate()
  }

  return (
    <div className="space-y-4">
      {error ? <FieldError>{error}</FieldError> : null}

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Server analytics</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          <div>
            <p className="text-[11px] font-semibold uppercase text-[var(--color-ink-muted)]">Funnel by step</p>
            <ul className="mt-1 space-y-1 text-xs">
              {funnelTop.map(([node, n]) => (
                <li key={node} className="flex justify-between gap-2 font-mono">
                  <span className="truncate">{node || '(empty)'}</span>
                  <span>{n}</span>
                </li>
              ))}
              {!funnelTop.length ? <li className="text-[var(--color-ink-muted)]">No step.run data yet</li> : null}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase text-[var(--color-ink-muted)]">Weekly cohorts</p>
            <ul className="mt-1 space-y-1 text-xs">
              {(visibleCohorts).slice(0, 6).map((c) => {
                const row = c as {
                  cohort_week?: string
                  sessions_started?: number
                  sessions_completed?: number
                }
                return (
                  <li key={String(row.cohort_week)}>
                    {row.cohort_week}: {row.sessions_completed}/{row.sessions_started} completed
                  </li>
                )
              })}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase text-[var(--color-ink-muted)]">Revenue by node</p>
            <ul className="mt-1 space-y-1 text-xs">
              {(visibleRevenue).slice(0, 6).map((r, i) => {
                const row = r as { node_key?: string; revenue_amount?: number; currency?: string }
                return (
                  <li key={`${row.node_key}-${i}`}>
                    {row.node_key}: {row.revenue_amount} {row.currency}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">A/B experiments</h2>
        <ul className="space-y-2">
          {(visibleExperiments).map((exp) => (
            <li
              key={exp.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)]/60 px-3 py-2 text-sm"
            >
              <span className="font-medium">{exp.name}</span>
              <span className="text-xs uppercase text-[var(--color-ink-muted)]">{exp.status}</span>
              {editable ? (
                <>
                  {exp.status !== 'running' ? (
                    <Button size="sm" variant="secondary" onClick={() => setStatus.mutate({ id: exp.id, status: 'running' })}>
                      Start
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => setStatus.mutate({ id: exp.id, status: 'paused' })}>
                      Pause
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setStatsId(exp.id)}>
                    Stats
                  </Button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
        {statsId && stats.data ? (
          <pre className="overflow-auto rounded-lg bg-[var(--color-surface-2)] p-2 font-mono text-[11px]">
            {JSON.stringify(stats.data, null, 2)}
          </pre>
        ) : null}
        {editable ? (
          <form className="flex flex-wrap items-end gap-2 border-t border-[var(--color-border)]/50 pt-3" onSubmit={onCreate}>
            <label className="space-y-1 text-xs">
              <Label>Chatbot</Label>
              <Select value={selectedBot} onChange={(e) => setSelectedBot(e.target.value)}>
                <option value="">Select…</option>
                {(bots.data ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-1 text-xs">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Homepage CTA test" />
            </label>
            <Button type="submit" size="sm" disabled={!name.trim() || !selectedBot || createExperiment.isPending}>
              Create draft experiment
            </Button>
          </form>
        ) : null}
      </Card>
    </div>
  )
}
