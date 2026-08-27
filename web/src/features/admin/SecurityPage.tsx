import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { supabase } from '@/shared/lib/supabase'
import type { InstanceRole, InstanceSsoConfig } from '@/shared/types/database'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { FieldError } from '@/shared/ui/field-error'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { PageHeader } from '@/shared/ui/page-header'
import { Select } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'

export function SecurityPage() {
  const { instance } = useRequiredInstance()
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [scimToken, setScimToken] = useState<string | null>(null)
  const [form, setForm] = useState({
    protocol: 'oidc' as 'oidc' | 'saml',
    name: 'Primary IdP',
    domains: '',
    enforce_sso: false,
    enabled: false,
    oidc_issuer: '',
    oidc_client_id: '',
    oidc_authorization_url: '',
    oidc_token_url: '',
    oidc_jwks_url: '',
    saml_entity_id: '',
    saml_sso_url: '',
    saml_certificate: '',
    saml_acs_url: '',
    default_role: 'viewer' as InstanceRole,
  })

  const configs = useQuery({
    queryKey: ['sso-configs', instance.id],
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('instance_sso_configs')
        .select('*')
        .eq('instance_id', instance.id)
        .order('updated_at', { ascending: false })
      if (qError) throw qError
      return (data ?? []) as InstanceSsoConfig[]
    },
  })

  const tokens = useQuery({
    queryKey: ['scim-tokens', instance.id],
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('instance_scim_tokens')
        .select('id, name, token_prefix, created_at, last_used_at, revoked_at')
        .eq('instance_id', instance.id)
        .order('created_at', { ascending: false })
      if (qError) throw qError
      return data ?? []
    },
  })

  async function saveConfig(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const domains = form.domains
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean)
    const { error: insertError } = await supabase.from('instance_sso_configs').insert({
      instance_id: instance.id,
      protocol: form.protocol,
      name: form.name.trim(),
      domains,
      enforce_sso: form.enforce_sso,
      enabled: form.enabled,
      oidc_issuer: form.oidc_issuer || null,
      oidc_client_id: form.oidc_client_id || null,
      oidc_authorization_url: form.oidc_authorization_url || null,
      oidc_token_url: form.oidc_token_url || null,
      oidc_jwks_url: form.oidc_jwks_url || null,
      saml_entity_id: form.saml_entity_id || null,
      saml_sso_url: form.saml_sso_url || null,
      saml_certificate: form.saml_certificate || null,
      saml_acs_url: form.saml_acs_url || null,
      default_role: form.default_role === 'owner' ? 'admin' : form.default_role,
    })
    if (insertError) {
      setError(insertError.message)
      return
    }
    await qc.invalidateQueries({ queryKey: ['sso-configs', instance.id] })
  }

  const createToken = useMutation({
    mutationFn: async () => {
      const { data, error: rpcError } = await supabase.rpc('create_scim_token', {
        p_instance_id: instance.id,
        p_name: 'default',
      })
      if (rpcError) throw rpcError
      return data as { token?: string; prefix?: string }
    },
    onSuccess: async (data) => {
      setScimToken(data.token ?? null)
      await qc.invalidateQueries({ queryKey: ['scim-tokens', instance.id] })
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security · SSO / SCIM"
        description="Configure OIDC and SAML enterprise login, and SCIM provisioning tokens."
      />
      {error ? <FieldError>{error}</FieldError> : null}

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Existing SSO configs</h2>
        <ul className="space-y-2 text-sm">
          {(configs.data ?? []).map((c) => (
            <li key={c.id} className="rounded-lg border border-[var(--color-border)]/60 px-3 py-2">
              <span className="font-medium">{c.name}</span>
              <span className="ml-2 uppercase text-xs text-[var(--color-ink-muted)]">{c.protocol}</span>
              {c.enabled ? (
                <span className="ml-2 text-xs text-teal-700">enabled</span>
              ) : (
                <span className="ml-2 text-xs text-amber-700">disabled</span>
              )}
              <p className="text-xs text-[var(--color-ink-muted)]">{(c.domains ?? []).join(', ')}</p>
            </li>
          ))}
          {!configs.data?.length ? (
            <p className="text-sm text-[var(--color-ink-muted)]">No SSO configs yet.</p>
          ) : null}
        </ul>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Add SSO config</h2>
        <form className="space-y-3" onSubmit={(e) => void saveConfig(e)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs">
              <Label>Protocol</Label>
              <Select
                value={form.protocol}
                onChange={(e) => setForm((f) => ({ ...f, protocol: e.target.value as 'oidc' | 'saml' }))}
              >
                <option value="oidc">OIDC</option>
                <option value="saml">SAML</option>
              </Select>
            </label>
            <label className="space-y-1 text-xs">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </label>
            <label className="space-y-1 text-xs sm:col-span-2">
              <Label>Email domains (comma-separated)</Label>
              <Input
                value={form.domains}
                onChange={(e) => setForm((f) => ({ ...f, domains: e.target.value }))}
                placeholder="acme.com, acme.co.uk"
              />
            </label>
            <label className="space-y-1 text-xs">
              <Label>Default role</Label>
              <Select
                value={form.default_role}
                onChange={(e) => setForm((f) => ({ ...f, default_role: e.target.value as InstanceRole }))}
              >
                <option value="viewer">viewer</option>
                <option value="editor">editor</option>
                <option value="admin">admin</option>
              </Select>
            </label>
          </div>

          {form.protocol === 'oidc' ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                placeholder="Issuer"
                value={form.oidc_issuer}
                onChange={(e) => setForm((f) => ({ ...f, oidc_issuer: e.target.value }))}
              />
              <Input
                placeholder="Client ID"
                value={form.oidc_client_id}
                onChange={(e) => setForm((f) => ({ ...f, oidc_client_id: e.target.value }))}
              />
              <Input
                placeholder="Authorization URL"
                value={form.oidc_authorization_url}
                onChange={(e) => setForm((f) => ({ ...f, oidc_authorization_url: e.target.value }))}
              />
              <Input
                placeholder="Token URL"
                value={form.oidc_token_url}
                onChange={(e) => setForm((f) => ({ ...f, oidc_token_url: e.target.value }))}
              />
              <Input
                placeholder="JWKS URL"
                value={form.oidc_jwks_url}
                onChange={(e) => setForm((f) => ({ ...f, oidc_jwks_url: e.target.value }))}
                className="sm:col-span-2"
              />
            </div>
          ) : (
            <div className="grid gap-2">
              <Input
                placeholder="Entity ID"
                value={form.saml_entity_id}
                onChange={(e) => setForm((f) => ({ ...f, saml_entity_id: e.target.value }))}
              />
              <Input
                placeholder="SSO URL"
                value={form.saml_sso_url}
                onChange={(e) => setForm((f) => ({ ...f, saml_sso_url: e.target.value }))}
              />
              <Input
                placeholder="ACS URL"
                value={form.saml_acs_url}
                onChange={(e) => setForm((f) => ({ ...f, saml_acs_url: e.target.value }))}
              />
              <Textarea
                rows={3}
                placeholder="IdP certificate (PEM)"
                value={form.saml_certificate}
                onChange={(e) => setForm((f) => ({ ...f, saml_certificate: e.target.value }))}
              />
            </div>
          )}

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
              />
              Enabled
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.enforce_sso}
                onChange={(e) => setForm((f) => ({ ...f, enforce_sso: e.target.checked }))}
              />
              Enforce SSO for listed domains
            </label>
          </div>
          <Button type="submit" size="sm">
            Save SSO config
          </Button>
        </form>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">SCIM 2.0</h2>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Point your IdP SCIM client at <code className="text-xs">/api/scim/v2/</code> with a bearer token.
        </p>
        <ul className="space-y-1 text-sm">
          {(tokens.data ?? []).map((t) => (
            <li key={t.id as string}>
              {t.name as string} · prefix {t.token_prefix as string}
              {t.revoked_at ? ' (revoked)' : ''}
            </li>
          ))}
        </ul>
        <Button size="sm" variant="secondary" disabled={createToken.isPending} onClick={() => createToken.mutate()}>
          Create SCIM token
        </Button>
        {scimToken ? (
          <p className="rounded-lg bg-amber-50 p-2 font-mono text-xs text-amber-950">
            Copy now — shown once: {scimToken}
          </p>
        ) : null}
      </Card>
    </div>
  )
}
