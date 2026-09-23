import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { InstanceWebhook } from '@/shared/types/database'
import { testWebhook } from '@/shared/lib/flowforgeApi'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { FieldError } from '@/shared/ui/field-error'
import { parseWebhookObject } from './webhookDestination'

export function WebhookTestPanel({ hook, onClose }: { hook: InstanceWebhook; onClose: () => void }) {
  const [event, setEvent] = useState(hook.events[0] ?? '')
  const [variables, setVariables] = useState('{"name": "Test user", "message": "Test notification from FlowForge"}')
  const qc = useQueryClient()
  const send = useMutation({
    mutationFn: () => testWebhook({ webhookId: hook.id, event, variables: event === 'flow.published' ? {} : parseWebhookObject(variables) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhook-deliveries', hook.instance_id] }),
  })
  return <Card className="space-y-3">
    <h2 className="font-semibold">Test {hook.name}</h2>
    <p className="text-sm text-[var(--color-ink-muted)]">This sends a real notification to the saved destination, even if disabled. Jira tests may create or update a real issue. Use sample data only. Save changes before testing.</p>
    <Label htmlFor="test-hook-event">Event</Label>
    <Select id="test-hook-event" disabled={send.isPending} value={event} onChange={(e) => { setEvent(e.target.value); send.reset() }}>{hook.events.map((item) => <option key={item}>{item}</option>)}</Select>
    {event !== 'flow.published' ? <div><Label htmlFor="test-hook-vars">Sample chatbot variables (JSON)</Label><Textarea id="test-hook-vars" disabled={send.isPending} value={variables} onChange={(e) => { setVariables(e.target.value); send.reset() }} /></div> : null}
    {send.error ? <FieldError>{send.error.message}</FieldError> : null}
    {send.data ? <p role="status" className={send.data.ok ? 'text-emerald-700' : 'text-rose-600'}>{send.data.ok ? `Destination accepted the test (HTTP ${send.data.status_code}).` : send.data.error || 'Test failed.'}{!send.data.logged ? ' Delivery history could not be saved.' : ''}</p> : null}
    {send.data?.diagnostics ? <div className="space-y-2">
      <h3 className="font-semibold">Full test output</h3>
      <p className="text-xs text-[var(--color-ink-muted)]">Request, response and errors are shown below. Credentials and webhook URLs are masked. Responses are limited to 64 KB; larger responses are marked as possibly truncated.</p>
      <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-all rounded-lg bg-[var(--color-surface-2)] p-3 text-xs">{JSON.stringify(send.data.diagnostics, null, 2)}</pre>
    </div> : null}
    <div className="flex gap-2"><Button disabled={send.isPending || !event} onClick={() => send.mutate()}>{send.isPending ? 'Sending...' : 'Send test notification'}</Button><Button variant="ghost" disabled={send.isPending} onClick={onClose}>Close</Button></div>
  </Card>
}
