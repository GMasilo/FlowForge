import { describe, expect, it } from 'vitest'
import { defaultWebhookDestination, parseWebhookObject, saveWebhookDestination } from './webhookDestination'

describe('webhook destination configuration', () => {
  it('supports Slack bot tokens with channel IDs and pins the endpoint', () => {
    const form = { ...defaultWebhookDestination('slack'), slackMode: 'bot' as const, token: 'xoxb-test', channel: 'C123' }
    expect(saveWebhookDestination(form, 'https://slack.com/api/chat.postMessage').destination_config).toEqual({ slackMode: 'bot', token: 'xoxb-test', channel: 'C123', message: 'FlowForge: {{event}}' })
    expect(() => saveWebhookDestination(form, 'https://example.test')).toThrow('endpoint')
    expect(() => saveWebhookDestination({ ...form, channel: '' }, 'https://slack.com/api/chat.postMessage')).toThrow('channel')
    expect(() => saveWebhookDestination({ ...form, token: 'Bearer xoxb-test' }, 'https://slack.com/api/chat.postMessage')).toThrow('prefix')
  })
  it('keeps default custom payload and clears other destination attributes', () => {
    expect(saveWebhookDestination(defaultWebhookDestination(), 'https://example.test')).toEqual({ destination: 'custom', destination_config: { bodyTemplate: '', headers: {} } })
    const config = saveWebhookDestination({ ...defaultWebhookDestination('slack'), token: 'old-token', headers: '{"Authorization":"old"}' }, 'https://hooks.slack.com/services/test/example')
    expect(config.destination_config).toEqual({ message: 'FlowForge: {{event}}' })
  })
  it('requires the correct Slack URL and Jira token', () => {
    expect(() => saveWebhookDestination(defaultWebhookDestination('slack'), 'https://example.test')).toThrow('Slack')
    expect(() => saveWebhookDestination(defaultWebhookDestination('jira'), 'https://example.test')).toThrow('token')
    expect(() => saveWebhookDestination({ ...defaultWebhookDestination('jira'), token: 'test' }, 'http://example.test')).toThrow('HTTPS')
  })
  it('validates JSON and rejects reserved, injected and duplicate headers', () => {
    expect(() => parseWebhookObject('[]')).toThrow()
    for (const headers of [{ Host: 'bad' }, { Authorization: 'a\r\nb' }, { Authorization: 'a', authorization: 'b' }]) {
      expect(() => saveWebhookDestination({ ...defaultWebhookDestination(), headers: JSON.stringify(headers) }, 'https://example.test')).toThrow()
    }
    expect(() => saveWebhookDestination({ ...defaultWebhookDestination(), bodyTemplate: 'invalid' }, 'https://example.test')).toThrow()
  })
})
