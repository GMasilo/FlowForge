import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { useAuth } from '@/features/auth/AuthProvider'
import { createChatbotConnection, listChatbotConnections, updateChatbotConnection } from '@/features/connections/connectionApi'
import { defaultPaymentConfig, parsePaymentConfig, toPaymentJson } from '@/features/connections/connectionConfig'
import { PaymentConnectionFields } from '@/features/connections/ConnectionFormFields'
import { TemplateField, type TemplateSuggestion } from '@/features/designer/inspector/TemplateField'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import type { PaymentTemplateContent } from './paymentTemplate'

export function PaymentTemplateEditor({ content, onChange, readOnly, suggestions }: {
  content: PaymentTemplateContent; onChange: (next: PaymentTemplateContent) => void
  readOnly?: boolean; suggestions: TemplateSuggestion[]
}) {
  const { chatbotId } = useParams()
  const { instance } = useRequiredInstance()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [config, setConfig] = useState(defaultPaymentConfig)
  const [error, setError] = useState<string | null>(null)
  const query = useQuery({ queryKey: ['chatbot-usable-connections', chatbotId], enabled: !!chatbotId, queryFn: () => listChatbotConnections(chatbotId!) })
  const connections = (query.data ?? []).filter(c => c.kind === 'payment')
  const selected = connections.find(c => c.id === content.paymentConnectionId)
  const patch = (part: Partial<PaymentTemplateContent>) => onChange({ ...content, ...part })
  const save = useMutation({
    mutationFn: async () => {
      if (readOnly || !user || !chatbotId || !name.trim()) throw new Error('Enter a connection name.')
      if (config.provider === 'payfast' && (!config.merchantId.trim() || !config.merchantKey.trim())) throw new Error('Enter the PayFast merchant ID and key.')
      if (config.provider === 'stripe' && (!config.secretKey.trim() || !config.webhookSecret.trim())) throw new Error('Enter the Stripe secret key and webhook signing secret.')
      if (config.provider === 'custom' && !config.sharedSecret.trim()) throw new Error('Enter a shared secret for payment notifications.')
      if (editing && editing !== 'new') {
        const connection = connections.find(c => c.id === editing)
        if (!connection?.canManage) throw new Error('You cannot edit this connection.')
        await updateChatbotConnection({ id: editing, name, kind: 'payment', config: toPaymentJson(config), visibility: connection.visibility })
        return editing
      }
      const connection = await createChatbotConnection({ instanceId: instance.id, chatbotId, name, kind: 'payment', config: toPaymentJson(config), createdBy: user.id, visibility: 'private' })
      return connection.id
    },
    onSuccess: async (id) => {
      patch({ paymentConnectionId: id })
      setEditing(null); setConfig(defaultPaymentConfig()); setError(null)
      await Promise.all([qc.invalidateQueries({ queryKey: ['chatbot-usable-connections', chatbotId] }), qc.invalidateQueries({ queryKey: ['owned-connections', chatbotId] })])
    },
    onError: (err: Error) => setError(err.message),
  })
  return <div className="space-y-4">
    <div><Label>Payment connection</Label><Select aria-label="Payment connection" disabled={readOnly || save.isPending || query.isPending} value={content.paymentConnectionId} onChange={e => { patch({ paymentConnectionId: e.target.value }); setEditing(null); setConfig(defaultPaymentConfig()) }}>
      <option value="">Select a payment connection</option>
      {content.paymentConnectionId && !selected ? <option value={content.paymentConnectionId}>Connection unavailable</option> : null}
      {connections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
    </Select></div>
    {query.isError ? <p role="alert" className="text-sm text-[var(--color-danger)]">Could not load payment connections.</p> : null}
    {!readOnly && !editing ? <div className="flex gap-2">
      <Button variant="secondary" onClick={() => { setEditing('new'); setName('Payment connection'); setConfig(defaultPaymentConfig()); setError(null) }}>New connection</Button>
      {selected?.canManage ? <Button variant="secondary" onClick={() => { setEditing(selected.id); setName(selected.name); setConfig(parsePaymentConfig(selected.config)); setError(null) }}>Edit connection</Button> : null}
    </div> : null}
    {editing ? <div className="space-y-3 rounded-xl border border-[var(--color-border)] p-3">
      <div><Label>Connection name</Label><Input aria-label="Connection name" disabled={save.isPending || readOnly} value={name} onChange={e => setName(e.target.value)} /></div>
      <PaymentConnectionFields value={config} onChange={setConfig} disabled={save.isPending || readOnly} />
      <p className="text-xs text-[var(--color-ink-muted)]">Credentials are saved in the connection, separately from the template. Editing a connection also affects other steps using it.</p>
      {error ? <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p> : null}
      <div className="flex gap-2"><Button disabled={save.isPending || readOnly} onClick={() => save.mutate()}>{save.isPending ? 'Saving...' : 'Save connection'}</Button><Button variant="ghost" disabled={save.isPending} onClick={() => { setEditing(null); setConfig(defaultPaymentConfig()) }}>Cancel</Button></div>
    </div> : null}
    {([
      ['paymentAmount', 'Amount', '{{vars.cart.total}}'], ['currencyCode', 'Currency', 'ZAR'],
      ['paymentItemName', 'Item name', 'Order payment'], ['payUrl', 'Pay URL (custom provider)', 'https://...'],
      ['paymentBuyerEmail', 'Buyer email', '{{vars.email}}'], ['paymentBuyerName', 'Buyer name', '{{vars.name}}'],
      ['payButtonLabel', 'Pay button label', 'Pay now'], ['paidButtonLabel', 'Payment check button label', "I've paid"],
    ] as const).map(([key, label, placeholder]) => <div key={key}><Label>{label}</Label><TemplateField hideHint disabled={readOnly || save.isPending} value={content[key]} onChange={value => patch({ [key]: value })} suggestions={suggestions} placeholder={placeholder} /></div>)}
    <p className="text-xs text-[var(--color-ink-muted)]">Select this template on a Payment question. The flow waits for the provider to confirm payment.</p>
  </div>
}
