import { NavLink } from 'react-router-dom'
import { useRef, useState } from 'react'
import { Database, Download, LayoutTemplate, Settings2, Workflow } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { downloadJson } from '@/shared/lib/downloadJson'
import {
  buildFlowExport,
  safeDownloadBasename,
  type FlowEntityDefExport,
  type FlowTemplateExport,
  type FlowTestScenarioExport,
} from '@/features/designer/utils/flowTransfer'
import { useDesignerStore } from '@/features/designer/store/designerStore'
import { loadChatbotEntities, loadFlowBundle } from '@/features/chatbots/chatbotFlowTransfer'
import { fetchChatbotEntities } from '@/features/entities/entityApi'
import { fetchChatbotTemplates } from '@/features/templates/templateApi'
import { fetchChatbotTestScenarios } from '@/features/designer/preview/testScenarioApi'

const tabs = [
  { end: true, suffix: '', label: 'Settings', icon: Settings2 },
  { end: false, suffix: '/design', label: 'Design', icon: Workflow },
  { end: false, suffix: '/templates', label: 'Templates', icon: LayoutTemplate },
  { end: false, suffix: '/data', label: 'Data', icon: Database },
] as const

export function ChatbotSubNav({
  instanceId,
  chatbotId,
}: {
  instanceId: string
  chatbotId: string
}) {
  const base = `/instances/${instanceId}/chatbots/${chatbotId}`
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busyRef = useRef(false)

  async function onExport() {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      const store = useDesignerStore.getState()
      const [bundle, entities, entityRows, templateRows, scenarioRows] = await Promise.all([
        loadFlowBundle(chatbotId),
        loadChatbotEntities(chatbotId),
        fetchChatbotEntities(chatbotId),
        fetchChatbotTemplates(chatbotId),
        fetchChatbotTestScenarios(chatbotId),
      ])

      const nodes = store.flowId === bundle.flow.id ? store.nodes : bundle.nodes
      const edges = store.flowId === bundle.flow.id ? store.edges : bundle.edges

      const entityDefs: FlowEntityDefExport[] = entityRows.map((row) => ({
        id: row.id,
        key: row.key,
        name: row.name,
        description: row.description,
        kind: row.kind,
        attributes: row.attributes.map((a) => ({
          key: a.key,
          label: a.label,
          value_type: a.value_type,
          required: a.required,
          is_identifier: a.is_identifier,
          is_unique: a.is_unique,
          default_value: a.default_value,
          sort_order: a.sort_order,
        })),
        records: (row.static_records ?? []).map((r) =>
          r.values && typeof r.values === 'object' && !Array.isArray(r.values)
            ? (r.values as Record<string, unknown>)
            : {},
        ),
      }))
      const templates: FlowTemplateExport[] = templateRows.map((row) => ({
        key: row.key,
        name: row.name,
        description: row.description,
        kind: row.kind,
        content: row.content,
      }))
      const testScenarios: FlowTestScenarioExport[] = scenarioRows.map((row) => ({
        name: row.name,
        globals:
          row.globals && typeof row.globals === 'object' && !Array.isArray(row.globals)
            ? (row.globals as Record<string, unknown>)
            : {},
        expected:
          row.expected && typeof row.expected === 'object' && !Array.isArray(row.expected)
            ? (row.expected as { variables?: string[]; stepKeys?: string[] })
            : {},
      }))

      const payload = buildFlowExport({
        chatbot: bundle.chatbot,
        flow: bundle.flow,
        globals: bundle.globals,
        nodes,
        edges,
        entities,
        entityDefs,
        templates,
        testScenarios,
      })
      const stamp = new Date().toISOString().slice(0, 10)
      downloadJson(
        `${safeDownloadBasename(bundle.chatbot.name)}-flow-${stamp}.json`,
        payload,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <nav
          aria-label="Chatbot sections"
          className="flex w-fit rounded-xl border border-[var(--color-border)]/80 bg-slate-50/80 p-1"
        >
          {tabs.map(({ end, suffix, label, icon: Icon }) => (
            <NavLink
              key={suffix || 'settings'}
              to={`${base}${suffix}`}
              end={end}
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-[var(--color-accent)] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900',
                )
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div
          aria-label="Flow transfer"
          className="flex w-fit rounded-xl border border-[var(--color-border)]/80 bg-slate-50/80 p-1"
        >
          <button
            type="button"
            disabled={busy}
            onClick={() => void onExport()}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition',
              'text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-50',
            )}
            title="Export chatbot flow as JSON"
          >
            <Download className="h-3.5 w-3.5" />
            {busy ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </div>
      {error ? <p className="max-w-md text-right text-[11px] text-rose-600">{error}</p> : null}
    </div>
  )
}
