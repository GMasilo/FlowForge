import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Cloud, CloudOff, History, ListTree, Loader2, Minimize2, Network, Redo2, Rocket, Save, Sparkles, Undo2, X } from 'lucide-react'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import {
  canEdit,
  type FlowNode,
  type FlowEdge,
  type FlowPublishVersion,
  type Json,
} from '@/shared/types/database'
import { supabase } from '@/shared/lib/supabase'
import { dispatchWebhook, isFlowForgeApiConfigured } from '@/shared/lib/flowforgeApi'
import { useDesignerStore } from '@/features/designer/store/designerStore'
import { nodeTypeLabel, type DesignerEdge, type DesignerNode } from '@/features/designer/model/flowSchema'
import { suggestNextSteps } from '@/features/designer/model/flowSuggestions'
import { buildConnectionsMap } from '@/features/connections/connectionValidation'
import { listChatbotConnections } from '@/features/connections/connectionApi'
import { LinearFlowView } from '@/features/designer/views/LinearFlowView'
import { CanvasFlowView } from '@/features/designer/views/CanvasFlowView'
import { StepInspector } from '@/features/designer/inspector/StepInspector'
import { ProblemsPanel } from '@/features/designer/ProblemsPanel'
import { PreviewChat } from '@/features/designer/preview/PreviewChat'
import type { PreviewStepRun } from '@/features/designer/preview/previewRuntime'
import type { ScenarioResult } from '@/features/designer/preview/scenarioEval'
import { buildPublishedGraph, getPublishStatus, getStagingPublishStatus, publishedGraphAsJson } from '@/features/designer/utils/flowPublish'
import { ChatbotSubNav } from '@/features/chatbots/ChatbotSubNav'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { FieldError } from '@/shared/ui/field-error'
import type { FlowNodeType } from '@/shared/types/database'
import { cn } from '@/shared/lib/utils'
import { MediaLibraryPanel, useChatbotMedia } from '@/features/designer/MediaLibraryPanel'
import { mediaKeyFromFilename } from '@/features/designer/model/chatbotMedia'
import { chatbotTemplatesQueryKey, fetchChatbotTemplates, publishedTemplatesFromRows } from '@/features/templates/templateApi'
import { DesignerCollabPanel } from '@/features/designer/DesignerCollabPanel'
import { instanceFeatureEnabled } from '@/shared/types/database'
import {
  dbRowsToDesignerEdges,
  dbRowsToDesignerNodes,
  mergeFlowDraft,
} from '@/features/designer/collab/mergeDraft'
import type { PeerStepLock } from '@/features/designer/collab/stepLocks'
import { queuePosition } from '@/features/designer/collab/stepLocks'
import { useAuth } from '@/features/auth/AuthProvider'

const AUTOSAVE_DELAY_MS = 1200
/** AppShell header is py-2.5 + h-9 ≈ 3.5rem; toolbar sticks just below it. */
const APP_HEADER_PX = 56
const DESIGNER_ASIDE_GAP_PX = 12

function isDesignerTextField(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.closest('[data-designer-skip-undo]')) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

function mapDbToDesigner(nodes: FlowNode[], edges: FlowEdge[]): {
  nodes: DesignerNode[]
  edges: DesignerEdge[]
} {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      key: n.key,
      type: n.type,
      label: n.label ?? n.key,
      config: (n.config as Record<string, unknown>) ?? {},
      position: { x: n.position_x, y: n.position_y },
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source_node_id,
      target: e.target_node_id,
      sourceHandle: e.source_handle,
      label: e.label,
    })),
  }
}

function DesignerHistoryButtons() {
  const undo = useDesignerStore((s) => s.undo)
  const redo = useDesignerStore((s) => s.redo)
  const canUndo = useDesignerStore((s) => s.canUndo)
  const canRedo = useDesignerStore((s) => s.canRedo)
  return (
    <div className="flex rounded-xl border border-[var(--color-border)]/80 bg-slate-50/80 p-1">
      <Button
        size="sm"
        variant="ghost"
        disabled={!canUndo}
        onClick={() => undo()}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={!canRedo}
        onClick={() => redo()}
        title="Redo (Ctrl+Y)"
        aria-label="Redo"
      >
        <Redo2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

function useRelativeClock(tickMs = 15_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), tickMs)
    return () => window.clearInterval(id)
  }, [tickMs])
  return now
}

export function DesignerPage() {
  const { chatbotId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { instance, role } = useRequiredInstance()
  const { user } = useAuth()
  const qc = useQueryClient()
  const editable = canEdit(role)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewRuns, setPreviewRuns] = useState<PreviewStepRun[]>([])
  const [scenarioResult, setScenarioResult] = useState<ScenarioResult | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [canvasFullscreen, setCanvasFullscreen] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const now = useRelativeClock()
  const autosaveTimer = useRef<number | null>(null)
  const savingRef = useRef(false)
  const rehydrateFromServerRef = useRef(false)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [asideTopPx, setAsideTopPx] = useState(APP_HEADER_PX + 168)
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null)
  const setPeerLocks = useDesignerStore((s) => s.setPeerLocks)
  const mergeServerDraft = useDesignerStore((s) => s.mergeServerDraft)
  const peerLocks = useDesignerStore((s) => s.peerLocks)
  const onPeerLocksChange = useCallback(
    (locks: Record<string, PeerStepLock>) => {
      setPeerLocks(locks)
    },
    [setPeerLocks],
  )

  const setFlow = useDesignerStore((s) => s.setFlow)
  const viewMode = useDesignerStore((s) => s.viewMode)
  const setViewMode = useDesignerStore((s) => s.setViewMode)
  const nodes = useDesignerStore((s) => s.nodes)
  const edges = useDesignerStore((s) => s.edges)
  const dirty = useDesignerStore((s) => s.dirty)
  const issues = useDesignerStore((s) => s.issues)
  const selectedNodeId = useDesignerStore((s) => s.selectedNodeId)
  const selectNode = useDesignerStore((s) => s.selectNode)
  const markClean = useDesignerStore((s) => s.markClean)
  const flowId = useDesignerStore((s) => s.flowId)
  const addNode = useDesignerStore((s) => s.addNode)
  const setMediaKeys = useDesignerStore((s) => s.setMediaKeys)
  const setTemplateKeys = useDesignerStore((s) => s.setTemplateKeys)
  const undo = useDesignerStore((s) => s.undo)
  const redo = useDesignerStore((s) => s.redo)

  const chatbot = useQuery({
    queryKey: ['chatbot', chatbotId],
    enabled: !!chatbotId,
    queryFn: async () => {
      const { data, error } = await supabase.from('chatbots').select('*').eq('id', chatbotId!).single()
      if (error) throw error
      return data
    },
  })

  const flowBundle = useQuery({
    queryKey: ['flow-bundle', chatbotId],
    enabled: !!chatbotId,
    queryFn: async () => {
      const { data: flow, error: flowError } = await supabase
        .from('chatbot_flows')
        .select('*')
        .eq('chatbot_id', chatbotId!)
        .single()
      if (flowError) throw flowError

      const [{ data: nodesData, error: nodesError }, { data: edgesData, error: edgesError }, { data: vars, error: varsError }] =
        await Promise.all([
          supabase.from('flow_nodes').select('*').eq('flow_id', flow.id),
          supabase.from('flow_edges').select('*').eq('flow_id', flow.id),
          supabase.from('chatbot_variables').select('key').eq('chatbot_id', chatbotId!).eq('scope', 'global'),
        ])
      if (nodesError) throw nodesError
      if (edgesError) throw edgesError
      if (varsError) throw varsError

      return {
        flow,
        nodes: nodesData ?? [],
        edges: edgesData ?? [],
        globalVariables: (vars ?? []).map((v) => v.key),
      }
    },
  })

  const connections = useQuery({
    queryKey: ['chatbot-usable-connections', chatbotId],
    enabled: !!chatbotId,
    queryFn: () => listChatbotConnections(chatbotId!),
  })

  const mediaQuery = useChatbotMedia(instance.id, chatbotId)
  const templatesQuery = useQuery({
    queryKey: chatbotId ? chatbotTemplatesQueryKey(chatbotId) : ['chatbot-templates', 'none'],
    enabled: !!chatbotId,
    queryFn: () => fetchChatbotTemplates(chatbotId!),
  })

  useEffect(() => {
    if (!connections.data) return
    useDesignerStore.getState().setConnections(buildConnectionsMap(connections.data))
  }, [connections.data])

  useEffect(() => {
    if (!mediaQuery.isFetched) return
    setMediaKeys((mediaQuery.data ?? []).map((f) => f.key || mediaKeyFromFilename(f.filename)))
  }, [mediaQuery.data, mediaQuery.isFetched, setMediaKeys])

  useEffect(() => {
    if (!templatesQuery.isFetched) return
    const rows = templatesQuery.data ?? []
    const contents: Record<string, unknown> = {}
    for (const row of rows) {
      if (row.key.trim()) contents[row.key] = row.content
    }
    setTemplateKeys(
      rows.map((row) => row.key),
      contents,
    )
  }, [templatesQuery.data, templatesQuery.isFetched, setTemplateKeys])

  useEffect(() => {
    setHydrated(false)
    rehydrateFromServerRef.current = false
  }, [chatbotId])

  useEffect(() => {
    if (!flowBundle.data) return
    const incomingId = flowBundle.data.flow.id
    const sameFlow = useDesignerStore.getState().flowId === incomingId
    // Autosave/publish refetch the bundle; don't replace the in-memory graph or
    // the undo stack. Rollback sets rehydrateFromServerRef to apply server state.
    if (hydrated && sameFlow && !rehydrateFromServerRef.current) {
      setLastSavedAt(new Date(flowBundle.data.flow.updated_at))
      setDraftUpdatedAt(flowBundle.data.flow.updated_at)
      return
    }
    rehydrateFromServerRef.current = false
    const mapped = mapDbToDesigner(flowBundle.data.nodes, flowBundle.data.edges)
    setFlow({
      flowId: incomingId,
      nodes: mapped.nodes,
      edges: mapped.edges,
      globalVariables: flowBundle.data.globalVariables,
    })
    if (connections.data) {
      useDesignerStore.getState().setConnections(buildConnectionsMap(connections.data))
    }
    setLastSavedAt(new Date(flowBundle.data.flow.updated_at))
    setDraftUpdatedAt(flowBundle.data.flow.updated_at)
    setHydrated(true)
  }, [flowBundle.data, setFlow, hydrated, connections.data])

  useEffect(() => {
    if (!hydrated) return
    const stepKey = searchParams.get('step')
    if (!stepKey) return
    const match = nodes.find((n) => n.key === stepKey)
    if (match) selectNode(match.id)
    const next = new URLSearchParams(searchParams)
    next.delete('step')
    setSearchParams(next, { replace: true })
  }, [hydrated, nodes, searchParams, selectNode, setSearchParams])

  const selected = useMemo(() => nodes.find((n) => n.id === selectedNodeId) ?? null, [nodes, selectedNodeId])
  const selectedLock = selected?.key ? peerLocks[selected.key] : undefined
  const selectedQueuePlace = user && selectedLock ? queuePosition(selectedLock, user.id) : null
  const errorCount = issues.filter((i) => i.severity === 'error').length

  // Pull peer draft saves into non-dirty local keys
  useEffect(() => {
    if (!flowId || !instanceFeatureEnabled(instance, 'collaborative_editing')) return
    const channel = supabase
      .channel(`flow-draft:${flowId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chatbot_flows', filter: `id=eq.${flowId}` },
        () => {
          void (async () => {
            const [{ data: nodeRows }, { data: edgeRows }, { data: flowRow }] = await Promise.all([
              supabase.from('flow_nodes').select('*').eq('flow_id', flowId),
              supabase.from('flow_edges').select('*').eq('flow_id', flowId),
              supabase.from('chatbot_flows').select('updated_at').eq('id', flowId).single(),
            ])
            if (!nodeRows || !edgeRows) return
            mergeServerDraft(
              dbRowsToDesignerNodes(nodeRows as never),
              dbRowsToDesignerEdges(edgeRows as never),
            )
            if (flowRow?.updated_at) {
              setDraftUpdatedAt(flowRow.updated_at)
              setLastSavedAt(new Date(flowRow.updated_at))
            }
          })()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [flowId, instance, mergeServerDraft])

  useEffect(() => {
    if (viewMode !== 'canvas') setCanvasFullscreen(false)
  }, [viewMode])

  useEffect(() => {
    if (!editable) return
    function onKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey
      if (!meta) return
      const target = e.target as HTMLElement | null
      if (target?.closest('[data-designer-skip-undo]')) return
      const key = e.key.toLowerCase()
      if (key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (key === 'y' && !e.shiftKey) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editable, undo, redo])

  useEffect(() => {
    if (!canvasFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCanvasFullscreen(false)
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [canvasFullscreen])

  const toggleCanvasFullscreen = useCallback(() => {
    setCanvasFullscreen((v) => !v)
  }, [])

  const persistFlow = useCallback(async () => {
    const state = useDesignerStore.getState()
    if (!state.flowId || !chatbotId) throw new Error('Flow not loaded')

    async function loadServerDraft(flowId: string) {
      const [{ data: nodeRows, error: nErr }, { data: edgeRows, error: eErr }, { data: flowRow, error: fErr }] =
        await Promise.all([
          supabase.from('flow_nodes').select('*').eq('flow_id', flowId),
          supabase.from('flow_edges').select('*').eq('flow_id', flowId),
          supabase.from('chatbot_flows').select('updated_at').eq('id', flowId).single(),
        ])
      if (nErr) throw nErr
      if (eErr) throw eErr
      if (fErr) throw fErr
      return {
        nodes: dbRowsToDesignerNodes((nodeRows ?? []) as never),
        edges: dbRowsToDesignerEdges((edgeRows ?? []) as never),
        updatedAt: flowRow?.updated_at as string,
      }
    }

    async function writeMerged(expectedUpdatedAt: string | null) {
      const latest = useDesignerStore.getState()
      const server = await loadServerDraft(latest.flowId!)
      const dirtyKeys = new Set(
        latest.dirtyNodeKeys.length ? latest.dirtyNodeKeys : latest.nodes.map((n) => n.key),
      )
      const deletedKeys = new Set(latest.deletedNodeKeys)
      const lockedKeys = new Set(Object.keys(latest.peerLocks))
      const merged = mergeFlowDraft({
        serverNodes: server.nodes,
        serverEdges: server.edges,
        localNodes: latest.nodes,
        localEdges: latest.edges,
        dirtyNodeKeys: dirtyKeys,
        deletedNodeKeys: deletedKeys,
        peerLockedKeys: lockedKeys,
      })

      // Apply merge into local store so publish builds from merged graph
      useDesignerStore.setState({
        nodes: merged.nodes,
        edges: merged.edges,
      })

      const nodePayload = merged.nodes.map((n) => ({
        id: n.id,
        key: n.key,
        type: n.type,
        label: n.label,
        config: n.config,
        position_x: n.position.x,
        position_y: n.position.y,
      }))
      const edgePayload = merged.edges.map((e) => ({
        id: e.id,
        source_node_id: e.source,
        target_node_id: e.target,
        source_handle: e.sourceHandle ?? null,
        label: e.label ?? null,
      }))
      const stepVars = merged.nodes
        .map((n) => {
          const key =
            typeof n.config.outputVariable === 'string'
              ? n.config.outputVariable
              : typeof n.config.variableKey === 'string'
                ? n.config.variableKey
                : ''
          if (!key.trim()) return null
          if (!['question', 'http', 'operation', 'set_variable', 'entity'].includes(n.type)) return null
          return {
            key: key.trim(),
            value_type: 'string',
            source_node_key: n.key,
          }
        })
        .filter(Boolean)

      const expected = expectedUpdatedAt ?? server.updatedAt
      const { data: savedAt, error } = await supabase.rpc('save_flow_draft', {
        p_flow_id: latest.flowId!,
        p_nodes: nodePayload as unknown as Json,
        p_edges: edgePayload as unknown as Json,
        p_step_vars: stepVars as unknown as Json,
        p_expected_updated_at: expected,
      })
      if (error) throw error
      const at = typeof savedAt === 'string' ? savedAt : new Date().toISOString()
      setDraftUpdatedAt(at)
      return new Date(at)
    }

    try {
      return await writeMerged(draftUpdatedAt)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (/conflict/i.test(message)) {
        return await writeMerged(null)
      }
      throw err
    }
  }, [chatbotId, draftUpdatedAt])

  const publishHistory = useQuery({
    queryKey: ['flow-publish-versions', chatbotId],
    enabled: !!chatbotId && showHistory,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flow_publish_versions')
        .select('*')
        .eq('chatbot_id', chatbotId!)
        .order('published_at', { ascending: false })
        .limit(30)
      if (error) throw error
      return data as FlowPublishVersion[]
    },
  })

  const publishFlow = useCallback(async () => {
    const state = useDesignerStore.getState()
    if (!state.flowId || !chatbotId) throw new Error('Flow not loaded')

    // Ensure latest draft is on the server before snapshotting
    if (state.dirty) {
      await persistFlow()
      markClean()
    }

    const { data: globals, error: globalsError } = await supabase
      .from('chatbot_variables')
      .select('key, value_type, default_value, description')
      .eq('chatbot_id', chatbotId)
      .eq('scope', 'global')
    if (globalsError) throw globalsError

    const { data: flowRow, error: flowReadError } = await supabase
      .from('chatbot_flows')
      .select('version, published_at')
      .eq('id', state.flowId)
      .single()
    if (flowReadError) throw flowReadError

    const nextVersion = flowRow.published_at ? (flowRow.version ?? 0) + 1 : 1
    const publishedAt = new Date().toISOString()
    const templateRows = chatbotId ? await fetchChatbotTemplates(chatbotId) : []
    const graph = buildPublishedGraph({
      nodes: state.nodes,
      edges: state.edges,
      globals: (globals ?? []).map((g) => ({
        key: g.key,
        value_type: g.value_type,
        default_value: g.default_value,
        description: g.description,
      })),
      publishVersion: nextVersion,
      publishedAt,
      templates: publishedTemplatesFromRows(templateRows),
    })

    const { data: published, error: publishError } = await supabase.rpc('publish_flow_version', {
      p_flow_id: state.flowId,
      p_published_graph: publishedGraphAsJson(graph),
      p_note: null,
    })
    if (publishError) throw publishError

    if (isFlowForgeApiConfigured()) {
      try {
        await dispatchWebhook({
          instanceId: instance.id,
          event: 'flow.published',
          payload: {
            chatbot_id: chatbotId,
            flow_id: state.flowId,
            version: published?.version ?? nextVersion,
          },
        })
      } catch {
        // Webhook dispatch is best-effort; publish already succeeded.
      }
    }

    return {
      publishedAt: new Date(published?.published_at ?? publishedAt),
      version: published?.version ?? nextVersion,
    }
  }, [chatbotId, persistFlow, markClean, instance.id])

  const rollback = useMutation({
    mutationFn: async (version: number) => {
      const state = useDesignerStore.getState()
      if (!state.flowId) throw new Error('Flow not loaded')
      const { error } = await supabase.rpc('rollback_flow_version', {
        p_flow_id: state.flowId,
        p_version: version,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      setSaveError(null)
      rehydrateFromServerRef.current = true
      await flowBundle.refetch()
      await qc.invalidateQueries({ queryKey: ['flow-publish-versions', chatbotId] })
    },
    onError: (err: Error) => setSaveError(err.message),
  })

  const save = useMutation({
    mutationFn: persistFlow,
    onMutate: () => {
      savingRef.current = true
    },
    onSuccess: (savedAt) => {
      setSaveError(null)
      markClean()
      setLastSavedAt(savedAt)
      void flowBundle.refetch()
      const flowId = useDesignerStore.getState().flowId
      if (flowId && instanceFeatureEnabled(instance, 'collaborative_editing')) {
        void supabase.rpc('append_flow_change_log', {
          p_flow_id: flowId,
          p_summary: 'Autosave',
          p_patch: {},
          p_snapshot: {
            nodes: useDesignerStore.getState().nodes,
            edges: useDesignerStore.getState().edges,
          } as unknown as Json,
        })
      }
    },
    onError: (err: Error) => setSaveError(err.message),
    onSettled: () => {
      savingRef.current = false
    },
  })

  const publish = useMutation({
    mutationFn: publishFlow,
    onSuccess: async (result) => {
      setSaveError(null)
      setLastSavedAt(result.publishedAt)
      await flowBundle.refetch()
      await qc.invalidateQueries({ queryKey: ['flow-publish-versions', chatbotId] })
    },
    onError: (err: Error) => setSaveError(err.message),
  })

  const publishStaging = useMutation({
    mutationFn: async () => {
      const state = useDesignerStore.getState()
      if (!state.flowId || !chatbotId) throw new Error('Flow not loaded')
      if (state.dirty) {
        await persistFlow()
        markClean()
      }
      const { data: globals, error: globalsError } = await supabase
        .from('chatbot_variables')
        .select('key, value_type, default_value, description')
        .eq('chatbot_id', chatbotId)
        .eq('scope', 'global')
      if (globalsError) throw globalsError
      const templateRows = await fetchChatbotTemplates(chatbotId)
      const nextStaging = (flowBundle.data?.flow.staging_version ?? 0) + 1
      const publishedAt = new Date().toISOString()
      const graph = buildPublishedGraph({
        nodes: state.nodes,
        edges: state.edges,
        globals: (globals ?? []).map((g) => ({
          key: g.key,
          value_type: g.value_type,
          default_value: g.default_value,
          description: g.description,
        })),
        publishVersion: nextStaging,
        publishedAt,
        templates: publishedTemplatesFromRows(templateRows),
      })
      const { data, error } = await supabase.rpc('publish_flow_staging', {
        p_flow_id: state.flowId,
        p_published_graph: publishedGraphAsJson(graph),
        p_note: null,
      })
      if (error) throw error
      return {
        publishedAt: new Date(data?.staging_published_at ?? publishedAt),
        version: data?.staging_version ?? nextStaging,
      }
    },
    onSuccess: async () => {
      setSaveError(null)
      await flowBundle.refetch()
    },
    onError: (err: Error) => setSaveError(err.message),
  })

  const promoteStaging = useMutation({
    mutationFn: async () => {
      const state = useDesignerStore.getState()
      if (!state.flowId) throw new Error('Flow not loaded')
      const { data, error } = await supabase.rpc('promote_staging_to_production', {
        p_flow_id: state.flowId,
        p_note: 'Promoted from staging',
      })
      if (error) throw error
      return data
    },
    onSuccess: async () => {
      setSaveError(null)
      await flowBundle.refetch()
      await qc.invalidateQueries({ queryKey: ['flow-publish-versions', chatbotId] })
    },
    onError: (err: Error) => setSaveError(err.message),
  })

  const flushAutosave = useCallback(() => {
    if (!editable || !hydrated) return
    if (autosaveTimer.current) {
      window.clearTimeout(autosaveTimer.current)
      autosaveTimer.current = null
    }
    if (savingRef.current) return
    const state = useDesignerStore.getState()
    if (!state.dirty || !state.flowId) return
    save.mutate()
  }, [editable, hydrated, save])

  // Idle autosave for structural edits. Text fields wait for blur instead.
  useEffect(() => {
    if (!editable || !hydrated || !dirty || !flowId) return
    if (isDesignerTextField(document.activeElement)) return
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current)
    autosaveTimer.current = window.setTimeout(() => {
      if (savingRef.current) return
      if (!useDesignerStore.getState().dirty) return
      if (isDesignerTextField(document.activeElement)) return
      save.mutate()
    }, AUTOSAVE_DELAY_MS)
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current)
    }
  }, [dirty, nodes, edges, editable, hydrated, flowId, save])

  useEffect(() => {
    if (!editable) return
    function onFocusIn(e: FocusEvent) {
      if (!isDesignerTextField(e.target)) return
      if (autosaveTimer.current) {
        window.clearTimeout(autosaveTimer.current)
        autosaveTimer.current = null
      }
    }
    function onFocusOut(e: FocusEvent) {
      if (!isDesignerTextField(e.target)) return
      if (isDesignerTextField(e.relatedTarget)) return
      flushAutosave()
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [editable, flushAutosave])

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current)
    }
  }, [])

  const saveStatus = useMemo(() => {
    void now
    if (save.isPending) return { kind: 'saving' as const, label: 'Saving…' }
    if (dirty) return { kind: 'dirty' as const, label: 'Unsaved changes' }
    if (lastSavedAt) {
      return {
        kind: 'saved' as const,
        label: `Saved ${formatDistanceToNow(lastSavedAt, { addSuffix: true })}`,
      }
    }
    return { kind: 'idle' as const, label: 'All changes saved' }
  }, [dirty, lastSavedAt, save.isPending, now])

  const publishStatus = useMemo(() => {
    if (!flowBundle.data?.flow) return null
    return getPublishStatus(flowBundle.data.flow)
  }, [flowBundle.data?.flow])

  const stagingStatus = useMemo(() => {
    if (!flowBundle.data?.flow) return null
    return getStagingPublishStatus(flowBundle.data.flow)
  }, [flowBundle.data?.flow])

  const stagingPublicUrl = useMemo(() => {
    const slug = (chatbot.data?.public_slug ?? '').trim()
    if (!slug || stagingStatus?.kind !== 'live') return null
    const basename = (import.meta.env.BASE_URL as string).replace(/\/$/, '')
    return `${window.location.origin}${basename}/c/${slug}?env=staging`
  }, [chatbot.data?.public_slug, stagingStatus?.kind])

  const canPublish =
    editable &&
    !!flowBundle.data?.flow &&
    !publish.isPending &&
    !save.isPending &&
    (dirty || flowBundle.data.flow.has_draft_changes || !flowBundle.data.flow.published_at)

  const canPublishStaging =
    editable &&
    instanceFeatureEnabled(instance, 'staging') &&
    !!flowBundle.data?.flow &&
    !publishStaging.isPending &&
    !save.isPending

  const canvasSuggestions = useMemo(
    () => (viewMode === 'canvas' ? suggestNextSteps({ nodes, edges, afterNodeId: selectedNodeId, limit: 3 }) : []),
    [viewMode, nodes, edges, selectedNodeId],
  )

  const canvasPalette =
    editable && viewMode === 'canvas' ? (
      <div className="space-y-2">
        {canvasSuggestions.length ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-teal-800">
              <Sparkles className="h-3 w-3" />
              Suggested
            </span>
            {canvasSuggestions.map((s) => (
              <Button
                key={`${s.type}:${s.label}`}
                size="sm"
                variant="secondary"
                title={s.reason}
                className="border-teal-300/80 bg-teal-50 text-teal-900 hover:border-teal-400"
                onClick={() => addNode(s.type, selectedNodeId, s.seed)}
              >
                + {s.label}
              </Button>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          {(['message', 'question', 'http', 'email', 'integration', 'handoff', 'transfer', 'condition', 'loop', 'set_variable', 'operation', 'entity'] as FlowNodeType[]).map(
            (t) => (
              <Button key={t} size="sm" variant="secondary" onClick={() => addNode(t, selectedNodeId)}>
                + {nodeTypeLabel(t)}
              </Button>
            ),
          )}
        </div>
      </div>
    ) : null

  const inspectorCard = (
    <Card
      className={cn(
        'h-fit',
        canvasFullscreen
          ? 'flex h-full max-h-full flex-col overflow-y-auto'
          : 'lg:sticky lg:top-[var(--ff-designer-aside-top,5rem)] lg:max-h-[calc(100vh-var(--ff-designer-aside-top,7.5rem)-1.5rem)] lg:overflow-y-auto',
      )}
    >
      {selected ? (
        <StepInspector
          node={selected}
          connections={connections.data ?? []}
          connectionsReady={connections.isSuccess}
          readOnly={!editable}
          lockedBy={
            selectedLock
              ? {
                  name: selectedLock.name,
                  color: selectedLock.color,
                  waitingHint:
                    selectedQueuePlace != null
                      ? `You are #${selectedQueuePlace + 1} in line — edit unlocks when earlier editors leave this step.`
                      : selectedLock.queue.length
                        ? `Waiting: ${selectedLock.queue.map((q) => q.name).join(' → ')}`
                        : undefined,
                }
              : null
          }
        />
      ) : (
        <p className="text-sm text-[var(--color-ink-muted)]">Select a step to configure it.</p>
      )}
    </Card>
  )

  const canvasView = (
    <CanvasFlowView
      readOnly={!editable}
      fullscreen={canvasFullscreen}
      onToggleFullscreen={toggleCanvasFullscreen}
    />
  )

  const designerReady = !flowBundle.isLoading && !chatbot.isLoading

  useLayoutEffect(() => {
    const el = toolbarRef.current
    if (!el) return
    const sync = () => setAsideTopPx(APP_HEADER_PX + el.offsetHeight + DESIGNER_ASIDE_GAP_PX)
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [designerReady])

  if (!designerReady) {
    return <p className="text-sm text-[var(--color-ink-muted)]">Loading designer…</p>
  }

  return (
    <div
      className="space-y-4"
      style={{ '--ff-designer-aside-top': `${asideTopPx}px` } as CSSProperties}
    >
      <div
        ref={toolbarRef}
        className="sticky top-14 z-[15] flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/90 p-4 shadow-[var(--shadow-soft)] backdrop-blur-xl"
      >
        <div>
          <div className="text-xs text-[var(--color-ink-muted)]">
            <Link to={`/instances/${instance.id}`} className="hover:text-teal-700 hover:underline">
              Chatbots
            </Link>
            {' / '}
            <Link to={`/instances/${instance.id}/chatbots/${chatbotId}`} className="hover:text-teal-700 hover:underline">
              {chatbot.data?.name}
            </Link>
          </div>
          <h1 className="bg-gradient-to-br from-slate-900 to-teal-800 bg-clip-text text-2xl font-semibold text-transparent">
            Flow designer
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {editable ? (
              <div
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
                  saveStatus.kind === 'saving' && 'bg-sky-50 text-sky-700',
                  saveStatus.kind === 'dirty' && 'bg-amber-50 text-amber-700',
                  saveStatus.kind === 'saved' && 'bg-emerald-50 text-emerald-700',
                  saveStatus.kind === 'idle' && 'bg-slate-100 text-slate-500',
                )}
                title={lastSavedAt ? lastSavedAt.toLocaleString() : undefined}
              >
                {saveStatus.kind === 'saving' ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : saveStatus.kind === 'dirty' ? (
                  <CloudOff className="h-3 w-3" />
                ) : (
                  <Cloud className="h-3 w-3" />
                )}
                {saveStatus.label}
                {errorCount > 0 ? (
                  <span className="text-rose-600">
                    · {errorCount} issue{errorCount === 1 ? '' : 's'}
                  </span>
                ) : null}
              </div>
            ) : null}
            {publishStatus ? (
              <div
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
                  publishStatus.kind === 'live' && 'bg-emerald-50 text-emerald-800',
                  publishStatus.kind === 'draft' && 'bg-amber-50 text-amber-800',
                  publishStatus.kind === 'never' && 'bg-slate-100 text-slate-600',
                )}
                title={
                  publishStatus.kind === 'never'
                    ? 'Editing draft only — nothing is live yet'
                    : `Live published ${new Date(publishStatus.publishedAt).toLocaleString()}. Designer edits stay in draft until you publish.`
                }
              >
                <Rocket className="h-3 w-3" />
                {publishStatus.label}
              </div>
            ) : null}
            {instanceFeatureEnabled(instance, 'staging') && stagingStatus ? (
              <div
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
                  stagingStatus.kind === 'live' && 'bg-sky-50 text-sky-800',
                  stagingStatus.kind === 'never' && 'bg-slate-100 text-slate-600',
                )}
                title={
                  stagingStatus.kind === 'never'
                    ? 'Publish to staging to test without changing production'
                    : `Staging published ${new Date(stagingStatus.publishedAt).toLocaleString()}`
                }
              >
                {stagingStatus.label}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {chatbotId ? (
            <ChatbotSubNav instanceId={instance.id} chatbotId={chatbotId} />
          ) : null}
          {editable ? <DesignerHistoryButtons /> : null}
          <div className="flex rounded-xl border border-[var(--color-border)]/80 bg-slate-50/80 p-1">
            <Button
              size="sm"
              variant={viewMode === 'linear' ? 'primary' : 'ghost'}
              onClick={() => setViewMode('linear')}
            >
              <ListTree className="h-4 w-4" />
              Linear
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'canvas' ? 'primary' : 'ghost'}
              onClick={() => setViewMode('canvas')}
            >
              <Network className="h-4 w-4" />
              Canvas
            </Button>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setPreviewOpen(true)}>
            Preview
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowHistory((v) => !v)}
          >
            <History className="h-4 w-4" />
            History
          </Button>
          {editable ? (
            <>
              <Button size="sm" disabled={save.isPending || !dirty} onClick={() => save.mutate()}>
                <Save className="h-4 w-4" />
                {save.isPending ? 'Saving…' : dirty ? 'Save now' : 'Saved'}
              </Button>
              <Button
                size="sm"
                disabled={!canPublish}
                onClick={() => {
                  if (errorCount > 0) {
                    const ok = window.confirm(
                      `This flow has ${errorCount} validation issue${errorCount === 1 ? '' : 's'}. Publish anyway?`,
                    )
                    if (!ok) return
                  } else {
                    const ok = window.confirm(
                      'Publish this draft to production?\n\nLive consumers will use this snapshot. Further designer edits will not go live until you publish again.',
                    )
                    if (!ok) return
                  }
                  publish.mutate()
                }}
              >
                <Rocket className="h-4 w-4" />
                {publish.isPending ? 'Publishing…' : 'Publish'}
              </Button>
              {instanceFeatureEnabled(instance, 'staging') ? (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!canPublishStaging}
                    onClick={() => {
                      if (errorCount > 0) {
                        const ok = window.confirm(
                          `This flow has ${errorCount} validation issue${errorCount === 1 ? '' : 's'}. Publish to staging anyway?`,
                        )
                        if (!ok) return
                      } else {
                        const ok = window.confirm(
                          'Publish current draft to staging?\n\nProduction stays unchanged. Open the staging link from Settings or after publish.',
                        )
                        if (!ok) return
                      }
                      publishStaging.mutate()
                    }}
                  >
                    {publishStaging.isPending ? 'Staging…' : 'Publish staging'}
                  </Button>
                  {stagingStatus?.kind === 'live' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={promoteStaging.isPending || publish.isPending}
                      onClick={() => {
                        const ok = window.confirm(
                          `Promote staging v${stagingStatus.version} to production?\n\nThis creates a new production publish from the staging snapshot.`,
                        )
                        if (!ok) return
                        promoteStaging.mutate()
                      }}
                    >
                      {promoteStaging.isPending ? 'Promoting…' : 'Promote staging'}
                    </Button>
                  ) : null}
                  {stagingPublicUrl ? (
                    <a
                      href={stagingPublicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-xl px-2.5 py-1.5 text-xs font-medium text-sky-800 underline-offset-2 hover:underline"
                    >
                      Open staging
                    </a>
                  ) : null}
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <div className="space-y-4 ff-page-enter">
      {saveError ? <FieldError>{saveError}</FieldError> : null}

      {chatbotId ? <MediaLibraryPanel instanceId={instance.id} chatbotId={chatbotId} /> : null}

      {showHistory ? (
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800">Publish history</h2>
            <Button size="sm" variant="ghost" onClick={() => setShowHistory(false)}>
              Close
            </Button>
          </div>
          {publishHistory.isLoading ? (
            <p className="text-sm text-[var(--color-ink-muted)]">Loading…</p>
          ) : publishHistory.data?.length ? (
            <ul className="divide-y divide-slate-100">
              {publishHistory.data.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <span className="font-medium text-slate-800">v{row.version}</span>
                    <span className="ml-2 text-[11px] text-slate-500">
                      {formatDistanceToNow(new Date(row.published_at), { addSuffix: true })}
                    </span>
                    {row.note ? (
                      <span className="mt-0.5 block text-[11px] text-slate-400">{row.note}</span>
                    ) : null}
                  </div>
                  {editable ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={rollback.isPending}
                      onClick={() => {
                        const ok = window.confirm(
                          `Rollback live published graph to v${row.version}? A new publish version will be created.`,
                        )
                        if (!ok) return
                        rollback.mutate(row.version)
                      }}
                    >
                      Rollback
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--color-ink-muted)]">No publish history yet.</p>
          )}
        </Card>
      ) : null}

      {!canvasFullscreen ? canvasPalette : null}

      <div
        className={cn(
          'grid gap-4',
          instanceFeatureEnabled(instance, 'collaborative_editing')
            ? 'lg:grid-cols-[280px_minmax(0,1fr)_320px_minmax(240px,280px)]'
            : 'lg:grid-cols-[280px_minmax(0,1fr)_320px]',
        )}
      >
        <ProblemsPanel
          previewOpen={previewOpen}
          runs={previewRuns}
          scenarioResult={scenarioResult}
          chatbot={chatbot.data ? { id: chatbot.data.id, name: chatbot.data.name } : null}
        />
        <div className="min-w-0">
          {viewMode === 'linear' ? <LinearFlowView readOnly={!editable} /> : !canvasFullscreen ? canvasView : null}
        </div>
        {!canvasFullscreen ? inspectorCard : null}
        {instanceFeatureEnabled(instance, 'collaborative_editing') && flowBundle.data?.flow.id ? (
          <DesignerCollabPanel
            flowId={flowBundle.data.flow.id}
            instanceId={instance.id}
            chatbotId={chatbotId!}
            role={role}
            selectedNodeKey={selected?.key ?? null}
            onPeerLocksChange={onPeerLocksChange}
          />
        ) : null}
      </div>

      {canvasFullscreen && viewMode === 'canvas'
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex flex-col bg-slate-100/95 backdrop-blur-[2px]">
              <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-800">Canvas · {chatbot.data?.name ?? 'Flow'}</div>
                  <div className="text-[11px] text-slate-500">Wider editing view — press Esc to exit</div>
                </div>
                {canvasPalette}
                {editable ? <DesignerHistoryButtons /> : null}
                <Button size="sm" variant="secondary" onClick={() => setCanvasFullscreen(false)}>
                  <Minimize2 className="h-4 w-4" />
                  Exit fullscreen
                </Button>
                <button
                  type="button"
                  aria-label="Close fullscreen"
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  onClick={() => setCanvasFullscreen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="min-h-0 min-w-0">{canvasView}</div>
                <div className="min-h-0 overflow-hidden">{inspectorCard}</div>
              </div>
            </div>,
            document.body,
          )
        : null}

      <PreviewChat
        open={previewOpen}
        onOpenChange={(next) => {
          setPreviewOpen(next)
          if (!next) {
            setPreviewRuns([])
            setScenarioResult(null)
          }
        }}
        onRunsChange={setPreviewRuns}
        onScenarioResult={setScenarioResult}
      />
      </div>
    </div>
  )
}
