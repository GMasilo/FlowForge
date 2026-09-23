import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { WebhooksPage } from '@/features/instances/WebhooksPage'
import { supabase } from '@/shared/lib/supabase'
import { FieldError } from '@/shared/ui/field-error'
import { ChatbotSubNav } from './ChatbotSubNav'

export function ChatbotWebhooksPage() {
  const { chatbotId } = useParams()
  const { instance } = useRequiredInstance()
  const chatbot = useQuery({
    queryKey: ['chatbot-webhooks-owner', instance.id, chatbotId],
    enabled: !!chatbotId,
    queryFn: async () => {
      const { data, error } = await supabase.from('chatbots').select('id, name')
        .eq('id', chatbotId!).eq('instance_id', instance.id).is('deleted_at', null).single()
      if (error) throw error
      return data
    },
  })
  if (chatbot.error) return <FieldError>{chatbot.error.message}</FieldError>
  if (!chatbot.data) return <p>Loading chatbot…</p>
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-xl font-semibold">{chatbot.data.name}</h1>
      <ChatbotSubNav instanceId={instance.id} chatbotId={chatbot.data.id} />
    </div>
    <WebhooksPage key={chatbot.data.id} chatbotId={chatbot.data.id} />
  </div>
}
