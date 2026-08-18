import { NavLink } from 'react-router-dom'
import { useRef, useState } from 'react'
import { Database, Download, LayoutTemplate, Settings2, Workflow } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { downloadJson } from '@/shared/lib/downloadJson'
import {
  buildFlowExport,
  safeDownloadBasename,
} from '@/features/designer/utils/flowTransfer'
import { useDesignerStore } from '@/features/designer/store/designerStore'
import { loadChatbotEntities, loadFlowBundle } from '@/features/chatbots/chatbotFlowTransfer'

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
      const [bundle, entities] = await Promise.all([
        loadFlowBundle(chatbotId),
        loadChatbotEntities(chatbotId),
      ])

      const nodes = store.flowId === bundle.flow.id ? store.nodes : bundle.nodes
      const edges = store.flowId === bundle.flow.id ? store.edges : bundle.edges

      const payload = buildFlowExport({
        chatbot: bundle.chatbot,
        flow: bundle.flow,
        globals: bundle.globals,
        nodes,
        edges,
        entities,
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
