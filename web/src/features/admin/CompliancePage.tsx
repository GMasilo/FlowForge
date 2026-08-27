import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { downloadJson } from '@/shared/lib/downloadJson'
import { supabase } from '@/shared/lib/supabase'
import type { ConsentPolicy, DataRetentionPolicy } from '@/shared/types/database'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { FieldError } from '@/shared/ui/field-error'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { PageHeader } from '@/shared/ui/page-header'
import { Textarea } from '@/shared/ui/textarea'

export function CompliancePage() {
  const { instance } = useRequiredInstance()
  const qc = useQueryClient()
  const [visitorKey, setVisitorKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [policyForm, setPolicyForm] = useState({
    policy_key: 'privacy',
    title: 'Privacy notice',
    body: '',
  })

  const retention = useQuery({
    queryKey: ['data-retention', instance.id],
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('data_retention_policies')
        .select('*')
        .eq('instance_id', instance.id)
        .maybeSingle()
      if (qError) throw qError
      return data as DataRetentionPolicy | null
    },
  })

  const policies = useQuery({
    queryKey: ['consent-policies', instance.id],
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('consent_policies')
        .select('*')
        .eq('instance_id', instance.id)
        .order('policy_key')
      if (qError) throw qError
      return (data ?? []) as ConsentPolicy[]
    },
  })

  const saveRetention = useMutation({
    mutationFn: async (row: Partial<DataRetentionPolicy>) => {
      const payload = {
        instance_id: instance.id,
        sessions_ttl_days: row.sessions_ttl_days ?? 365,
        events_ttl_days: row.events_ttl_days ?? 365,
        files_ttl_days: row.files_ttl_days ?? 180,
        payment_pii_ttl_days: row.payment_pii_ttl_days ?? 90,
        legal_hold: row.legal_hold ?? false,
        updated_at: new Date().toISOString(),
      }
      const { error: upsertError } = await supabase
        .from('data_retention_policies')
        .upsert(payload, { onConflict: 'instance_id' })
      if (upsertError) throw upsertError
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['data-retention', instance.id] })
    },
  })

  async function exportVisitor(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('export_visitor_data', {
      p_instance_id: instance.id,
      p_visitor_key: visitorKey.trim(),
    })
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    downloadJson(`visitor-export-${visitorKey.trim()}.json`, data)
  }

  async function deleteVisitor() {
    setError(null)
    if (!confirm('Permanently delete all data for this visitor key?')) return
    const { error: rpcError } = await supabase.rpc('delete_visitor_data', {
      p_instance_id: instance.id,
      p_visitor_key: visitorKey.trim(),
    })
    if (rpcError) setError(rpcError.message)
  }

  async function purgeExpired() {
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('purge_expired_conversation_data', {
      p_instance_id: instance.id,
    })
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    alert(`Purged: ${JSON.stringify(data)}`)
  }

  async function addPolicy(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const { error: insertError } = await supabase.from('consent_policies').insert({
      instance_id: instance.id,
      policy_key: policyForm.policy_key.trim(),
      title: policyForm.title.trim(),
      body: policyForm.body.trim(),
      version: 1,
      is_active: true,
    })
    if (insertError) {
      setError(insertError.message)
      return
    }
    setPolicyForm((f) => ({ ...f, body: '' }))
    await qc.invalidateQueries({ queryKey: ['consent-policies', instance.id] })
  }

  const pol = retention.data

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance"
        description="Consent policies, retention, and GDPR export/delete for this organisation."
      />
      {error ? <FieldError>{error}</FieldError> : null}

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Data retention</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ['sessions_ttl_days', 'Sessions TTL (days)'],
              ['events_ttl_days', 'Events TTL (days)'],
              ['files_ttl_days', 'Files TTL (days)'],
              ['payment_pii_ttl_days', 'Payment PII TTL (days)'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="space-y-1 text-xs">
              <Label>{label}</Label>
              <Input
                type="number"
                min={1}
                defaultValue={pol?.[key] ?? 365}
                onBlur={(e) =>
                  saveRetention.mutate({
                    ...pol,
                    [key]: Number(e.target.value) || 365,
                  })
                }
              />
            </label>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!pol?.legal_hold}
            onChange={(e) => saveRetention.mutate({ ...pol, legal_hold: e.target.checked })}
          />
          Legal hold (blocks deletes and purge)
        </label>
        <Button type="button" size="sm" variant="secondary" onClick={() => void purgeExpired()}>
          Run retention purge
        </Button>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Visitor data subject requests</h2>
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => void exportVisitor(e)}>
          <label className="space-y-1 text-xs">
            <Label>Visitor key</Label>
            <Input value={visitorKey} onChange={(e) => setVisitorKey(e.target.value)} className="min-w-[16rem]" />
          </label>
          <Button type="submit" size="sm" disabled={!visitorKey.trim()}>
            Export JSON
          </Button>
          <Button type="button" size="sm" variant="secondary" disabled={!visitorKey.trim()} onClick={() => void deleteVisitor()}>
            Delete data
          </Button>
        </form>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Consent policies</h2>
        <ul className="space-y-2 text-sm">
          {(policies.data ?? []).map((p) => (
            <li key={p.id} className="rounded-lg border border-[var(--color-border)]/60 px-3 py-2">
              <span className="font-medium">{p.title}</span>
              <span className="ml-2 font-mono text-xs text-[var(--color-ink-muted)]">
                {p.policy_key} v{p.version}
              </span>
            </li>
          ))}
        </ul>
        <form className="space-y-2 border-t border-[var(--color-border)]/50 pt-3" onSubmit={(e) => void addPolicy(e)}>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              placeholder="policy_key"
              value={policyForm.policy_key}
              onChange={(e) => setPolicyForm((f) => ({ ...f, policy_key: e.target.value }))}
            />
            <Input
              placeholder="Title"
              value={policyForm.title}
              onChange={(e) => setPolicyForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <Textarea
            rows={4}
            placeholder="Policy body shown at consent step…"
            value={policyForm.body}
            onChange={(e) => setPolicyForm((f) => ({ ...f, body: e.target.value }))}
          />
          <Button type="submit" size="sm" disabled={!policyForm.body.trim()}>
            Add policy
          </Button>
        </form>
      </Card>
    </div>
  )
}
