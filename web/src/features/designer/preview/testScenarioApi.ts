import { supabase } from '@/shared/lib/supabase'
import type { ChatbotTestScenario, Json } from '@/shared/types/database'

export const chatbotTestScenariosQueryKey = (chatbotId: string) =>
  ['chatbot-test-scenarios', chatbotId] as const

export async function fetchChatbotTestScenarios(chatbotId: string): Promise<ChatbotTestScenario[]> {
  const { data, error } = await supabase
    .from('chatbot_test_scenarios')
    .select('*')
    .eq('chatbot_id', chatbotId)
    .order('name')
  if (error) throw error
  return (data ?? []) as ChatbotTestScenario[]
}

export async function createChatbotTestScenario(input: {
  chatbotId: string
  name: string
  globals: Record<string, unknown>
  expected: Record<string, unknown>
  createdBy?: string | null
}): Promise<ChatbotTestScenario> {
  const { data, error } = await supabase
    .from('chatbot_test_scenarios')
    .insert({
      chatbot_id: input.chatbotId,
      name: input.name.trim(),
      globals: input.globals as Json,
      expected: input.expected as Json,
      created_by: input.createdBy ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as ChatbotTestScenario
}

export async function updateChatbotTestScenario(
  id: string,
  patch: Partial<Pick<ChatbotTestScenario, 'name' | 'globals' | 'expected'>>,
): Promise<void> {
  const { error } = await supabase.from('chatbot_test_scenarios').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteChatbotTestScenario(id: string): Promise<void> {
  const { error } = await supabase.from('chatbot_test_scenarios').delete().eq('id', id)
  if (error) throw error
}
