import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { defaultWebhookDestination, type WebhookDestination, type WebhookDestinationForm } from './webhookDestination'

export function WebhookDestinationFields({ value, onChange }: { value: WebhookDestinationForm; onChange: (value: WebhookDestinationForm) => void }) {
  const patch = (change: Partial<WebhookDestinationForm>) => onChange({ ...value, ...change })
  return <div className="space-y-3">
    <div><Label htmlFor="hook-destination">Destination</Label>
      <Select id="hook-destination" value={value.destination} onChange={(e) => onChange(defaultWebhookDestination(e.target.value as WebhookDestination))}>
        <option value="custom">Custom service</option><option value="slack">Slack</option><option value="jira">Jira Automation</option>
      </Select>
    </div>
    {value.destination === 'slack' ? <>
      <div><Label htmlFor="slack-mode">Slack connection</Label><Select id="slack-mode" value={value.slackMode} onChange={(e) => patch({ slackMode: e.target.value as 'webhook' | 'bot', token: '', channel: '' })}><option value="webhook">Incoming webhook URL</option><option value="bot">Bot token (Bearer authorization)</option></Select></div>
      {value.slackMode === 'bot' ? <>
        <p className="text-sm text-[var(--color-ink-muted)]">Use a Slack bot token with chat:write permission and invite the bot to the channel. FlowForge adds Authorization: Bearer automatically.</p>
        <div><Label htmlFor="slack-token">Bot token</Label><Input id="slack-token" type="password" autoComplete="new-password" value={value.token} onChange={(e) => patch({ token: e.target.value })} placeholder="xoxb-..." required /></div>
        <div><Label htmlFor="slack-channel">Channel ID</Label><Input id="slack-channel" value={value.channel} onChange={(e) => patch({ channel: e.target.value })} placeholder="C0123456789" required /></div>
      </> : <p className="text-sm text-[var(--color-ink-muted)]">Create a Slack incoming webhook for your channel, then paste its URL above. This URL already authenticates the request; no bearer token is needed.</p>}
      <div><Label htmlFor="hook-message">Message template</Label><Textarea id="hook-message" value={value.message} onChange={(e) => patch({ message: e.target.value })} required /></div>
    </> : <>
      {value.destination === 'jira' ? <>
        <p className="text-sm text-[var(--color-ink-muted)]">Create a Jira Automation rule with an Incoming webhook trigger. Paste its URL above and secret below, then add the rule action, such as creating an issue. Map the fields using Jira's webhookData values.</p>
        <div><Label htmlFor="hook-token">Webhook token</Label><Input id="hook-token" type="password" autoComplete="new-password" value={value.token} onChange={(e) => patch({ token: e.target.value })} required /></div>
      </> : <div><Label htmlFor="hook-headers">Headers (JSON)</Label><Textarea id="hook-headers" autoComplete="off" spellCheck={false} value={value.headers} onChange={(e) => patch({ headers: e.target.value })} /><p className="text-xs text-[var(--color-ink-muted)]">Optional authentication headers. Values are literal and visible only to organisation admins.</p></div>}
      <div><Label htmlFor="hook-body">JSON body template (optional)</Label><Textarea id="hook-body" spellCheck={false} value={value.bodyTemplate} onChange={(e) => patch({ bodyTemplate: e.target.value })} placeholder={'{"summary": "Enquiry from {{name}}", "details": "{{message}}"}'} /><p className="text-xs text-[var(--color-ink-muted)]">Leave blank to send the full FlowForge event. Place variables inside quoted JSON strings.</p></div>
    </>}
    <p className="text-xs text-[var(--color-ink-muted)]">{'Use {{event}} or {{chatbot_id}} for any event. Conversation events also support {{name}}, {{variables.name}}, and {{session.id}}. Names must match your saved chatbot variables; missing variables fail delivery. Publish events have no conversation variables.'}</p>
  </div>
}
