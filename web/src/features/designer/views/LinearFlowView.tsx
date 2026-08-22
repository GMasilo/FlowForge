import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  Clock3,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  ClipboardPaste,
  GitBranch,
  GripVertical,
  MessageSquare,
  HelpCircle,
  Globe,
  Mail,
  MoreHorizontal,
  Variable,
  Calculator,
  Flag,
  ImageIcon,
  Plus,
  Repeat,
  Database,
  Sparkles,
} from 'lucide-react'
import type { FlowNodeType } from '@/shared/types/database'
import { hasCustomStepSettingsForNode, nodeTypeLabel, stepSettingsSummary } from '@/features/designer/model/flowSchema'
import { suggestNextSteps } from '@/features/designer/model/flowSuggestions'
import { readMediaFiles } from '@/features/designer/model/chatbotMedia'
import { useDesignerStore, type AddNodeSeed } from '@/features/designer/store/designerStore'
import {
  buildLinearItems,
  edgesForConditionThen,
  edgesInsertBeforeContinueRoot,
  edgesInsertBranchStep,
  findContinueRootIds,
  type LinearItem,
} from '@/features/designer/utils/conditionGraph'
import {
  findSiblingContext,
  isReorderableNode,
  toScopeTree,
  type ScopeNode,
} from '@/features/designer/utils/sequenceEdit'
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

const STEP_TYPES: FlowNodeType[] = [
  'message',
  'question',
  'http',
  'email',
  'condition',
  'loop',
  'set_variable',
  'operation',
  'entity',
  'end',
]

interface LinearFlowViewProps {
  readOnly?: boolean
}

function countSteps(nodes: ScopeNode[]): number {
  let n = 0
  for (const node of nodes) {
    n += 1
    if (node.kind === 'condition') {
      n += countSteps(node.yes) + countSteps(node.no) + countSteps(node.then)
    } else if (node.kind === 'loop') {
      n += countSteps(node.body) + countSteps(node.then)
    }
  }
  return n
}

export function LinearFlowView({ readOnly }: LinearFlowViewProps) {
  const nodes = useDesignerStore((s) => s.nodes)
  const edges = useDesignerStore((s) => s.edges)
  const selectedNodeId = useDesignerStore((s) => s.selectedNodeId)
  const selectNode = useDesignerStore((s) => s.selectNode)
  const addNode = useDesignerStore((s) => s.addNode)
  const setEdges = useDesignerStore((s) => s.setEdges)
  const beginHistoryBatch = useDesignerStore((s) => s.beginHistoryBatch)
  const endHistoryBatch = useDesignerStore((s) => s.endHistoryBatch)
  const issues = useDesignerStore((s) => s.issues)
  const clipboard = useDesignerStore((s) => s.clipboard)
  const copyNode = useDesignerStore((s) => s.copyNode)
  const pasteAfter = useDesignerStore((s) => s.pasteAfter)
  const duplicateNode = useDesignerStore((s) => s.duplicateNode)
  const moveNode = useDesignerStore((s) => s.moveNode)
  const moveNodeToIndex = useDesignerStore((s) => s.moveNodeToIndex)
  const canMoveNode = useDesignerStore((s) => s.canMoveNode)

  const items = useMemo(() => buildLinearItems(nodes, edges), [nodes, edges])
  const tree = useMemo(() => toScopeTree(items), [items])

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  const issueCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const i of issues) {
      if (!i.nodeId) continue
      map.set(i.nodeId, (map.get(i.nodeId) ?? 0) + 1)
    }
    return map
  }, [issues])

  useEffect(() => {
    if (readOnly) return
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }
      const meta = e.metaKey || e.ctrlKey
      if (!meta) return
      const key = e.key.toLowerCase()
      if (key === 'c') {
        if (!selectedNodeId) return
        if (copyNode(selectedNodeId)) e.preventDefault()
      } else if (key === 'v') {
        if (!clipboard) return
        pasteAfter(selectedNodeId)
        e.preventDefault()
      } else if (key === 'd') {
        if (!selectedNodeId) return
        if (duplicateNode(selectedNodeId)) e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [readOnly, selectedNodeId, clipboard, copyNode, pasteAfter, duplicateNode])

  function toggleCollapsed(id: string) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function rewireAfterAdd(rewire: () => void) {
    queueMicrotask(() => {
      try {
        rewire()
      } finally {
        endHistoryBatch()
      }
    })
  }

  function addBranchStep(
    conditionId: string,
    handle: 'true' | 'false' | 'body',
    type: FlowNodeType,
    seed?: AddNodeSeed,
  ) {
    beginHistoryBatch()
    const createdId = addNode(type, null, seed)
    rewireAfterAdd(() => {
      const state = useDesignerStore.getState()
      setEdges(
        edgesInsertBranchStep({
          conditionId,
          handle,
          newNodeId: createdId,
          edges: state.edges,
          newId: () => crypto.randomUUID(),
        }),
      )
    })
  }

  function addAfterCondition(conditionId: string, type: FlowNodeType, seed?: AddNodeSeed) {
    const allRoots = [...findContinueRootIds(conditionId, edges, nodes)]
    const nonEndRoots = allRoots.filter((id) => {
      const n = nodes.find((x) => x.id === id)
      return n && n.type !== 'end'
    })
    const endRoot = allRoots.find((id) => nodes.find((x) => x.id === id)?.type === 'end')

    const firstContinue =
      edges
        .filter((e) => e.source === conditionId && e.label === 'Then')
        .map((e) => e.target)
        .find((id) => nonEndRoots.includes(id)) ?? nonEndRoots[0]

    beginHistoryBatch()
    if (firstContinue) {
      const createdId = addNode(type, null, seed)
      rewireAfterAdd(() => {
        const state = useDesignerStore.getState()
        setEdges(
          edgesInsertBeforeContinueRoot({
            conditionId,
            newNodeId: createdId,
            continueRootId: firstContinue,
            edges: state.edges,
            nodes: state.nodes,
            newId: () => crypto.randomUUID(),
          }),
        )
      })
      return
    }

    if (endRoot) {
      const createdId = addNode(type, null, seed)
      rewireAfterAdd(() => {
        const state = useDesignerStore.getState()
        setEdges(
          edgesInsertBeforeContinueRoot({
            conditionId,
            newNodeId: createdId,
            continueRootId: endRoot,
            edges: state.edges,
            nodes: state.nodes,
            newId: () => crypto.randomUUID(),
          }),
        )
      })
      return
    }

    const createdId = addNode(type, null, seed)
    rewireAfterAdd(() => {
      const state = useDesignerStore.getState()
      let working = state.edges.filter(
        (e) => !(e.source === conditionId && e.target === createdId && !e.sourceHandle),
      )
      working = edgesForConditionThen({
        conditionId,
        thenNodeId: createdId,
        edges: working,
        nodes: state.nodes,
        newId: () => crypto.randomUUID(),
      })
      setEdges(working)
    })
  }

  function renderSequence(
    seq: ScopeNode[],
    opts: {
      emptyMenuId: string
      onAddEmpty: (type: FlowNodeType, seed?: AddNodeSeed) => void
      emptyHint: string
      afterNodeId?: string | null
    },
  ) {
    if (!seq.length) {
      if (readOnly) {
        return <p className="px-1 py-2 text-xs text-[var(--color-ink-muted)]">No actions</p>
      }
      return (
        <AddStepControl
          menuId={opts.emptyMenuId}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          afterNodeId={opts.afterNodeId ?? null}
          onAdd={(type, seed) => {
            opts.onAddEmpty(type, seed)
            setOpenMenu(null)
          }}
          hint={opts.emptyHint}
        />
      )
    }

    return (
      <div className="flex flex-col">
        {seq.map((node, idx) => {
          const id = node.item.node.id
          const moves = canMoveNode(id)
          const reorderable = isReorderableNode(node.item.node)
          return (
            <div
              key={id}
              className={cn(
                'flex flex-col items-stretch rounded-xl transition',
                dropTargetId === id && dragId && dragId !== id ? 'ring-2 ring-[var(--color-accent)]/50 ring-offset-2' : null,
              )}
              onDragOver={
                readOnly || !reorderable
                  ? undefined
                  : (e) => {
                      if (!dragId || dragId === id) return
                      const ctx = findSiblingContext(nodes, edges, dragId)
                      const here = findSiblingContext(nodes, edges, id)
                      if (!ctx || !here || JSON.stringify(ctx.sequenceIds) !== JSON.stringify(here.sequenceIds)) {
                        return
                      }
                      e.preventDefault()
                      setDropTargetId(id)
                    }
              }
              onDrop={
                readOnly || !reorderable
                  ? undefined
                  : (e) => {
                      e.preventDefault()
                      if (!dragId || dragId === id) return
                      const ctx = findSiblingContext(nodes, edges, dragId)
                      const here = findSiblingContext(nodes, edges, id)
                      if (!ctx || !here || JSON.stringify(ctx.sequenceIds) !== JSON.stringify(here.sequenceIds)) {
                        setDragId(null)
                        setDropTargetId(null)
                        return
                      }
                      moveNodeToIndex(dragId, here.index)
                      setDragId(null)
                      setDropTargetId(null)
                    }
              }
            >
              {idx > 0 ? <FlowConnector /> : null}
              {node.kind === 'condition' ? (
                <ConditionBlock
                  node={node}
                  readOnly={readOnly}
                  collapsed={!!collapsed[id]}
                  onToggle={() => toggleCollapsed(id)}
                  selectedNodeId={selectedNodeId}
                  issueCounts={issueCounts}
                  openMenu={openMenu}
                  setOpenMenu={setOpenMenu}
                  onSelect={selectNode}
                  addBranchStep={addBranchStep}
                  addAfterCondition={addAfterCondition}
                  renderSequence={renderSequence}
                  onCopy={() => copyNode(id)}
                  onPaste={() => pasteAfter(id)}
                  onDuplicate={() => duplicateNode(id)}
                  canPaste={!!clipboard}
                />
              ) : node.kind === 'loop' ? (
                <LoopBlock
                  node={node}
                  readOnly={readOnly}
                  collapsed={!!collapsed[id]}
                  onToggle={() => toggleCollapsed(id)}
                  selectedNodeId={selectedNodeId}
                  issueCounts={issueCounts}
                  openMenu={openMenu}
                  setOpenMenu={setOpenMenu}
                  onSelect={selectNode}
                  addBranchStep={addBranchStep}
                  addAfterCondition={addAfterCondition}
                  renderSequence={renderSequence}
                  onCopy={() => copyNode(id)}
                  onPaste={() => pasteAfter(id)}
                  onDuplicate={() => duplicateNode(id)}
                  canPaste={!!clipboard}
                />
              ) : (
                <StepCard
                  item={node.item}
                  selected={selectedNodeId === id}
                  errCount={issueCounts.get(id) ?? 0}
                  readOnly={!!readOnly}
                  canMoveUp={moves.up}
                  canMoveDown={moves.down}
                  canPaste={!!clipboard}
                  dragging={dragId === id}
                  onSelect={() => selectNode(id)}
                  onCopy={() => copyNode(id)}
                  onPaste={() => pasteAfter(id)}
                  onDuplicate={() => duplicateNode(id)}
                  onMoveUp={() => moveNode(id, 'up')}
                  onMoveDown={() => moveNode(id, 'down')}
                  onDragStart={() => setDragId(id)}
                  onDragEnd={() => {
                    setDragId(null)
                    setDropTargetId(null)
                  }}
                />
              )}
              {!readOnly && node.kind === 'step' && node.item.node.type !== 'end' ? (
                <>
                  <FlowConnector faint />
                  <AddStepControl
                    menuId={`after-${id}`}
                    openMenu={openMenu}
                    setOpenMenu={setOpenMenu}
                    afterNodeId={id}
                    onAdd={(type, seed) => {
                      addNode(type, id, seed)
                      setOpenMenu(null)
                    }}
                  />
                </>
              ) : null}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="ff-stagger mx-auto flex w-full max-w-2xl flex-col items-stretch gap-0 px-1">
      {tree.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-muted)]">No steps yet.</p>
      ) : (
        renderSequence(tree, {
          emptyMenuId: 'root-empty',
          emptyHint: 'Add an action',
          afterNodeId: null,
          onAddEmpty: (type, seed) => addNode(type, null, seed),
        })
      )}
    </div>
  )
}

function FlowConnector({ faint }: { faint?: boolean }) {
  return (
    <div className="flex justify-center py-0.5" aria-hidden>
      <div
        className={cn(
          'h-3 w-px',
          faint ? 'bg-[var(--color-surface-2)]' : 'bg-[var(--color-border)]',
        )}
      />
    </div>
  )
}

function StepCard({
  item,
  selected,
  errCount,
  readOnly,
  canMoveUp,
  canMoveDown,
  canPaste,
  dragging,
  onSelect,
  onCopy,
  onPaste,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragEnd,
}: {
  item: LinearItem
  selected: boolean
  errCount: number
  readOnly: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  canPaste: boolean
  dragging: boolean
  onSelect: () => void
  onCopy: () => void
  onPaste: () => void
  onDuplicate: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const { node } = item
  const Icon = icons[node.type]
  const edges = useDesignerStore((s) => s.edges)
  const isFlowStart = !edges.some((e) => e.target === node.id)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const reorderable = isReorderableNode(node)
  const mediaCount = readMediaFiles(node.config).length

  useLayoutEffect(() => {
    if (!menuOpen || !menuBtnRef.current) {
      setMenuPos(null)
      return
    }
    const rect = menuBtnRef.current.getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 4, left: Math.min(rect.right - 180, window.innerWidth - 196) })
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    function onDoc(e: MouseEvent) {
      if (menuBtnRef.current?.contains(e.target as Node)) return
      setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  return (
    <div
      className={cn(
        'group relative flex w-full items-center gap-1 rounded-xl border shadow-sm transition-all duration-200',
        selected
          ? 'border-[var(--color-accent)]/45 bg-[var(--color-surface)] shadow-[0_10px_28px_-16px_rgb(15_118_110_/_0.55)] ring-2 ring-[var(--color-accent)]/15'
          : 'border-[var(--color-border)]/90 bg-[var(--color-surface)] hover:border-[var(--color-accent)]/40 hover:shadow-md',
        dragging ? 'opacity-60' : null,
      )}
    >
      {!readOnly && reorderable ? (
        <button
          type="button"
          draggable
          aria-label="Drag to reorder"
          title="Drag to reorder"
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', node.id)
            onDragStart()
          }}
          onDragEnd={onDragEnd}
          className="flex h-full cursor-grab items-center px-1.5 text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      ) : (
        <span className="w-2" />
      )}

      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-2 text-left"
      >
        <span
          className="rounded-lg p-2 text-white shadow-sm"
          style={{
            background: `linear-gradient(135deg, ${typeColor[node.type]}, color-mix(in oklab, ${typeColor[node.type]} 70%, #0ea5e9))`,
          }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-[var(--color-ink)]">{node.label || node.key}</span>
          <span className="block truncate text-[11px] text-[var(--color-ink-muted)]">
            {nodeTypeLabel(node.type)} · {node.key}
          </span>
        </span>
        {mediaCount ? (
          <span
            title={`${mediaCount} attached file${mediaCount === 1 ? '' : 's'}`}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800 ring-1 ring-violet-200/80"
          >
            <ImageIcon className="h-3 w-3" />
            Media
          </span>
        ) : null}
        {hasCustomStepSettingsForNode(node.config, isFlowStart) ? (
          <span
            title={stepSettingsSummary(node.config)}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-[var(--color-accent-2)]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-accent-2)] ring-1 ring-sky-200/80"
          >
            <Clock3 className="h-3 w-3" />
            After
          </span>
        ) : null}
        {errCount ? (
          <span className="rounded-md bg-[var(--color-danger-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--color-danger)]">
            {errCount}
          </span>
        ) : null}
      </button>

      {!readOnly && node.type !== 'end' ? (
        <div className="flex shrink-0 items-center gap-0.5 pr-2">
          {reorderable ? (
            <>
              <button
                type="button"
                aria-label="Move up"
                disabled={!canMoveUp}
                onClick={onMoveUp}
                className="rounded-md p-1 text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)] disabled:opacity-30"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Move down"
                disabled={!canMoveDown}
                onClick={onMoveDown}
                className="rounded-md p-1 text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)] disabled:opacity-30"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </>
          ) : null}
          <button
            ref={menuBtnRef}
            type="button"
            aria-label="Step actions"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-md p-1 text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {menuOpen && menuPos
            ? createPortal(
                <div
                  role="menu"
                  className="fixed z-[80] w-44 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg"
                  style={{ top: menuPos.top, left: menuPos.left }}
                >
                  <MenuItem
                    label="Copy"
                    hint="Ctrl+C"
                    icon={Copy}
                    onClick={() => {
                      onCopy()
                      setMenuOpen(false)
                    }}
                  />
                  <MenuItem
                    label="Paste after"
                    hint="Ctrl+V"
                    icon={ClipboardPaste}
                    disabled={!canPaste}
                    onClick={() => {
                      onPaste()
                      setMenuOpen(false)
                    }}
                  />
                  <MenuItem
                    label="Duplicate"
                    hint="Ctrl+D"
                    icon={Copy}
                    onClick={() => {
                      onDuplicate()
                      setMenuOpen(false)
                    }}
                  />
                  {reorderable ? (
                    <>
                      <div className="my-1 border-t border-[var(--color-border)]/60" />
                      <MenuItem
                        label="Move up"
                        disabled={!canMoveUp}
                        onClick={() => {
                          onMoveUp()
                          setMenuOpen(false)
                        }}
                      />
                      <MenuItem
                        label="Move down"
                        disabled={!canMoveDown}
                        onClick={() => {
                          onMoveDown()
                          setMenuOpen(false)
                        }}
                      />
                    </>
                  ) : null}
                </div>,
                document.body,
              )
            : null}
        </div>
      ) : null}
    </div>
  )
}

function MenuItem({
  label,
  hint,
  icon: Icon,
  disabled,
  onClick,
}: {
  label: string
  hint?: string
  icon?: typeof Copy
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[var(--color-ink)] transition hover:bg-[var(--color-surface-2)] disabled:opacity-40"
    >
      {Icon ? <Icon className="h-3.5 w-3.5 text-[var(--color-ink-muted)]" /> : <span className="w-3.5" />}
      <span className="flex-1">{label}</span>
      {hint ? <span className="text-[10px] text-[var(--color-ink-muted)]">{hint}</span> : null}
    </button>
  )
}

function ConditionBlock({
  node,
  readOnly,
  collapsed,
  onToggle,
  selectedNodeId,
  issueCounts,
  openMenu,
  setOpenMenu,
  onSelect,
  addBranchStep,
  addAfterCondition,
  renderSequence,
  onCopy,
  onPaste,
  onDuplicate,
  canPaste,
}: {
  node: Extract<ScopeNode, { kind: 'condition' }>
  readOnly?: boolean
  collapsed: boolean
  onToggle: () => void
  selectedNodeId: string | null
  issueCounts: Map<string, number>
  openMenu: string | null
  setOpenMenu: (id: string | null) => void
  onSelect: (id: string) => void
  addBranchStep: (conditionId: string, handle: 'true' | 'false' | 'body', type: FlowNodeType, seed?: AddNodeSeed) => void
  addAfterCondition: (conditionId: string, type: FlowNodeType, seed?: AddNodeSeed) => void
  renderSequence: (
    seq: ScopeNode[],
    opts: {
      emptyMenuId: string
      onAddEmpty: (type: FlowNodeType, seed?: AddNodeSeed) => void
      emptyHint: string
      afterNodeId?: string | null
    },
  ) => ReactNode
  onCopy: () => void
  onPaste: () => void
  onDuplicate: () => void
  canPaste: boolean
}) {
  const conditionId = node.item.node.id
  const selected = selectedNodeId === conditionId
  const yesCount = countSteps(node.yes)
  const noCount = countSteps(node.no)
  const edges = useDesignerStore((s) => s.edges)
  const isFlowStart = !edges.some((e) => e.target === conditionId)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <div
        className={cn(
          'overflow-hidden rounded-xl border bg-[#f7f8fa] shadow-sm transition-colors',
          selected ? 'border-[var(--color-warning)]/50 ring-2 ring-[var(--color-warning)]/20' : 'border-[var(--color-border)]/90',
        )}
      >
        <div className="flex items-stretch border-b border-[var(--color-border)]/90 bg-[var(--color-surface)]">
          <button
            type="button"
            aria-label={collapsed ? 'Expand condition' : 'Collapse condition'}
            onClick={onToggle}
            className="flex w-9 shrink-0 items-center justify-center border-r border-[var(--color-border)]/90 text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => onSelect(conditionId)}
            className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
          >
            <span
              className="rounded-lg p-2 text-white shadow-sm"
              style={{
                background: `linear-gradient(135deg, ${typeColor.condition}, color-mix(in oklab, ${typeColor.condition} 70%, #0ea5e9))`,
              }}
            >
              <GitBranch className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-[var(--color-ink)]">
                {node.item.node.label || node.item.node.key}
              </span>
              <span className="block truncate text-[11px] text-[var(--color-ink-muted)]">
                Condition · {node.item.node.key}
                {collapsed ? ` · Yes ${yesCount} · No ${noCount}` : ' · Yes / No'}
              </span>
            </span>
            {hasCustomStepSettingsForNode(node.item.node.config, isFlowStart) ? (
              <span
                title={stepSettingsSummary(node.item.node.config)}
                className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-[var(--color-accent-2)]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-accent-2)] ring-1 ring-sky-200/80"
              >
                <Clock3 className="h-3 w-3" />
                After
              </span>
            ) : null}
            {(issueCounts.get(conditionId) ?? 0) > 0 ? (
              <span className="rounded-md bg-[var(--color-danger-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--color-danger)]">
                {issueCounts.get(conditionId)}
              </span>
            ) : null}
          </button>
          {!readOnly ? (
            <ContainerActions
              open={menuOpen}
              setOpen={setMenuOpen}
              canPaste={canPaste}
              onCopy={onCopy}
              onPaste={onPaste}
              onDuplicate={onDuplicate}
            />
          ) : null}
        </div>

        {!collapsed ? (
          <div className="space-y-3 p-3">
            <BranchLane tone="yes" title="Yes" subtitle="If yes" empty={!node.yes.length}>
              {renderSequence(node.yes, {
                emptyMenuId: `yes-${conditionId}`,
                emptyHint: 'Add to Yes',
                afterNodeId: conditionId,
                onAddEmpty: (type, seed) => addBranchStep(conditionId, 'true', type, seed),
              })}
            </BranchLane>

            <BranchLane tone="no" title="No" subtitle="If no" empty={!node.no.length}>
              {renderSequence(node.no, {
                emptyMenuId: `no-${conditionId}`,
                emptyHint: 'Add to No',
                afterNodeId: conditionId,
                onAddEmpty: (type, seed) => addBranchStep(conditionId, 'false', type, seed),
              })}
            </BranchLane>
          </div>
        ) : null}
      </div>

      {!readOnly ? (
        <>
          <FlowConnector faint />
          <AddStepControl
            menuId={`after-${conditionId}`}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            afterNodeId={conditionId}
            onAdd={(type, seed) => {
              addAfterCondition(conditionId, type, seed)
              setOpenMenu(null)
            }}
            hint="Add step after condition"
          />
        </>
      ) : null}
      {node.then.length ? (
        <>
          <FlowConnector />
          {renderSequence(node.then, {
            emptyMenuId: `then-${conditionId}`,
            emptyHint: 'Add after condition',
            afterNodeId: conditionId,
            onAddEmpty: (type, seed) => addAfterCondition(conditionId, type, seed),
          })}
        </>
      ) : null}
    </>
  )
}

function ContainerActions({
  open,
  setOpen,
  canPaste,
  onCopy,
  onPaste,
  onDuplicate,
}: {
  open: boolean
  setOpen: (v: boolean) => void
  canPaste: boolean
  onCopy: () => void
  onPaste: () => void
  onDuplicate: () => void
}) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open || !btnRef.current) {
      setMenuPos(null)
      return
    }
    const rect = btnRef.current.getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 4, left: Math.min(rect.right - 180, window.innerWidth - 196) })
  }, [open])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (btnRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, setOpen])

  return (
    <div className="flex items-center border-l border-[var(--color-border)]/90 px-1.5">
      <button
        ref={btnRef}
        type="button"
        aria-label="Container actions"
        onClick={() => setOpen(!open)}
        className="rounded-md p-1.5 text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && menuPos
        ? createPortal(
            <div
              role="menu"
              className="fixed z-[80] w-44 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg"
              style={{ top: menuPos.top, left: menuPos.left }}
            >
              <MenuItem
                label="Copy"
                hint="Ctrl+C"
                icon={Copy}
                onClick={() => {
                  onCopy()
                  setOpen(false)
                }}
              />
              <MenuItem
                label="Paste after"
                hint="Ctrl+V"
                icon={ClipboardPaste}
                disabled={!canPaste}
                onClick={() => {
                  onPaste()
                  setOpen(false)
                }}
              />
              <MenuItem
                label="Duplicate"
                hint="Ctrl+D"
                icon={Copy}
                onClick={() => {
                  onDuplicate()
                  setOpen(false)
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

function LoopBlock({
  node,
  readOnly,
  collapsed,
  onToggle,
  selectedNodeId,
  issueCounts,
  openMenu,
  setOpenMenu,
  onSelect,
  addBranchStep,
  addAfterCondition,
  renderSequence,
  onCopy,
  onPaste,
  onDuplicate,
  canPaste,
}: {
  node: Extract<ScopeNode, { kind: 'loop' }>
  readOnly?: boolean
  collapsed: boolean
  onToggle: () => void
  selectedNodeId: string | null
  issueCounts: Map<string, number>
  openMenu: string | null
  setOpenMenu: (id: string | null) => void
  onSelect: (id: string) => void
  addBranchStep: (conditionId: string, handle: 'true' | 'false' | 'body', type: FlowNodeType, seed?: AddNodeSeed) => void
  addAfterCondition: (conditionId: string, type: FlowNodeType, seed?: AddNodeSeed) => void
  renderSequence: (
    seq: ScopeNode[],
    opts: {
      emptyMenuId: string
      onAddEmpty: (type: FlowNodeType, seed?: AddNodeSeed) => void
      emptyHint: string
      afterNodeId?: string | null
    },
  ) => ReactNode
  onCopy: () => void
  onPaste: () => void
  onDuplicate: () => void
  canPaste: boolean
}) {
  const loopId = node.item.node.id
  const selected = selectedNodeId === loopId
  const bodyCount = countSteps(node.body)
  const itemVar = String(node.item.node.config.itemVariable ?? 'item').trim() || 'item'
  const indexVar = String(node.item.node.config.indexVariable ?? 'index').trim() || 'index'
  const edges = useDesignerStore((s) => s.edges)
  const isFlowStart = !edges.some((e) => e.target === loopId)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <div
        className={cn(
          'overflow-hidden rounded-xl border bg-[#f7f8fa] shadow-sm transition-colors',
          selected ? 'border-[var(--color-accent)]/50 ring-2 ring-[var(--color-accent)]/20' : 'border-[var(--color-border)]/90',
        )}
      >
        <div className="flex items-stretch border-b border-[var(--color-border)]/90 bg-[var(--color-surface)]">
          <button
            type="button"
            aria-label={collapsed ? 'Expand loop' : 'Collapse loop'}
            onClick={onToggle}
            className="flex w-9 shrink-0 items-center justify-center border-r border-[var(--color-border)]/90 text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => onSelect(loopId)}
            className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
          >
            <span
              className="rounded-lg p-2 text-white shadow-sm"
              style={{
                background: `linear-gradient(135deg, ${typeColor.loop}, color-mix(in oklab, ${typeColor.loop} 70%, #0ea5e9))`,
              }}
            >
              <Repeat className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-[var(--color-ink)]">
                {node.item.node.label || node.item.node.key}
              </span>
              <span className="block truncate text-[11px] text-[var(--color-ink-muted)]">
                For each · {node.item.node.key}
                {collapsed
                  ? ` · Body ${bodyCount}`
                  : ` · {{vars.${itemVar}}} / {{vars.${indexVar}}}`}
              </span>
            </span>
            {hasCustomStepSettingsForNode(node.item.node.config, isFlowStart) ? (
              <span
                title={stepSettingsSummary(node.item.node.config)}
                className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-[var(--color-accent-2)]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-accent-2)] ring-1 ring-sky-200/80"
              >
                <Clock3 className="h-3 w-3" />
                After
              </span>
            ) : null}
            {(issueCounts.get(loopId) ?? 0) > 0 ? (
              <span className="rounded-md bg-[var(--color-danger-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--color-danger)]">
                {issueCounts.get(loopId)}
              </span>
            ) : null}
          </button>
          {!readOnly ? (
            <ContainerActions
              open={menuOpen}
              setOpen={setMenuOpen}
              canPaste={canPaste}
              onCopy={onCopy}
              onPaste={onPaste}
              onDuplicate={onDuplicate}
            />
          ) : null}
        </div>

        {!collapsed ? (
          <div className="space-y-3 p-3">
            <BranchLane
              tone="body"
              title="Each item"
              subtitle={`Runs once per record · {{vars.${itemVar}}}`}
              empty={!node.body.length}
            >
              {renderSequence(node.body, {
                emptyMenuId: `body-${loopId}`,
                emptyHint: 'Add loop action',
                afterNodeId: loopId,
                onAddEmpty: (type, seed) => addBranchStep(loopId, 'body', type, seed),
              })}
            </BranchLane>
          </div>
        ) : null}
      </div>

      {!readOnly ? (
        <>
          <FlowConnector faint />
          <AddStepControl
            menuId={`after-${loopId}`}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            afterNodeId={loopId}
            onAdd={(type, seed) => {
              addAfterCondition(loopId, type, seed)
              setOpenMenu(null)
            }}
            hint="Add step after loop"
          />
        </>
      ) : null}
      {node.then.length ? (
        <>
          <FlowConnector />
          {renderSequence(node.then, {
            emptyMenuId: `loop-then-${loopId}`,
            emptyHint: 'Add after loop',
            afterNodeId: loopId,
            onAddEmpty: (type, seed) => addAfterCondition(loopId, type, seed),
          })}
        </>
      ) : null}
    </>
  )
}

function BranchLane({
  tone,
  title,
  subtitle,
  empty,
  children,
}: {
  tone: 'yes' | 'no' | 'then' | 'body'
  title: string
  subtitle: string
  empty?: boolean
  children: ReactNode
}) {
  const styles =
    tone === 'yes'
      ? {
          rail: 'bg-[var(--color-success)]',
          panel: 'border-[var(--color-success)]/30/80 bg-[var(--color-success-soft)]/50',
          badge: 'bg-[var(--color-success)] text-[var(--color-accent-fg)]',
        }
      : tone === 'no'
        ? {
            rail: 'bg-[var(--color-danger)]',
            panel: 'border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/50',
            badge: 'bg-[var(--color-danger)] text-white',
          }
        : tone === 'body'
          ? {
              rail: 'bg-[var(--color-accent)]',
              panel: 'border-[var(--color-accent)]/25 bg-[var(--color-accent-soft)]/40',
              badge: 'bg-[var(--color-accent)]$1text-[var(--color-accent-fg)]',
            }
          : {
              rail: 'bg-[var(--color-ink-muted)]',
              panel: 'border-[var(--color-border)]/80 bg-[var(--color-surface)]',
              badge: 'bg-[var(--color-ink-muted)] text-white',
            }

  return (
    <div className={cn('flex overflow-hidden rounded-lg border', styles.panel)}>
      <div className={cn('w-1.5 shrink-0', styles.rail)} aria-hidden />
      <div className="min-w-0 flex-1 p-2.5">
        <div className="mb-2 flex items-center gap-2">
          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide', styles.badge)}>
            {title}
          </span>
          <span className="text-[11px] text-[var(--color-ink-muted)]">{subtitle}</span>
          {empty ? <span className="text-[10px] text-[var(--color-ink-muted)]">· empty</span> : null}
        </div>
        {children}
      </div>
    </div>
  )
}

function AddStepControl({
  menuId,
  openMenu,
  setOpenMenu,
  onAdd,
  hint,
  afterNodeId,
}: {
  menuId: string
  openMenu: string | null
  setOpenMenu: (id: string | null) => void
  onAdd: (type: FlowNodeType, seed?: AddNodeSeed) => void
  hint?: string
  afterNodeId?: string | null
}) {
  const open = openMenu === menuId
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const nodes = useDesignerStore((s) => s.nodes)
  const edges = useDesignerStore((s) => s.edges)
  const suggestions = useMemo(
    () => suggestNextSteps({ nodes, edges, afterNodeId: afterNodeId ?? null, limit: 3 }),
    [nodes, edges, afterNodeId],
  )
  const suggestedTypes = useMemo(() => new Set(suggestions.map((s) => s.type)), [suggestions])

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      setMenuPos(null)
      return
    }
    function place() {
      const btn = rootRef.current?.querySelector('button')
      if (!btn) return
      const rect = btn.getBoundingClientRect()
      const menuWidth = 288
      const menuHeight = menuRef.current?.offsetHeight ?? 400
      const pad = 8
      let left = rect.left + rect.width / 2 - menuWidth / 2
      left = Math.max(pad, Math.min(left, window.innerWidth - menuWidth - pad))
      let top = rect.bottom + 6
      if (top + menuHeight > window.innerHeight - pad && rect.top - menuHeight - 6 > pad) {
        top = rect.top - menuHeight - 6
      }
      setMenuPos({ top, left })
    }
    place()
    const raf = requestAnimationFrame(place)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, suggestions.length])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpenMenu(null)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenMenu(null)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, setOpenMenu])

  const menu =
    open && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[100] w-72 max-h-[min(28rem,70vh)] overflow-y-auto overflow-x-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-[0_16px_40px_-18px_rgb(15_23_42_/_0.45)]"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            {suggestions.length ? (
              <>
                <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
                  <Sparkles className="h-3 w-3" />
                  Suggested
                </div>
                {suggestions.map((s) => {
                  const Icon = icons[s.type]
                  return (
                    <button
                      key={`${s.type}:${s.label}`}
                      type="button"
                      role="menuitem"
                      title={s.reason}
                      className="flex w-full items-start gap-2.5 px-3 py-2 text-left text-sm text-[var(--color-ink)] transition hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent)]"
                      onClick={() => onAdd(s.type, s.seed)}
                    >
                      <span className="mt-0.5 rounded-md p-1.5 text-white" style={{ background: typeColor[s.type] }}>
                        <Icon className="h-3 w-3" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium">{s.label}</span>
                        <span className="block text-[11px] leading-snug text-[var(--color-ink-muted)]">{s.reason}</span>
                      </span>
                    </button>
                  )
                })}
                <div className="my-1 border-t border-[var(--color-border)]/60" />
              </>
            ) : null}
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
              Add an action
            </div>
            {STEP_TYPES.map((type) => {
              const Icon = icons[type]
              const highlighted = suggestedTypes.has(type)
              return (
                <button
                  key={type}
                  type="button"
                  role="menuitem"
                  className={cn(
                    'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition',
                    highlighted
                      ? 'bg-[var(--color-accent-soft)]/80 font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]'
                      : 'text-[var(--color-ink)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent)]',
                  )}
                  onClick={() => onAdd(type)}
                >
                  <span className="rounded-md p-1.5 text-white" style={{ background: typeColor[type] }}>
                    <Icon className="h-3 w-3" />
                  </span>
                  <span className="font-medium">{nodeTypeLabel(type)}</span>
                </button>
              )
            })}
          </div>,
          document.body,
        )
      : null

  return (
    <div ref={rootRef} className="relative flex flex-col items-center py-0.5">
      <button
        type="button"
        aria-label={hint ?? 'Add step'}
        title={hint ?? 'Add step'}
        aria-expanded={open}
        onClick={() => setOpenMenu(open ? null : menuId)}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-full border bg-[var(--color-surface)] text-[var(--color-ink-muted)] shadow-sm transition',
          open
            ? 'border-[var(--color-accent)] text-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/20'
            : 'border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] hover:shadow',
        )}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
      {menu}
    </div>
  )
}
