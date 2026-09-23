import type { InstanceWebhook, Json } from '@/shared/types/database'

export type WebhookDestination = 'custom' | 'slack' | 'jira'
export type WebhookDestinationForm = { destination: WebhookDestination; message: string; bodyTemplate: string; token: string; headers: string; slackMode: 'webhook' | 'bot'; channel: string; jiraMode: 'automation' | 'api'; jiraAction: 'create' | 'update'; email: string }
export function defaultWebhookDestination(destination: WebhookDestination = 'custom'): WebhookDestinationForm {
  return { destination, message: 'FlowForge: {{event}}', bodyTemplate: '', token: '', headers: '{}', slackMode: 'webhook', channel: '', jiraMode: 'api', jiraAction: 'create', email: '' }
}
export function readWebhookDestination(hook: InstanceWebhook): WebhookDestinationForm {
  const cfg = (hook.destination_config ?? {}) as Record<string, unknown>
  return { destination: hook.destination ?? 'custom', message: String(cfg.message ?? 'FlowForge: {{event}}'),
    jiraMode: 'api', jiraAction: cfg.jiraAction === 'update' ? 'update' : 'create', email: String(cfg.email ?? ''),
    slackMode: cfg.slackMode === 'bot' ? 'bot' : 'webhook', channel: String(cfg.channel ?? ''),
    bodyTemplate: String(cfg.bodyTemplate ?? ''), token: String(cfg.token ?? ''), headers: JSON.stringify(cfg.headers ?? {}, null, 2) }
}
export function parseWebhookObject(text: string): Record<string, unknown> {
  const value: unknown = JSON.parse(text)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Enter a JSON object.')
  return value as Record<string, unknown>
}
export function saveWebhookDestination(form: WebhookDestinationForm, url: string): { destination: WebhookDestination; destination_config: Json } {
  const parsed = new URL(url)
  if (parsed.username || parsed.password) throw new Error('Put credentials in the authentication fields, not the URL.')
  if (form.destination === 'slack') {
    if (form.slackMode === 'bot') {
      if (url !== 'https://slack.com/api/chat.postMessage') throw new Error('Slack bot messages must use the Slack API endpoint.')
      if (!form.token.trim() || /\s/.test(form.token.trim())) throw new Error('Enter the Slack token without the Bearer prefix.')
      if (!form.channel.trim()) throw new Error('Enter the Slack channel ID.')
      if (!form.message.trim()) throw new Error('Enter a Slack message.')
      return { destination: 'slack', destination_config: { slackMode: 'bot', token: form.token.trim(), channel: form.channel.trim(), message: form.message } }
    }
    if (parsed.protocol !== 'https:' || !['hooks.slack.com', 'hooks.slack-gov.com'].includes(parsed.hostname) || !parsed.pathname.startsWith('/services/')) throw new Error('Enter a Slack incoming webhook URL.')
    if (!form.message.trim()) throw new Error('Enter a Slack message.')
    return { destination: form.destination, destination_config: { message: form.message } }
  }
  if (form.bodyTemplate.trim()) parseWebhookObject(form.bodyTemplate)
  if (form.destination === 'jira') {
    if (!form.token.trim() || /[\r\n]/.test(form.token)) throw new Error(form.jiraMode === 'api' ? 'Enter a valid Jira API token.' : 'Enter a valid Jira webhook token.')
    if (parsed.protocol !== 'https:') throw new Error('Jira webhooks require HTTPS.')
    {
      if (!/^[^\s@:]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) throw new Error('Enter your Atlassian account email.')
      const path = parsed.hostname === 'api.atlassian.com' ? parsed.pathname.replace(/^\/ex\/jira\/[a-zA-Z0-9-]+/, '') : parsed.pathname
      if (!(parsed.hostname.endsWith('.atlassian.net') || (parsed.hostname === 'api.atlassian.com' && path !== parsed.pathname)) || parsed.port || parsed.search || parsed.hash || !(form.jiraAction === 'update' ? /^\/rest\/api\/3\/issue\/[A-Za-z0-9_-]+$/ : /^\/rest\/api\/3\/issue$/).test(path)) throw new Error('Enter the Jira Cloud issue endpoint for the selected action.')
      const body = parseWebhookObject(form.bodyTemplate)
      if (!body.fields && !body.update) throw new Error('Jira API requests need fields or update in the JSON body.')
      return { destination: 'jira', destination_config: { jiraMode: 'api', jiraAction: form.jiraAction, email: form.email.trim(), token: form.token.trim(), bodyTemplate: form.bodyTemplate } }
    }

  }
  const headers = parseWebhookObject(form.headers)
  const normalized = new Set<string>()
  for (const [name, value] of Object.entries(headers)) {
    const key = name.toLowerCase()
    if (!/^[A-Za-z0-9-]+$/.test(name) || typeof value !== 'string' || /[\r\n]/.test(value) || normalized.has(key) || ['host', 'content-type', 'content-length', 'connection', 'transfer-encoding', 'x-flowforge-signature', 'x-flowforge-event'].includes(key)) throw new Error('Headers must have unique valid names and single-line text values. FlowForge headers cannot be overridden.')
    normalized.add(key)
  }
  if (Object.keys(headers).length && parsed.protocol !== 'https:') throw new Error('Use HTTPS when sending custom headers.')
  return { destination: form.destination, destination_config: { bodyTemplate: form.bodyTemplate, headers: headers as Record<string, string> } }
}