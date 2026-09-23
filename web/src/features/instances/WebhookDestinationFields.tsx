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
        <option value="custom">Custom service</option><option value="slack">Slack</option><option value="jira">Jira</option>
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
        <>
          <div><Label htmlFor="jira-action">Action</Label><Select id="jira-action" value={value.jiraAction} onChange={(e) => patch({ jiraAction: e.target.value as 'create' | 'update' })}><option value="create">Create issue (POST)</option><option value="update">Update issue (PUT)</option></Select></div>
          <p className="text-sm text-[var(--color-ink-muted)]">{value.jiraAction === 'create' ? 'URL: https://your-domain.atlassian.net/rest/api/3/issue' : 'URL: https://your-domain.atlassian.net/rest/api/3/issue/PROJ-123'}. Enter your account email and API token. FlowForge builds Basic authorization automatically. Scoped tokens can use https://api.atlassian.com/ex/jira/YOUR-CLOUD-ID/rest/api/3/issue with the issue key appended for updates.</p>
          <div><Label htmlFor="jira-email">Atlassian account email</Label><Input id="jira-email" type="email" value={value.email} onChange={(e) => patch({ email: e.target.value })} required /></div>
        </>
        <div><Label htmlFor="hook-token">API token</Label><Input id="hook-token" type="password" autoComplete="new-password" value={value.token} onChange={(e) => patch({ token: e.target.value })} required /></div>
        <button type="button" className="text-sm underline" onClick={() => patch({ bodyTemplate: JSON.stringify({ fields: value.jiraAction === 'create' ? { project: { key: 'PROJ' }, summary: 'Issue from FlowForge: {{event}}', issuetype: { name: 'Task' } } : { summary: 'Updated by FlowForge: {{event}}' } }, null, 2) })}>Use example issue body</button>
      </> : <div><Label htmlFor="hook-headers">Headers (JSON)</Label><Textarea id="hook-headers" autoComplete="off" spellCheck={false} value={value.headers} onChange={(e) => patch({ headers: e.target.value })} /><p className="text-xs text-[var(--color-ink-muted)]">Optional authentication headers. Values are literal and visible only to organisation admins.</p></div>}
      <div><Label htmlFor="hook-body">{value.destination === 'jira' ? 'Issue JSON body (required)' : 'JSON body template (optional)'}</Label><Textarea id="hook-body" spellCheck={false} value={value.bodyTemplate} onChange={(e) => patch({ bodyTemplate: e.target.value })} placeholder={'{"summary": "Enquiry from {{name}}", "details": "{{message}}"}'} /><p className="text-xs text-[var(--color-ink-muted)]">{value.destination === 'jira' ? 'Use fields for issue values. Creation needs project, summary and issue type; your project may require other fields. Jira v3 descriptions use Atlassian Document Format.' : 'Leave blank to send the full FlowForge event. Place variables inside quoted JSON strings.'}</p></div>
    </>}
    <p className="text-xs text-[var(--color-ink-muted)]">{'Use {{event}} or {{chatbot_id}} for any event. Conversation events also support {{name}}, {{variables.name}}, and {{session.id}}. Names must match your saved chatbot variables; missing variables fail delivery. Publish events have no conversation variables.'}</p>
  </div>
}