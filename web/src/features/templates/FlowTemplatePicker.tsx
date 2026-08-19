import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { chatbotTemplatesQueryKey, fetchChatbotTemplates } from '@/features/templates/templateApi'
import { insertSnippet, TEMPLATE_KIND_META, type TemplateKind } from '@/features/templates/templateModel'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'

function useChatbotTemplates(chatbotId?: string, kinds?: TemplateKind[]) {
  const templates = useQuery({
    queryKey: chatbotId ? chatbotTemplatesQueryKey(chatbotId) : ['chatbot-templates', 'none'],
    enabled: !!chatbotId,
    queryFn: () => fetchChatbotTemplates(chatbotId!),
  })
  const rows = useMemo(() => {
    const list = templates.data ?? []
    if (!kinds?.length) return list
    const allow = new Set(kinds)
    return list.filter((row) => allow.has(row.kind))
  }, [templates.data, kinds])
  return rows
}

function templatesHref(instanceId: string, chatbotId?: string) {
  return chatbotId ? `/instances/${instanceId}/chatbots/${chatbotId}/templates` : ''
}

export function FlowTemplatePicker({
  chatbotId,
  kinds,
  valueKey,
  label = 'Template',
  hint,
  readOnly,
  onSelectKey,
}: {
  chatbotId?: string
  kinds?: TemplateKind[]
  valueKey?: string
  label?: string
  hint?: string
  readOnly?: boolean
  onSelectKey: (key: string, snippet: string) => void
}) {
  const { instance } = useRequiredInstance()
  const { chatbotId: routeChatbotId } = useParams()
  const id = chatbotId ?? routeChatbotId
  const rows = useChatbotTemplates(id, kinds)
  const href = templatesHref(instance.id, id)

  return (
    <div>
      <Label>{label}</Label>
      <Select
        disabled={readOnly || !id}
        value={valueKey ?? ''}
        onChange={(e) => {
          const key = e.target.value
          const row = rows.find((r) => r.key === key)
          if (!row) {
            onSelectKey('', '')
            return
          }
          onSelectKey(row.key, insertSnippet(row.key, row.kind))
        }}
      >
        <option value="">Custom (no template)</option>
        {rows.map((row) => (
          <option key={row.id} value={row.key}>
            {row.name} · {TEMPLATE_KIND_META[row.kind].label}
          </option>
        ))}
      </Select>
      <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
        {hint ?? 'Uses the live template at send/preview time via {{templates.key}}.'}{' '}
        {href ? (
          <Link className="font-medium text-teal-700 hover:underline" to={href}>
            Manage templates
          </Link>
        ) : null}
      </p>
    </div>
  )
}

export function InsertTemplateControl({
  chatbotId,
  kinds,
  readOnly,
  onInsert,
}: {
  chatbotId?: string
  kinds?: TemplateKind[]
  readOnly?: boolean
  onInsert: (snippet: string, key: string) => void
}) {
  const [picked, setPicked] = useState('')
  const { chatbotId: routeChatbotId } = useParams()
  const id = chatbotId ?? routeChatbotId
  const rows = useChatbotTemplates(id, kinds)

  if (!id || !rows.length) return null

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Select
        disabled={readOnly}
        className="max-w-xs"
        value={picked}
        onChange={(e) => setPicked(e.target.value)}
      >
        <option value="">Insert a template…</option>
        {rows.map((row) => (
          <option key={row.id} value={row.key}>
            {row.name}
          </option>
        ))}
      </Select>
      <button
        type="button"
        disabled={readOnly || !picked}
        className="text-xs font-medium text-teal-700 hover:underline disabled:opacity-40"
        onClick={() => {
          const row = rows.find((r) => r.key === picked)
          if (!row) return
          onInsert(insertSnippet(row.key, row.kind), row.key)
          setPicked('')
        }}
      >
        Insert
      </button>
    </div>
  )
}
