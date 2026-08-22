import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Check, Copy, Database, Search } from 'lucide-react'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { supabase } from '@/shared/lib/supabase'
import type { FlowNode } from '@/shared/types/database'
import type { DesignerNode } from '@/features/designer/model/flowSchema'
import { ChatbotSubNav } from '@/features/chatbots/ChatbotSubNav'
import { EntitiesPanel } from '@/features/entities/EntitiesPanel'
import { ChatbotConnectionsPanel } from '@/features/connections/ChatbotConnectionsPanel'
import { TestScenariosPanel } from '@/features/chatbots/TestScenariosPanel'
import { listChatbotConnections } from '@/features/connections/connectionApi'
import {
  collectChatbotDataInventory,
  type DataInventoryEntry,
} from '@/features/chatbots/dataInventory'
import { Badge } from '@/shared/ui/badge'
import { Card } from '@/shared/ui/card'
import { CollapsibleSection } from '@/shared/ui/collapsible-section'
import { Input } from '@/shared/ui/input'
import { cn } from '@/shared/lib/utils'

function mapNodes(nodes: FlowNode[]): DesignerNode[] {
  return nodes.map((n) => ({
    id: n.id,
    key: n.key,
    type: n.type,
    label: n.label ?? n.key,
    config: (n.config as Record<string, unknown>) ?? {},
    position: { x: n.position_x, y: n.position_y },
  }))
}

function CopyChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      title="Copy"
      className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-[var(--color-accent-soft)] px-2 py-0.5 font-mono text-[12px] text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/20 transition hover:bg-[var(--color-accent-soft)]"
    >
      <span className="truncate">{value}</span>
      {copied ? <Check className="h-3 w-3 shrink-0" /> : <Copy className="h-3 w-3 shrink-0 opacity-60" />}
    </button>
  )
}

function DataSection({
  title,
  description,
  entries,
  designHref,
}: {
  title: string
  description: string
  entries: DataInventoryEntry[]
  designHref: string
}) {
  return (
    <CollapsibleSection
      title={title}
      description={description}
      defaultOpen={false}
      badge={
        <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-ink-muted)]">
          {entries.length}
        </span>
      }
    >
      {!entries.length ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Nothing here yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-[var(--color-ink)]">{entry.label}</span>
                  {entry.typeBadge ? <Badge>{entry.typeBadge}</Badge> : null}
                </div>
                {entry.detail ? <p className="text-xs text-[var(--color-ink-muted)]">{entry.detail}</p> : null}
                <CopyChip value={entry.insert} />
              </div>
              {entry.sourceNodeKey ? (
                <Link
                  to={`${designHref}?step=${encodeURIComponent(entry.sourceNodeKey)}`}
                  className="shrink-0 text-xs font-medium text-[var(--color-accent)] hover:underline"
                >
                  Open {entry.sourceNodeKey}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </CollapsibleSection>
  )
}

export function ChatbotDataPage() {
  const { chatbotId } = useParams()
  const { instance } = useRequiredInstance()
  const [query, setQuery] = useState('')

  const chatbot = useQuery({
    queryKey: ['chatbot', chatbotId],
    enabled: !!chatbotId,
    queryFn: async () => {
      const { data, error } = await supabase.from('chatbots').select('*').eq('id', chatbotId!).single()
      if (error) throw error
      return data
    },
  })

  const bundle = useQuery({
    queryKey: ['chatbot-data-inventory', chatbotId, instance.id],
    enabled: !!chatbotId,
    queryFn: async () => {
      const { data: flow, error: flowError } = await supabase
        .from('chatbot_flows')
        .select('id')
        .eq('chatbot_id', chatbotId!)
        .single()
      if (flowError) throw flowError

      const [
        { data: nodes, error: nodesError },
        { data: globals, error: globalsError },
        connections,
        { data: linked, error: linkedError },
      ] = await Promise.all([
        supabase.from('flow_nodes').select('*').eq('flow_id', flow.id),
        supabase
          .from('chatbot_variables')
          .select('key, value_type, default_value, description')
          .eq('chatbot_id', chatbotId!)
          .eq('scope', 'global')
          .order('key'),
        listChatbotConnections(chatbotId!),
        supabase
          .from('chatbot_connections')
          .select('id, connection_id, connections(id, name, kind)')
          .eq('chatbot_id', chatbotId!),
      ])
      if (nodesError) throw nodesError
      if (globalsError) throw globalsError
      if (linkedError) throw linkedError

      return {
        nodes: (nodes ?? []) as FlowNode[],
        globals: globals ?? [],
        connections,
        linked: linked ?? [],
      }
    },
  })

  const inventory = useMemo(() => {
    if (!bundle.data) {
      return { globals: [], stepVars: [], loopLocals: [], stepRefs: [], connections: [] }
    }
    return collectChatbotDataInventory({
      globals: bundle.data.globals,
      nodes: mapNodes(bundle.data.nodes),
      connections: bundle.data.connections,
      linked: bundle.data.linked as never,
    })
  }, [bundle.data])

  const filter = query.trim().toLowerCase()
  function matches(entry: DataInventoryEntry) {
    if (!filter) return true
    return [entry.label, entry.insert, entry.detail, entry.sourceNodeKey, entry.typeBadge]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(filter))
  }

  if (chatbot.isLoading || !chatbot.data) {
    return <p className="text-sm text-[var(--color-ink-muted)]">Loading chatbot…</p>
  }

  const bot = chatbot.data
  const designHref = `/instances/${instance.id}/chatbots/${bot.id}/design`
  const counts = {
    globals: inventory.globals.length,
    stepVars: inventory.stepVars.length,
    loopLocals: inventory.loopLocals.length,
    stepRefs: inventory.stepRefs.length,
    connections: inventory.connections.filter((e) => /^conn:[^:]+$/.test(e.id)).length,
  }

  return (
    <div className="space-y-6 ff-page-enter">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{bot.name}</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Entities, variables, step outputs, and connections used by this chatbot
          </p>
        </div>
        <ChatbotSubNav instanceId={instance.id} chatbotId={bot.id} />
      </div>

      {chatbotId ? <EntitiesPanel chatbotId={chatbotId} /> : null}
      {chatbotId ? <ChatbotConnectionsPanel chatbotId={chatbotId} /> : null}
      {chatbotId ? <TestScenariosPanel chatbotId={chatbotId} /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-muted)]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search keys, steps, connections…"
            className="pl-9"
            aria-label="Search data inventory"
          />
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-[var(--color-ink-muted)]">
          <span className="rounded-full bg-[var(--color-surface-2)] px-2.5 py-1">{counts.globals} globals</span>
          <span className="rounded-full bg-[var(--color-surface-2)] px-2.5 py-1">{counts.stepVars} flow vars</span>
          <span className="rounded-full bg-[var(--color-surface-2)] px-2.5 py-1">{counts.loopLocals} loop</span>
          <span className="rounded-full bg-[var(--color-surface-2)] px-2.5 py-1">{counts.stepRefs} step refs</span>
          <span className="rounded-full bg-[var(--color-surface-2)] px-2.5 py-1">{counts.connections} connections</span>
        </div>
      </div>

      {bundle.isLoading ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Loading data inventory…</p>
      ) : bundle.isError ? (
        <Card>
          <p className="text-sm text-[var(--color-danger)]">Could not load flow data.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          <DataSection
            title="Global variables"
            description="Defined on Settings · available everywhere as {{vars.key}}"
            entries={inventory.globals.filter(matches)}
            designHref={designHref}
          />
          <DataSection
            title="Flow variables"
            description="Written by Question, HTTP, Operation, Entity, and Set variable steps"
            entries={inventory.stepVars.filter(matches)}
            designHref={designHref}
          />
          <DataSection
            title="Loop locals"
            description="Item and index names from For each steps (in scope while iterating)"
            entries={inventory.loopLocals.filter(matches)}
            designHref={designHref}
          />
          <DataSection
            title="Step references"
            description="{{steps.*}} outputs and response paths from the flow"
            entries={inventory.stepRefs.filter(matches)}
            designHref={designHref}
          />
          <DataSection
            title="Connections"
            description="Linked credentials plus inputs and expected response schema fields"
            entries={inventory.connections.filter(matches)}
            designHref={designHref}
          />
          {!inventory.globals.length &&
          !inventory.stepVars.length &&
          !inventory.loopLocals.length &&
          !inventory.stepRefs.length &&
          !inventory.connections.length ? (
            <Card className={cn('flex items-start gap-3')}>
              <Database className="mt-0.5 h-5 w-5 text-[var(--color-accent)]" />
              <div>
                <p className="font-medium text-[var(--color-ink)]">No data elements yet</p>
                <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                  Add globals in Settings, or create steps that write variables in Design.
                </p>
              </div>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  )
}
