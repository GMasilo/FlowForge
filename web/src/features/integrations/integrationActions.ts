import type { IntegrationProvider } from '@/shared/types/database'

export type IntegrationActionId =
  | 'slack.post_message'
  | 'teams.post_message'
  | 'sheets.create_spreadsheet'
  | 'sheets.append_row'
  | 'storage.upload_text'
  | 'notion.create_page'
  | 'custom.request'
  | 'ml.classify_intent'
  | 'ml.analyze_sentiment'
  | 'ml.text_similarity'
  | 'ml.classify_image'
  | 'ml.health_check'

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
    id: 'ml.classify_intent',
    label: 'Understand intent',
    description:
      'Match a visitor message to your example phrases (Universal Sentence Encoder). Returns unknown for weak or ambiguous matches; scores are cosine similarity, not probability.',
    providers: ['custom'],
    fields: [
      { key: 'text', label: 'Visitor message', placeholder: '{{vars.message}}' },
      {
        key: 'categories',
        label: 'Categories and example phrases',
        multiline: true,
        placeholder:
          '[{"name":"billing","examples":["Pay my fees","I need a refund"]},{"name":"admissions","examples":["Apply to study","Admission requirements"]}]',
        hint: 'Use the category editor above, or provide a JSON array. 2–10 categories; unknown is reserved.',
      },
      {
        key: 'threshold',
        label: 'Minimum similarity (0–1)',
        placeholder: '0.65',
        hint: 'Defaults to 0.65. Tune with real examples before enabling automatic routing.',
      },
      {
        key: 'margin',
        label: 'Minimum lead over the next category (0–1)',
        placeholder: '0.08',
        hint: 'Defaults to 0.08. Similar scores return unknown so you can ask a clarifying question.',
      },
    ],
  },
  {
    id: 'ml.analyze_sentiment',
    label: 'Analyze sentiment',
    description:
      'Classify text as positive, negative, or neutral using the TensorFlow sentence encoder (zero-shot against built-in examples).',
    providers: ['custom'],
    fields: [
      { key: 'text', label: 'Text to analyze', placeholder: '{{vars.message}}' },
      {
        key: 'threshold',
        label: 'Minimum similarity (0–1, optional)',
        placeholder: '0.35',
        hint: 'Below this, label is neutral. Default 0.35.',
      },
    ],
  },
  {
    id: 'ml.text_similarity',
    label: 'Compare text similarity',
    description:
      'Score how similar two texts are (cosine similarity of Universal Sentence Encoder embeddings). Useful for FAQ matching or duplicate detection.',
    providers: ['custom'],
    fields: [
      { key: 'text_a', label: 'First text', placeholder: '{{vars.message}}', multiline: true },
      { key: 'text_b', label: 'Second text', placeholder: '{{vars.faq_answer}}', multiline: true },
    ],
  },
  {
    id: 'ml.classify_image',
    label: 'Classify image (MobileNet)',
    description:
      'Predict ImageNet labels for an image URL or base64 payload using TensorFlow.js MobileNet. Use after a file-upload step; pass the public or instance file URL.',
    providers: ['custom'],
    fields: [
      {
        key: 'image_url',
        label: 'Image URL',
        placeholder: '{{vars.uploaded_image_url}}',
        hint: 'HTTPS URL to a JPEG or PNG. Prefer files uploaded in this conversation.',
      },
      {
        key: 'image_base64',
        label: 'Image base64 (optional)',
        multiline: true,
        placeholder: 'Leave blank if using Image URL',
        hint: 'Raw base64 or data URL. Used when Image URL is empty.',
      },
      {
        key: 'top_k',
        label: 'Top labels',
        placeholder: '5',
        hint: 'How many labels to return (1–10). Default 5.',
      },
    ],
  },
  {
    id: 'ml.health_check',
    label: 'Check ML service health',
    description:
      'Call the TensorFlow service /health endpoint (model load status and readiness).',
    providers: ['custom'],
    fields: [],
  },
  {
    id: 'custom.request',
    label: 'Custom API request',
    description: 'POST JSON to a path under the integration base URL (or a full path on that host).',
    providers: ['custom'],
    fields: [
      { key: 'path', label: 'Path', placeholder: '/hooks/event' },
      { key: 'content', label: 'JSON body', multiline: true, placeholder: '{"ok":true}' },
    ],
  },
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
      {
        key: 'values',
        label: 'Values',
        multiline: true,
        placeholder: 'a,b,c or ["a","b"]',
        hint: 'Comma-separated or JSON array; templates allowed',
      },
    ],
  },
  {
    id: 'sheets.create_spreadsheet',
    label: 'Create spreadsheet',
    description: 'Create a new Google Spreadsheet and optionally write a first row of values.',
    providers: ['google_sheets'],
    fields: [
      { key: 'title', label: 'Title', placeholder: 'Submission {{vars.id}}' },
      { key: 'sheetTitle', label: 'First sheet name', placeholder: 'Sheet1' },
      {
        key: 'values',
        label: 'Initial row (optional)',
        multiline: true,
        placeholder: 'a,b,c or ["a","b"]',
        hint: 'Comma-separated or JSON array written as the first row after create',
      },
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
  if (provider === 'custom') return 'ml.classify_intent'
  const list = actionsForProvider(provider)
  return list[0]?.id ?? 'custom.request'
}
