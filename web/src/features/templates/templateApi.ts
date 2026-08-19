import { supabase } from '@/shared/lib/supabase'
import type { ChatbotTemplate, Json } from '@/shared/types/database'
import {
  isTemplateKind,
  type TemplateKind,
  type TemplateContent,
} from '@/features/templates/templateModel'

export const chatbotTemplatesQueryKey = (chatbotId: string) => ['chatbot-templates', chatbotId] as const

export async function fetchChatbotTemplates(chatbotId: string): Promise<ChatbotTemplate[]> {
  const { data, error } = await supabase
    .from('chatbot_templates')
    .select('*')
    .eq('chatbot_id', chatbotId)
    .is('deleted_at', null)
    .order('kind')
    .order('name')
  if (error) throw error
  return (data ?? []).filter((row) => isTemplateKind(row.kind))
}

export async function createChatbotTemplate(input: {
  chatbotId: string
  key: string
  name: string
  description?: string
  kind: TemplateKind
  content: TemplateContent
  createdBy?: string | null
}): Promise<ChatbotTemplate> {
  const { data, error } = await supabase
    .from('chatbot_templates')
    .insert({
      chatbot_id: input.chatbotId,
      key: input.key.trim(),
      name: input.name.trim(),
      description: input.description?.trim() || null,
      kind: input.kind,
      content: input.content as unknown as Json,
      created_by: input.createdBy ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateChatbotTemplate(
  id: string,
  patch: Partial<Pick<ChatbotTemplate, 'key' | 'name' | 'description' | 'content'>>,
): Promise<void> {
  const { error } = await supabase.from('chatbot_templates').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteChatbotTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('chatbot_templates')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export function publishedTemplatesFromRows(rows: ChatbotTemplate[]) {
  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    name: row.name,
    kind: row.kind,
    content: row.content,
  }))
}

export async function viewTemplate(templateId: string): Promise<{
  template: ChatbotTemplate
  chatbot_id: string
  instance_id: string
}> {
  const response = await fetch(`/api/template/view?id=${encodeURIComponent(templateId)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to view template' }))
    throw new Error(error.error || 'Failed to view template')
  }
  
  return response.json()
}

export async function downloadTemplate(
  templateId: string,
  format: 'json' | 'txt' = 'json',
): Promise<void> {
  const url = `/api/template/download?id=${encodeURIComponent(templateId)}&format=${format}`
  const link = document.createElement('a')
  link.href = url
  link.download = ''
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export async function exportTemplates(templateIds: string[]): Promise<void> {
  const response = await fetch('/api/template/export', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ template_ids: templateIds }),
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to export templates' }))
    throw new Error(error.error || 'Failed to export templates')
  }
  
  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `templates_export_${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export async function importTemplates(
  chatbotId: string,
  templates: Array<{
    key: string
    name: string
    description?: string
    kind: TemplateKind
    content: TemplateContent
  }>,
  overwrite = false,
): Promise<{
  imported: Array<{ id: string; key: string; action: 'created' | 'updated' }>
  skipped: string[]
  errors: string[]
  total: number
  success_count: number
}> {
  const response = await fetch('/api/template/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      chatbot_id: chatbotId,
      templates,
      overwrite,
    }),
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to import templates' }))
    throw new Error(error.error || 'Failed to import templates')
  }
  
  return response.json()
}

export async function duplicateTemplate(
  templateId: string,
  newName?: string,
): Promise<ChatbotTemplate> {
  const { template, chatbot_id } = await viewTemplate(templateId)
  
  const duplicatedTemplate = await createChatbotTemplate({
    chatbotId: chatbot_id,
    key: `${template.key}_copy`,
    name: newName || `${template.name} (Copy)`,
    description: template.description ?? undefined,
    kind: template.kind as TemplateKind,
    content: template.content as TemplateContent,
  })
  
  return duplicatedTemplate
}

export async function cloneTemplateToAnotherChatbot(
  templateId: string,
  targetChatbotId: string,
): Promise<ChatbotTemplate> {
  const { template } = await viewTemplate(templateId)
  
  const clonedTemplate = await createChatbotTemplate({
    chatbotId: targetChatbotId,
    key: template.key,
    name: template.name,
    description: template.description ?? undefined,
    kind: template.kind as TemplateKind,
    content: template.content as TemplateContent,
  })
  
  return clonedTemplate
}
