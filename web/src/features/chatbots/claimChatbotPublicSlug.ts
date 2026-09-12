import { supabase } from '@/shared/lib/supabase'

function isUniqueViolation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  if (error.code === '23505') return true
  const msg = (error.message ?? '').toLowerCase()
  return msg.includes('duplicate key') || msg.includes('unique constraint')
}

function isMissingRpc(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  const msg = (error.message ?? '').toLowerCase()
  return (
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    msg.includes('could not find the function') ||
    msg.includes('function public.claim_chatbot_public_slug') ||
    (msg.includes('claim_chatbot_public_slug') && msg.includes('does not exist'))
  )
}

/**
 * Assign a public slug to a chatbot, clearing any other live bot in the same
 * organisation that currently holds that slug (case-insensitive).
 */
export async function claimChatbotPublicSlug(args: {
  chatbotId: string
  instanceId: string
  slug: string
  extra?: { public_enabled?: boolean; name?: string }
}): Promise<void> {
  const slug = args.slug.trim()
  if (!slug) throw new Error('Public slug is required')

  const chatbotId = args.chatbotId.trim()

  const { error: rpcError } = await supabase.rpc('claim_chatbot_public_slug', {
    p_chatbot_id: chatbotId,
    p_slug: slug,
    p_public_enabled: args.extra?.public_enabled ?? null,
    p_name: args.extra?.name ?? null,
  })

  if (!rpcError) return

  if (!isMissingRpc(rpcError)) {
    if (isUniqueViolation(rpcError)) {
      throw new Error(
        `Public slug “${slug}” is already used in this organisation. Choose another slug or free it from the other chatbot first.`,
      )
    }
    throw rpcError
  }

  // Fallback for environments that have not applied the RPC yet.
  const instanceId = args.instanceId.trim()
  const { data: holders, error: holdersError } = await supabase
    .from('chatbots')
    .select('id, public_slug')
    .eq('instance_id', instanceId)
    .is('deleted_at', null)
    .neq('id', chatbotId)
  if (holdersError) throw holdersError

  const takenBy = (holders ?? []).filter(
    (row) => (row.public_slug ?? '').trim().toLowerCase() === slug.toLowerCase(),
  )
  for (const row of takenBy) {
    const { error: clearError } = await supabase
      .from('chatbots')
      .update({ public_slug: null })
      .eq('id', row.id)
    if (clearError) throw clearError
  }

  const { error: updateError } = await supabase
    .from('chatbots')
    .update({
      public_slug: slug,
      ...(args.extra?.public_enabled != null ? { public_enabled: args.extra.public_enabled } : {}),
      ...(args.extra?.name != null ? { name: args.extra.name } : {}),
    })
    .eq('id', chatbotId)

  if (updateError) {
    if (isUniqueViolation(updateError)) {
      throw new Error(
        `Public slug “${slug}” is already used in this organisation. Choose another slug or free it from the other chatbot first.`,
      )
    }
    throw updateError
  }
}

export function formatChatbotSlugError(error: unknown, slug?: string): string {
  if (error instanceof Error && error.message && !isUniqueViolation(error)) return error.message
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: string }).code) : ''
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: string }).message)
      : error instanceof Error
        ? error.message
        : ''
  if (code === '23505' || /duplicate key|unique constraint/i.test(message)) {
    return slug
      ? `Public slug “${slug}” is already used in this organisation. Choose another slug or free it from the other chatbot first.`
      : 'That public slug is already used in this organisation.'
  }
  return message || 'Could not update chatbot'
}
