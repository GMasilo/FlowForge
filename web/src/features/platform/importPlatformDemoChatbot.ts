import { claimChatbotPublicSlug } from '@/features/chatbots/claimChatbotPublicSlug'
import {
  applyImportedBundleData,
  loadFlowBundle,
  replaceFlowInDb,
} from '@/features/chatbots/chatbotFlowTransfer'
import { buildPublishedGraph, publishedGraphAsJson } from '@/features/designer/utils/flowPublish'
import { parseFlowExport } from '@/features/designer/utils/flowTransfer'
import { fetchChatbotTemplates, publishedTemplatesFromRows } from '@/features/templates/templateApi'
import { pickJsonFile } from '@/shared/lib/downloadJson'
import { supabase } from '@/shared/lib/supabase'
import { slugify } from '@/shared/lib/utils'

export type ImportPlatformDemoResult = {
  chatbotId: string
  slug: string
  name: string
}

type ParsedFlowPack = ReturnType<typeof parseFlowExport>

type ImportPlatformDemoArgs = {
  instanceId: string
  userId: string
  /** Existing chatbot to update; created when missing or invalid. */
  existingChatbotId?: string | null
  /** Prefer this public slug; falls back to pack name / fallbackSlug. */
  preferredSlug?: string | null
  fallbackSlug: string
  publishNote: string
  descriptionFallback: string
  /** Pre-parsed pack. When omitted, prompts for a JSON file. */
  pack?: ParsedFlowPack
}

export async function importPlatformDemoChatbot(
  args: ImportPlatformDemoArgs,
): Promise<ImportPlatformDemoResult> {
  const parsed = args.pack ?? parseFlowExport(await pickJsonFile())

  const label = parsed.meta.chatbotName || parsed.meta.flowName || args.fallbackSlug
  const instanceId = args.instanceId.trim()
  let chatbotId = args.existingChatbotId?.trim() || null

  if (chatbotId) {
    const { data: existing, error: existError } = await supabase
      .from('chatbots')
      .select('id, instance_id, deleted_at')
      .eq('id', chatbotId)
      .maybeSingle()
    if (existError) throw existError
    if (!existing || existing.deleted_at || existing.instance_id !== instanceId) {
      chatbotId = null
    }
  }

  // Reuse the live bot that already owns the preferred public slug in this org.
  if (!chatbotId) {
    const preferred = args.preferredSlug?.trim() || args.fallbackSlug
    if (preferred) {
      const { data: bySlug, error: bySlugError } = await supabase
        .from('chatbots')
        .select('id, public_slug')
        .eq('instance_id', instanceId)
        .is('deleted_at', null)
      if (bySlugError) throw bySlugError
      const match = (bySlug ?? []).find(
        (row) => (row.public_slug ?? '').trim().toLowerCase() === preferred.toLowerCase(),
      )
      if (match) chatbotId = match.id
    }
  }

  if (!chatbotId) {
    const { data: created, error: insertError } = await supabase
      .from('chatbots')
      .insert({
        instance_id: instanceId,
        name: label,
        description: parsed.meta.chatbotDescription ?? args.descriptionFallback,
        created_by: args.userId,
      })
      .select('id')
      .single()
    if (insertError) throw insertError
    chatbotId = created.id
  }

  const bundle = await loadFlowBundle(chatbotId)
  await applyImportedBundleData({
    chatbotId,
    templates: parsed.templates,
    entityDefs: parsed.entityDefs,
    testScenarios: parsed.testScenarios,
    createdBy: args.userId,
  })
  const entitiesExport =
    parsed.entityDefs?.map((e) => ({ id: e.id, key: e.key })) ?? parsed.entities
  const savedFlow = await replaceFlowInDb({
    chatbotId,
    flowId: bundle.flow.id,
    nodes: parsed.nodes,
    edges: parsed.edges,
    globals: parsed.globals,
    entitiesExport,
    chatbotMeta: { name: label, description: parsed.meta.chatbotDescription },
  })

  const slug =
    args.preferredSlug?.trim() ||
    slugify(label) ||
    args.fallbackSlug

  const templateRows = await fetchChatbotTemplates(chatbotId)
  const { data: globals, error: globalsError } = await supabase
    .from('chatbot_variables')
    .select('key, value_type, default_value, description')
    .eq('chatbot_id', chatbotId)
    .eq('scope', 'global')
  if (globalsError) throw globalsError

  const graph = buildPublishedGraph({
    nodes: savedFlow.nodes,
    edges: savedFlow.edges,
    globals: (globals ?? []).map((g) => ({
      key: g.key,
      value_type: g.value_type,
      default_value: g.default_value,
      description: g.description,
    })),
    publishVersion: 1,
    publishedAt: new Date().toISOString(),
    templates: publishedTemplatesFromRows(templateRows),
  })

  const { error: publishError } = await supabase.rpc('publish_flow_version', {
    p_flow_id: bundle.flow.id,
    p_published_graph: publishedGraphAsJson(graph),
    p_note: args.publishNote,
  })
  if (publishError) throw publishError

  await claimChatbotPublicSlug({
    chatbotId,
    instanceId,
    slug,
    extra: { public_enabled: true, name: label },
  })

  return { chatbotId, slug, name: label }
}
