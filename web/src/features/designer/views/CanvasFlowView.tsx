import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  Handle,
  Position,
  MarkerType,
  ConnectionLineType,
  useReactFlow,
  type NodeProps,
  type Connection,
  type Node,
  type Edge,
} from '@xyflow/react'
import {
  Clock3,
  Calculator,
  Database,
  Flag,
  GitBranch,
  Globe,
  HelpCircle,
  ImageIcon,
  LayoutGrid,
  Mail,
  Maximize2,
  MessageSquare,
  Minimize2,
  Repeat,
  Variable,
} from 'lucide-react'
import type { FlowNodeType } from '@/shared/types/database'
import { readMediaFiles } from '@/features/designer/model/chatbotMedia'
import {
  hasCustomStepSettingsForNode,
  nodeTypeLabel,
  stepSettingsSummary,
  type DesignerNode,
} from '@/features/designer/model/flowSchema'
import { useDesignerStore } from '@/features/designer/store/designerStore'
import {
  CANVAS_NODE_WIDTH,
  computeCanvasLayout,
} from '@/features/designer/utils/canvasLayout'
import { cn } from '@/shared/lib/utils'

const icons: Record<FlowNodeType, typeof MessageSquare> = {
  message: MessageSquare,
  question: HelpCircle,
  http: Globe,
  email: Mail,
  condition: GitBranch,
  loop: Repeat,
  set_variable: Variable,
  operation: Calculator,
  entity: Database,
  end: Flag,
}

const typeColor: Record<FlowNodeType, string> = {
  message: 'var(--color-node-message)',
  question: 'var(--color-node-question)',
  http: 'var(--color-node-http)',
  email: 'var(--color-node-email)',
  condition: 'var(--color-node-condition)',
  loop: 'var(--color-node-loop)',
  set_variable: 'var(--color-node-set)',
  operation: 'var(--color-node-operation)',
  entity: 'var(--color-node-http)',
  end: 'var(--color-node-end)',
}

function truncate(value: string, max = 42) {
  const t = value.replace(/\s+/g, ' ').trim()
  if (!t) return ''
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

function stepPreview(node: DesignerNode): string {
  const c = node.config as Record<string, unknown>
  switch (node.type) {
    case 'message':
      return truncate(String(c.text ?? c.message ?? ''))
    case 'question':
      return truncate(String(c.prompt ?? c.question ?? ''))
    case 'http':
      return truncate(`${String(c.method ?? 'GET')} ${String(c.url ?? c.path ?? '')}`)
    case 'email':
      return truncate(String(c.to ?? c.subject ?? ''))
    case 'condition':
      return truncate(String(c.expression ?? c.left ?? 'If…'))
    case 'loop':
      return truncate(String(c.collection ?? 'Each item'))
    case 'set_variable':
      return truncate(`${String(c.name ?? c.variable ?? 'var')} = …`)
    case 'operation':
      return truncate(String(c.operation ?? c.name ?? ''))
    case 'entity':
      return truncate(`${String(c.operation ?? 'list')} · entity`)
    case 'end':
      return 'Conversation ends'
    default:
      return ''
  }
}

function edgeMeta(sourceHandle: string | null | undefined, label: string | null | undefined) {
  if (label === 'Then') {
    return { label: 'Then', stroke: '#64748b', labelColor: '#475569' }
  }
  if (sourceHandle === 'true' || label === 'Yes') {
    return { label: 'Yes', stroke: '#059669', labelColor: '#047857' }
  }
  if (sourceHandle === 'false' || label === 'No') {
    return { label: 'No', stroke: '#e11d48', labelColor: '#be123c' }
  }
  if (sourceHandle === 'body' || label === 'Each') {
    return { label: 'Each', stroke: '#0d9488', labelColor: '#0f766e' }
  }
  return { label: label ?? undefined, stroke: '#94a3b8', labelColor: '#64748b' }
}

function FlowStepNode({ data, selected }: NodeProps) {
  const type = data.type as FlowNodeType
  const Icon = icons[type] ?? MessageSquare
  const color = typeColor[type]
  const isCondition = type === 'condition'
  const isLoop = type === 'loop'
  const preview = typeof data.preview === 'string' ? data.preview : ''
  const customSettings = Boolean(data.customSettings)
  const settingsTitle = typeof data.settingsSummary === 'string' ? data.settingsSummary : ''
  const issueCount = typeof data.issueCount === 'number' ? data.issueCount : 0
  const hasMedia = Boolean(data.hasMedia)

  return (
    <div
      className={cn(
        'relative rounded-2xl border bg-white/95 shadow-sm backdrop-blur-sm transition-shadow',
        selected
          ? 'border-[var(--color-accent)] shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-accent)_28%,transparent)]'
          : 'border-slate-200/90 hover:border-slate-300',
        (isCondition || isLoop) && 'mb-1',
      )}
      style={{ width: CANVAS_NODE_WIDTH }}
    >
      <div
        className="absolute inset-y-2 left-0 w-1 rounded-full"
        style={{ background: color }}
        aria-hidden
      />
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-slate-400"
      />
      <div className="flex items-start gap-2.5 px-3.5 py-2.5 pl-4">
        <div
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
          style={{
            background: `linear-gradient(145deg, ${color}, color-mix(in oklab, ${color} 72%, #0f172a))`,
          }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className="truncate text-sm font-semibold text-slate-800">{String(data.label)}</div>
            {issueCount > 0 ? (
              <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-rose-200">
                {issueCount}
              </span>
            ) : null}
            {hasMedia ? (
              <span
                title="Attached media"
                className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800 ring-1 ring-violet-200/80"
              >
                <ImageIcon className="h-3 w-3" />
              </span>
            ) : null}
            {customSettings ? (
              <span
                title={settingsTitle}
                className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 ring-1 ring-sky-200/80"
              >
                <Clock3 className="h-3 w-3" />
                After
              </span>
            ) : null}
          </div>
          <div className="text-[11px] font-medium text-slate-500">{nodeTypeLabel(type)}</div>
          {preview ? (
            <div className="mt-0.5 truncate text-[11px] text-slate-400">{preview}</div>
          ) : null}
        </div>
      </div>
      {isCondition ? (
        <>
          <Handle
            type="source"
            id="true"
            position={Position.Bottom}
            style={{ left: '28%' }}
            className="!h-2.5 !w-2.5 !border-2 !border-white !bg-emerald-600"
          />
          <Handle
            type="source"
            id="false"
            position={Position.Bottom}
            style={{ left: '72%' }}
            className="!h-2.5 !w-2.5 !border-2 !border-white !bg-rose-600"
          />
        </>
      ) : isLoop ? (
        <Handle
          type="source"
          id="body"
          position={Position.Bottom}
          className="!h-2.5 !w-2.5 !border-2 !border-white !bg-teal-600"
        />
      ) : (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-2.5 !w-2.5 !border-2 !border-white !bg-slate-500"
        />
      )}
    </div>
  )
}

const nodeTypes = { flowStep: FlowStepNode }

interface CanvasFlowViewProps {
  readOnly?: boolean
  fullscreen?: boolean
  onToggleFullscreen?: () => void
}

function CanvasFlowInner({ readOnly, fullscreen, onToggleFullscreen }: CanvasFlowViewProps) {
  const nodes = useDesignerStore((s) => s.nodes)
  const edges = useDesignerStore((s) => s.edges)
  const selectedNodeId = useDesignerStore((s) => s.selectedNodeId)
  const issues = useDesignerStore((s) => s.issues)
  const selectNode = useDesignerStore((s) => s.selectNode)
  const updateNodePosition = useDesignerStore((s) => s.updateNodePosition)
  const applyNodePositions = useDesignerStore((s) => s.applyNodePositions)
  const connect = useDesignerStore((s) => s.connect)
  const setEdges = useDesignerStore((s) => s.setEdges)
  const { fitView } = useReactFlow()

  const [autoLayout, setAutoLayout] = useState(true)

  const structureKey = useMemo(
    () =>
      `${nodes.map((n) => n.id).join(',')}|${edges.map((e) => `${e.source}>${e.target}:${e.sourceHandle ?? ''}`).join(',')}`,
    [nodes, edges],
  )

  const computedLayout = useMemo(
    () => computeCanvasLayout(nodes, edges),
    // Recompute when graph structure changes — not on every manual drag of stored positions
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [structureKey],
  )

  const issueCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const i of issues) {
      if (!i.nodeId) continue
      map.set(i.nodeId, (map.get(i.nodeId) ?? 0) + 1)
    }
    return map
  }, [issues])

  const arrange = useCallback(
    (persist: boolean) => {
      const layout = computeCanvasLayout(nodes, edges)
      setAutoLayout(true)
      if (persist && !readOnly) applyNodePositions(layout)
      requestAnimationFrame(() => {
        fitView({ padding: 0.2, duration: 280 })
      })
    },
    [nodes, edges, applyNodePositions, fitView, readOnly],
  )

  // Keep stored positions aligned with auto-layout so Save writes a tidy graph
  // without marking the draft dirty for cosmetic arrange alone.
  useEffect(() => {
    if (readOnly || !autoLayout || !nodes.length) return
    applyNodePositions(computedLayout, { silent: true })
  }, [structureKey, autoLayout, readOnly, computedLayout, applyNodePositions, nodes.length])

  useEffect(() => {
    if (!fullscreen) return
    requestAnimationFrame(() => fitView({ padding: 0.16, duration: 220 }))
  }, [fullscreen, fitView])

  const rootIds = useMemo(
    () => new Set(nodes.filter((n) => !edges.some((e) => e.target === n.id)).map((n) => n.id)),
    [nodes, edges],
  )

  const rfNodes: Node[] = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: 'flowStep',
        position: autoLayout ? (computedLayout.get(n.id) ?? n.position) : n.position,
        selected: n.id === selectedNodeId,
        data: {
          label: n.label,
          key: n.key,
          type: n.type,
          preview: stepPreview(n),
          customSettings: hasCustomStepSettingsForNode(n.config, rootIds.has(n.id)),
          settingsSummary: stepSettingsSummary(n.config),
          issueCount: issueCounts.get(n.id) ?? 0,
          hasMedia: readMediaFiles(n.config).length > 0,
        },
      })),
    [nodes, selectedNodeId, rootIds, issueCounts, autoLayout, computedLayout],
  )

  const rfEdges: Edge[] = useMemo(
    () =>
      edges.map((e) => {
        const meta = edgeMeta(e.sourceHandle, e.label)
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle ?? undefined,
          type: 'smoothstep',
          label: meta.label,
          labelStyle: {
            fill: meta.labelColor,
            fontWeight: 650,
            fontSize: 11,
          },
          labelBgStyle: { fill: '#ffffff', fillOpacity: 0.92 },
          labelBgPadding: [6, 4] as [number, number],
          labelBgBorderRadius: 6,
          markerEnd: { type: MarkerType.ArrowClosed, color: meta.stroke, width: 18, height: 18 },
          style: { stroke: meta.stroke, strokeWidth: 1.75 },
        }
      }),
    [edges],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly || !connection.source || !connection.target) return
      connect({
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        label:
          connection.sourceHandle === 'true'
            ? 'Yes'
            : connection.sourceHandle === 'false'
              ? 'No'
              : connection.sourceHandle === 'body'
                ? 'Each'
                : null,
      })
      setAutoLayout(true)
    },
    [connect, readOnly],
  )

  return (
    <div
      className={cn(
        'relative overflow-hidden border border-slate-200/80 bg-[linear-gradient(160deg,#f8fafc_0%,#ffffff_42%,#f0fdfa_100%)] shadow-[var(--shadow-soft)]',
        fullscreen ? 'h-full min-h-0 rounded-xl' : 'h-[min(78vh,760px)] rounded-2xl',
      )}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: fullscreen ? 0.16 : 0.2 }}
        minZoom={0.35}
        maxZoom={1.6}
        snapToGrid
        snapGrid={[16, 16]}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable
        connectionLineType={ConnectionLineType.SmoothStep}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        onNodeClick={(_, node) => selectNode(node.id)}
        onPaneClick={() => selectNode(null)}
        onConnect={onConnect}
        onNodeDragStart={() => {
          if (autoLayout) applyNodePositions(computedLayout, { recordHistory: false })
          setAutoLayout(false)
        }}
        onNodeDragStop={(_, node) => updateNodePosition(node.id, node.position)}
        onEdgesChange={(changes) => {
          if (readOnly) return
          const removed = new Set(changes.filter((c) => c.type === 'remove').map((c) => c.id))
          if (removed.size) {
            setEdges(edges.filter((e) => !removed.has(e.id)))
          }
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#cbd5e1" />
        <Controls showInteractive={!readOnly} className="!shadow-md !overflow-hidden !rounded-xl !border-slate-200" />
        <MiniMap
          pannable
          zoomable
          className="!overflow-hidden !rounded-xl !border !border-slate-200 !shadow-md"
          nodeColor={(n) => typeColor[(n.data?.type as FlowNodeType) ?? 'message'] ?? '#94a3b8'}
          maskColor="rgb(15 23 42 / 0.08)"
        />
        <Panel position="top-right" className="flex gap-2">
          <button
            type="button"
            onClick={() => arrange(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            title="Re-arrange steps top-to-bottom (Yes left, No right)"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Arrange
          </button>
          {onToggleFullscreen ? (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen canvas'}
            >
              {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              {fullscreen ? 'Exit' : 'Fullscreen'}
            </button>
          ) : null}
        </Panel>
      </ReactFlow>
    </div>
  )
}

export function CanvasFlowView({ readOnly, fullscreen, onToggleFullscreen }: CanvasFlowViewProps) {
  return (
    <ReactFlowProvider>
      <CanvasFlowInner readOnly={readOnly} fullscreen={fullscreen} onToggleFullscreen={onToggleFullscreen} />
    </ReactFlowProvider>
  )
}
