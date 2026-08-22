import type { IntegrationProvider } from '@/shared/types/database'

export type IntegrationCatalogItem = {
  provider: IntegrationProvider
  label: string
  description: string
  category: 'storage' | 'productivity' | 'communication' | 'other'
  /** Non-secret config field keys shown in the form */
  configFields: { key: string; label: string; placeholder?: string; type?: 'text' | 'url' }[]
  /** Secret field keys (stored in integration_secrets) */
  secretFields: { key: string; label: string; placeholder?: string }[]
}

export const INTEGRATION_CATALOG: IntegrationCatalogItem[] = [
  {
    provider: 'microsoft_onedrive',
    label: 'Microsoft OneDrive',
    description: 'Upload and fetch files from OneDrive for Business or personal accounts.',
    category: 'storage',
    configFields: [
      { key: 'tenant_id', label: 'Tenant ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
      { key: 'client_id', label: 'Application (client) ID' },
      { key: 'drive_id', label: 'Default drive ID (optional)' },
    ],
    secretFields: [
      { key: 'client_secret', label: 'Client secret' },
      { key: 'refresh_token', label: 'Refresh token (optional if using app-only)' },
    ],
  },
  {
    provider: 'google_drive',
    label: 'Google Drive',
    description: 'Read and write files in Google Drive shared drives or My Drive.',
    category: 'storage',
    configFields: [
      { key: 'client_id', label: 'OAuth client ID' },
      { key: 'folder_id', label: 'Default folder ID (optional)' },
    ],
    secretFields: [
      { key: 'client_secret', label: 'Client secret' },
      { key: 'refresh_token', label: 'Refresh token' },
    ],
  },
  {
    provider: 'dropbox',
    label: 'Dropbox',
    description: 'Store and retrieve files from Dropbox teams or personal accounts.',
    category: 'storage',
    configFields: [{ key: 'app_key', label: 'App key' }],
    secretFields: [
      { key: 'app_secret', label: 'App secret' },
      { key: 'access_token', label: 'Access token' },
    ],
  },
  {
    provider: 'box',
    label: 'Box',
    description: 'Enterprise file storage via the Box API.',
    category: 'storage',
    configFields: [{ key: 'client_id', label: 'Client ID' }],
    secretFields: [
      { key: 'client_secret', label: 'Client secret' },
      { key: 'enterprise_id', label: 'Enterprise ID (JWT)' },
    ],
  },
  {
    provider: 'sharepoint',
    label: 'SharePoint',
    description: 'Work with SharePoint document libraries and lists.',
    category: 'storage',
    configFields: [
      { key: 'tenant_id', label: 'Tenant ID' },
      { key: 'client_id', label: 'Application (client) ID' },
      { key: 'site_id', label: 'Site ID' },
    ],
    secretFields: [{ key: 'client_secret', label: 'Client secret' }],
  },
  {
    provider: 'slack',
    label: 'Slack',
    description: 'Post messages or files to Slack channels from a flow step.',
    category: 'communication',
    configFields: [{ key: 'default_channel', label: 'Default channel', placeholder: '#general' }],
    secretFields: [{ key: 'bot_token', label: 'Bot user OAuth token' }],
  },
  {
    provider: 'microsoft_teams',
    label: 'Microsoft Teams',
    description: 'Send adaptive cards or messages to Teams channels.',
    category: 'communication',
    configFields: [
      { key: 'tenant_id', label: 'Tenant ID' },
      { key: 'client_id', label: 'Application (client) ID' },
    ],
    secretFields: [{ key: 'client_secret', label: 'Client secret' }],
  },
  {
    provider: 'google_sheets',
    label: 'Google Sheets',
    description: 'Append rows or read ranges from a spreadsheet.',
    category: 'productivity',
    configFields: [
      { key: 'client_id', label: 'OAuth client ID' },
      { key: 'spreadsheet_id', label: 'Default spreadsheet ID (optional)' },
    ],
    secretFields: [
      { key: 'client_secret', label: 'Client secret' },
      { key: 'refresh_token', label: 'Refresh token' },
    ],
  },
  {
    provider: 'notion',
    label: 'Notion',
    description: 'Create pages or update databases in a Notion workspace.',
    category: 'productivity',
    configFields: [],
    secretFields: [{ key: 'api_key', label: 'Internal integration secret' }],
  },
  {
    provider: 's3',
    label: 'Amazon S3',
    description: 'Upload and download objects from an S3 bucket.',
    category: 'storage',
    configFields: [
      { key: 'region', label: 'AWS region', placeholder: 'af-south-1' },
      { key: 'bucket', label: 'Bucket name' },
      { key: 'endpoint', label: 'Custom endpoint (optional)', type: 'url' },
    ],
    secretFields: [
      { key: 'access_key_id', label: 'Access key ID' },
      { key: 'secret_access_key', label: 'Secret access key' },
    ],
  },
  {
    provider: 'custom',
    label: 'Custom API',
    description: 'Generic OAuth or API-key integration for a custom service.',
    category: 'other',
    configFields: [
      { key: 'base_url', label: 'Base URL', type: 'url', placeholder: 'https://api.example.com' },
      { key: 'auth_type', label: 'Auth type', placeholder: 'bearer | api_key | oauth2' },
    ],
    secretFields: [
      { key: 'api_key', label: 'API key / token' },
      { key: 'client_secret', label: 'Client secret (optional)' },
    ],
  },
]

export function catalogItem(provider: IntegrationProvider): IntegrationCatalogItem | undefined {
  return INTEGRATION_CATALOG.find((c) => c.provider === provider)
}

export function providerLabel(provider: IntegrationProvider): string {
  return catalogItem(provider)?.label ?? provider
}
