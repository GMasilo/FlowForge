import { Plus, Trash2 } from 'lucide-react'
import {
  EMAIL_ENCRYPTION_OPTIONS,
  HTTP_AUTH_OPTIONS,
  PAYMENT_PROVIDER_OPTIONS,
  type EmailConnectionConfig,
  type HttpConnectionConfig,
  type PaymentConnectionConfig,
} from '@/features/connections/connectionConfig'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'

interface HttpFieldsProps {
  value: HttpConnectionConfig
  onChange: (next: HttpConnectionConfig) => void
  disabled?: boolean
}

export function HttpConnectionFields({ value, onChange, disabled }: HttpFieldsProps) {
  function patch(partial: Partial<HttpConnectionConfig>) {
    onChange({ ...value, ...partial })
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Base URL</Label>
        <Input
          value={value.baseUrl}
          onChange={(e) => patch({ baseUrl: e.target.value })}
          placeholder="https://api.example.com"
          required
          disabled={disabled}
        />
        <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
          Shared root for all requests using this connection.
        </p>
      </div>

      <div>
        <Label>Authentication</Label>
        <Select
          value={value.authType}
          disabled={disabled}
          onChange={(e) => patch({ authType: e.target.value as HttpConnectionConfig['authType'] })}
        >
          {HTTP_AUTH_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
          {HTTP_AUTH_OPTIONS.find((o) => o.value === value.authType)?.hint}
        </p>
      </div>

      {value.authType === 'basic' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Username</Label>
            <Input
              value={value.username}
              onChange={(e) => patch({ username: e.target.value })}
              autoComplete="off"
              disabled={disabled}
              required
            />
          </div>
          <div>
            <Label>Password</Label>
            <Input
              type="password"
              value={value.password}
              onChange={(e) => patch({ password: e.target.value })}
              autoComplete="new-password"
              disabled={disabled}
              required
            />
          </div>
        </div>
      ) : null}

      {value.authType === 'api_key' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Header name</Label>
            <Input
              value={value.apiKeyHeader}
              onChange={(e) => patch({ apiKeyHeader: e.target.value })}
              placeholder="X-API-Key"
              disabled={disabled}
              required
            />
          </div>
          <div>
            <Label>API key</Label>
            <Input
              type="password"
              value={value.apiKey}
              onChange={(e) => patch({ apiKey: e.target.value })}
              autoComplete="new-password"
              disabled={disabled}
              required
            />
          </div>
        </div>
      ) : null}

      {value.authType === 'bearer' ? (
        <div>
          <Label>Bearer token</Label>
          <Input
            type="password"
            value={value.bearerToken}
            onChange={(e) => patch({ bearerToken: e.target.value })}
            autoComplete="new-password"
            disabled={disabled}
            required
          />
        </div>
      ) : null}

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <Label className="mb-0">Default headers</Label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={() => patch({ headers: [...value.headers, { key: '', value: '' }] })}
          >
            <Plus className="h-3.5 w-3.5" />
            Add header
          </Button>
        </div>
        {value.headers.length ? (
          <div className="space-y-2">
            {value.headers.map((header, index) => (
              <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <Input
                  placeholder="Header name"
                  value={header.key}
                  disabled={disabled}
                  onChange={(e) => {
                    const headers = value.headers.map((h, i) =>
                      i === index ? { ...h, key: e.target.value } : h,
                    )
                    patch({ headers })
                  }}
                />
                <Input
                  placeholder="Value"
                  value={header.value}
                  disabled={disabled}
                  onChange={(e) => {
                    const headers = value.headers.map((h, i) =>
                      i === index ? { ...h, value: e.target.value } : h,
                    )
                    patch({ headers })
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={disabled}
                  aria-label="Remove header"
                  onClick={() => patch({ headers: value.headers.filter((_, i) => i !== index) })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-ink-muted)]">
            No extra headers. Add Content-Type, Accept, or custom values if needed.
          </p>
        )}
      </div>

      <div className="max-w-[200px]">
        <Label>Timeout (ms)</Label>
        <Input
          type="number"
          min={1000}
          step={1000}
          value={value.timeoutMs}
          disabled={disabled}
          onChange={(e) => patch({ timeoutMs: Number(e.target.value) || 30000 })}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Default method</Label>
          <Select
            value={value.defaultMethod}
            disabled={disabled}
            onChange={(e) =>
              patch({ defaultMethod: e.target.value as HttpConnectionConfig['defaultMethod'] })
            }
          >
            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Default path</Label>
          <Input
            value={value.defaultPath}
            disabled={disabled}
            onChange={(e) => patch({ defaultPath: e.target.value })}
            placeholder="/users/{userId}"
          />
        </div>
      </div>
    </div>
  )
}

interface EmailFieldsProps {
  value: EmailConnectionConfig
  onChange: (next: EmailConnectionConfig) => void
  disabled?: boolean
}

export function EmailConnectionFields({ value, onChange, disabled }: EmailFieldsProps) {
  function patch(partial: Partial<EmailConnectionConfig>) {
    onChange({ ...value, ...partial })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <div>
          <Label>SMTP host</Label>
          <Input
            value={value.smtpHost}
            onChange={(e) => patch({ smtpHost: e.target.value })}
            placeholder="smtp.example.com"
            required
            disabled={disabled}
          />
        </div>
        <div>
          <Label>Port</Label>
          <Input
            type="number"
            min={1}
            max={65535}
            value={value.smtpPort}
            onChange={(e) => patch({ smtpPort: Number(e.target.value) || 587 })}
            required
            disabled={disabled}
          />
        </div>
      </div>

      <div>
        <Label>Encryption</Label>
        <Select
          value={value.encryption}
          disabled={disabled}
          onChange={(e) => {
            const encryption = e.target.value as EmailConnectionConfig['encryption']
            const hint = EMAIL_ENCRYPTION_OPTIONS.find((o) => o.value === encryption)?.portHint
            patch({
              encryption,
              smtpPort: hint ?? value.smtpPort,
            })
          }}
        >
          {EMAIL_ENCRYPTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
          Changing encryption suggests a common port (you can still edit it).
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Username</Label>
          <Input
            value={value.username}
            onChange={(e) => patch({ username: e.target.value })}
            autoComplete="off"
            disabled={disabled}
            placeholder="mailer@example.com"
          />
        </div>
        <div>
          <Label>Password</Label>
          <Input
            type="password"
            value={value.password}
            onChange={(e) => patch({ password: e.target.value })}
            autoComplete="new-password"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>From email</Label>
          <Input
            type="email"
            value={value.fromEmail}
            onChange={(e) => patch({ fromEmail: e.target.value })}
            required
            disabled={disabled}
            placeholder="noreply@example.com"
          />
        </div>
        <div>
          <Label>From name</Label>
          <Input
            value={value.fromName}
            onChange={(e) => patch({ fromName: e.target.value })}
            disabled={disabled}
            placeholder="Support Team"
          />
        </div>
      </div>

      <div>
        <Label>Reply-To (optional)</Label>
        <Input
          type="email"
          value={value.replyTo}
          onChange={(e) => patch({ replyTo: e.target.value })}
          disabled={disabled}
          placeholder="support@example.com"
        />
      </div>
    </div>
  )
}

interface PaymentFieldsProps {
  value: PaymentConnectionConfig
  onChange: (next: PaymentConnectionConfig) => void
  disabled?: boolean
}

export function PaymentConnectionFields({ value, onChange, disabled }: PaymentFieldsProps) {
  function patch(partial: Partial<PaymentConnectionConfig>) {
    onChange({ ...value, ...partial })
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Provider</Label>
        <Select
          value={value.provider}
          disabled={disabled}
          onChange={(e) => patch({ provider: e.target.value as PaymentConnectionConfig['provider'] })}
        >
          {PAYMENT_PROVIDER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
          {PAYMENT_PROVIDER_OPTIONS.find((o) => o.value === value.provider)?.hint}
        </p>
      </div>

      {value.provider === 'payfast' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Merchant ID</Label>
              <Input
                value={value.merchantId}
                onChange={(e) => patch({ merchantId: e.target.value })}
                disabled={disabled}
                required
                autoComplete="off"
              />
            </div>
            <div>
              <Label>Merchant key</Label>
              <Input
                type="password"
                value={value.merchantKey}
                onChange={(e) => patch({ merchantKey: e.target.value })}
                disabled={disabled}
                required
                autoComplete="new-password"
              />
            </div>
          </div>
          <div>
            <Label>Passphrase</Label>
            <Input
              type="password"
              value={value.passphrase}
              onChange={(e) => patch({ passphrase: e.target.value })}
              disabled={disabled}
              autoComplete="new-password"
            />
            <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
              Used to sign checkout fields and confirm PayFast’s ITN on the server. Never shown in chat.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
            <input
              type="checkbox"
              disabled={disabled}
              checked={value.sandbox}
              onChange={(e) => patch({ sandbox: e.target.checked })}
            />
            Sandbox (test) mode
          </label>
        </>
      ) : (
        <div>
          <Label>Shared secret</Label>
          <Input
            type="password"
            value={value.sharedSecret}
            onChange={(e) => patch({ sharedSecret: e.target.value })}
            disabled={disabled}
            required
            autoComplete="new-password"
          />
          <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
            Your gateway must POST to this API’s /payment/notify with header X-Payment-Secret, or
            HMAC-SHA256 of reference|status|amount.
          </p>
        </div>
      )}
    </div>
  )
}
