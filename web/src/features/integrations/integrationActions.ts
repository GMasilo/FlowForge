import type { IntegrationProvider } from '@/shared/types/database'

export type IntegrationActionId =
  | 'slack.post_message'
  | 'teams.post_message'
  | 'sheets.append_row'
  | 'storage.upload_text'
  | 'notion.create_page'
  | 'custom.request'

export type IntegrationActionField = {
  key: string
  label: string
  placeholder?: string
  multiline?: boolean
  hint?: string
}

export type IntegrationActionDef = {
  id: IntegrationActionId
  label: string
  description: string
  providers: IntegrationProvider[] | '*'
  fields: IntegrationActionField[]
}

export const INTEGRATION_ACTIONS: IntegrationActionDef[] = [
  {
    id: 'slack.post_message',
    label: 'Post Slack message',
    description: 'Send a message to a Slack channel using the bot token.',
    providers: ['slack'],
    fields: [
      { key: 'channel', label: 'Channel', placeholder: '#general or {{vars.channel}}' },
      { key: 'message', label: 'Message', multiline: true, placeholder: 'Hello {{vars.name}}' },
    ],
  },
  {
    id: 'teams.post_message',
    label: 'Post Teams message',
    description: 'Send a plain text message via the configured Teams app.',
    providers: ['microsoft_teams'],
    fields: [
      { key: 'channel', label: 'Channel / team id', placeholder: 'Optional override' },
      { key: 'message', label: 'Message', multiline: true },
    ],
  },
  {
    id: 'sheets.append_row',
    label: 'Append spreadsheet row',
    description: 'Append a row of values to Google Sheets (comma-separated or JSON array).',
    providers: ['google_sheets'],
    fields: [
      { key: 'spreadsheetId', label: 'Spreadsheet ID', placeholder: 'Leave blank for integration default' },
      { key: 'range', label: 'Range', placeholder: 'Sheet1!A1' },
      { key: 'values', label: 'Values', multiline: true, placeholder: 'a,b,c or ["a","b"]', hint: 'Comma-separated or JSON array; templates allowed' },
    ],
  },
  {
    id: 'storage.upload_text',
    label: 'Upload text file',
    description: 'Upload a text payload to Drive, OneDrive, Dropbox, Box, SharePoint, or S3.',
    providers: [
      'google_drive',
      'microsoft_onedrive',
      'dropbox',
      'box',
      'sharepoint',
      's3',
    ],
    fields: [
      { key: 'path', label: 'Path / filename', placeholder: 'exports/{{vars.id}}.txt' },
      { key: 'content', label: 'Content', multiline: true, placeholder: '{{steps.question_1.response}}' },
    ],
  },
  {
    id: 'notion.create_page',
    label: 'Create Notion page',
    description: 'Create a simple page with a title and body paragraph.',
    providers: ['notion'],
    fields: [
      { key: 'title', label: 'Title', placeholder: 'Submission {{vars.id}}' },
      { key: 'content', label: 'Body', multiline: true },
    ],
  },
  {
    id: 'custom.request',
    label: 'Custom API request',
    description: 'POST JSON to the integration base URL path.',
    providers: ['custom'],
    fields: [
      { key: 'path', label: 'Path', placeholder: '/hooks/event' },
      { key: 'content', label: 'JSON body', multiline: true, placeholder: '{"ok":true}' },
    ],
  },
]

export function actionsForProvider(provider: IntegrationProvider | null | undefined): IntegrationActionDef[] {
  if (!provider) return INTEGRATION_ACTIONS
  return INTEGRATION_ACTIONS.filter(
    (a) => a.providers === '*' || (Array.isArray(a.providers) && a.providers.includes(provider)),
  )
}

export function actionDef(id: string | null | undefined): IntegrationActionDef | undefined {
  return INTEGRATION_ACTIONS.find((a) => a.id === id)
}

export function defaultActionForProvider(provider: IntegrationProvider): IntegrationActionId {
  const list = actionsForProvider(provider)
  return list[0]?.id ?? 'custom.request'
}
