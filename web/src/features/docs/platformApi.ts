export type PlatformApiAuth = 'none' | 'jwt'

export type PlatformApiEndpoint = {
  method: 'GET'
  path: string
  auth: PlatformApiAuth
  summary: string
}

export type PlatformApiGroup = {
  id: string
  title: string
  blurb: string
  endpoints: PlatformApiEndpoint[]
}

export const PLATFORM_API_GROUPS: PlatformApiGroup[] = [
  {
    id: 'docs',
    title: 'Documentation',
    blurb: 'Import OpenAPI JSON into Postman (File → Import), or download the collection plus environment.',
    endpoints: [
      { method: 'GET', path: '/openapi.json', auth: 'none', summary: 'OpenAPI 3.0.3 document' },
      { method: 'GET', path: '/postman.json', auth: 'none', summary: 'Postman Collection v2.1' },
      { method: 'GET', path: '/postman-environment.json', auth: 'none', summary: 'Postman environment' },
      { method: 'GET', path: '/docs', auth: 'none', summary: 'Interactive Redoc HTML' },
    ],
  },
  {
    id: 'account',
    title: 'Account',
    blurb: 'Who you are and which organisations you can read.',
    endpoints: [
      { method: 'GET', path: '/v1', auth: 'jwt', summary: 'Resource catalog' },
      { method: 'GET', path: '/v1/me', auth: 'jwt', summary: 'User plus organisation roles' },
    ],
  },
  {
    id: 'organisations',
    title: 'Organisations',
    blurb: 'Tenants you belong to. Chatbots, conversations, and analytics hang off an organisation.',
    endpoints: [
      { method: 'GET', path: '/v1/organisations', auth: 'jwt', summary: 'List organisations' },
      { method: 'GET', path: '/v1/organisations/{organisationId}', auth: 'jwt', summary: 'Get one organisation' },
      { method: 'GET', path: '/v1/organisations/{organisationId}/chatbots', auth: 'jwt', summary: 'List chatbots' },
      { method: 'GET', path: '/v1/organisations/{organisationId}/conversations', auth: 'jwt', summary: 'List conversations' },
      { method: 'GET', path: '/v1/organisations/{organisationId}/analytics', auth: 'jwt', summary: 'Organisation analytics' },
    ],
  },
  {
    id: 'chatbots',
    title: 'Chatbots',
    blurb: 'Chatbot records, published flow JSON, designer export packs, media, templates, variables, and entities.',
    endpoints: [
      { method: 'GET', path: '/v1/chatbots/{chatbotId}', auth: 'jwt', summary: 'Get chatbot (including settings)' },
      { method: 'GET', path: '/v1/chatbots/{chatbotId}/flow', auth: 'jwt', summary: 'Published or staging graph JSON' },
      { method: 'GET', path: '/v1/chatbots/{chatbotId}/export', auth: 'jwt', summary: 'Full flow pack (nodes, templates, entities)' },
      { method: 'GET', path: '/v1/chatbots/{chatbotId}/media', auth: 'jwt', summary: 'Media library file list' },
      { method: 'GET', path: '/v1/chatbots/{chatbotId}/templates', auth: 'jwt', summary: 'Templates (FAQ, catalogs, email, …)' },
      { method: 'GET', path: '/v1/chatbots/{chatbotId}/variables', auth: 'jwt', summary: 'Global and step variables' },
      { method: 'GET', path: '/v1/chatbots/{chatbotId}/entities', auth: 'jwt', summary: 'Data tables owned by the chatbot' },
      { method: 'GET', path: '/v1/chatbots/{chatbotId}/entities/{entityId}', auth: 'jwt', summary: 'Entity schema and attributes' },
      { method: 'GET', path: '/v1/chatbots/{chatbotId}/entities/{entityId}/records', auth: 'jwt', summary: 'Entity records' },
    ],
  },
  {
    id: 'conversations',
    title: 'Conversations',
    blurb: 'Sessions, transcripts (events), and files uploaded during the chat.',
    endpoints: [
      { method: 'GET', path: '/v1/chatbots/{chatbotId}/conversations', auth: 'jwt', summary: 'Sessions for one chatbot' },
      { method: 'GET', path: '/v1/conversations/{conversationId}', auth: 'jwt', summary: 'Session plus saved variables' },
      { method: 'GET', path: '/v1/conversations/{conversationId}/events', auth: 'jwt', summary: 'Ordered transcript' },
      { method: 'GET', path: '/v1/conversations/{conversationId}/files', auth: 'jwt', summary: 'Uploads for this session' },
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics',
    blurb: 'Volume, completion, unique visitors, drop-off by step, and breakdowns by chatbot and day.',
    endpoints: [
      { method: 'GET', path: '/v1/organisations/{organisationId}/analytics', auth: 'jwt', summary: 'Organisation analytics' },
      { method: 'GET', path: '/v1/chatbots/{chatbotId}/analytics', auth: 'jwt', summary: 'Chatbot analytics' },
    ],
  },
]

export const AUTH_LABEL: Record<PlatformApiAuth, string> = {
  none: 'None',
  jwt: 'JWT',
}

export function platformApiBaseUrl(): string {
  return (import.meta.env.VITE_FLOWFORGE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''
}

export function publicSpecUrl(
  file:
    | 'openapi.json'
    | 'postman/FlowForge-Platform-API.postman_collection.json'
    | 'postman/FlowForge-Platform-API.postman_environment.json',
): string {
  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, '')
  return `${base}/${file}`
}
