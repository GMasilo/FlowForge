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
