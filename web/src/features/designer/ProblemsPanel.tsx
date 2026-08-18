import { useEffect, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clock3,
  Download,
  History,
  XCircle,
} from 'lucide-react'
import { useDesignerStore } from '@/features/designer/store/designerStore'
import type { PreviewStepRun } from '@/features/designer/preview/previewRuntime'
import type { ScenarioResult } from '@/features/designer/preview/scenarioEval'
import { buildRunHistoryExport, safeDownloadBasename } from '@/features/designer/utils/flowTransfer'
import { downloadJson } from '@/shared/lib/downloadJson'
import { cn } from '@/shared/lib/utils'

type SidebarTab = 'problems' | 'run'

interface ProblemsPanelProps {
  previewOpen?: boolean
  runs?: PreviewStepRun[]
  chatbot?: { id: string; name: string } | null
  scenarioResult?: ScenarioResult | null
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`
  const mins = Math.floor(ms / 60_000)
  const secs = ((ms % 60_000) / 1000).toFixed(1)
  return `${mins}m ${secs}s`
}

function formatValue(value: unknown): string {
  if (value === undefined) return '—'
  if (value === null) return 'null'
  if (typeof value === 'string') return value || '""'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function RunSection({ title, data }: { title: string; data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined)
  if (!entries.length) {
    return (
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{title}</p>
        <p className="text-[11px] text-slate-400">No values</p>
      </div>
    )
  }
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <dl className="space-y-1.5">
        {entries.map(([key, value]) => (
          <div key={key} className="rounded-lg bg-slate-50 px-2 py-1.5">
            <dt className="text-[10px] font-medium text-slate-500">{key}</dt>
            <dd className="mt-0.5 whitespace-pre-wrap break-words font-mono text-[11px] leading-snug text-slate-800">
              {formatValue(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function RunCard({
  run,
  active,
  onSelect,
}: {
  run: PreviewStepRun
  active: boolean
  onSelect: () => void
}) {
  const [open, setOpen] = useState(false)
  const ok = run.status === 'Succeeded'
  const skipped = run.status === 'Skipped'
  const timedOut = run.status === 'TimedOut'
  const failed = run.status === 'Failed'

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-white shadow-sm',
        ok && 'border-slate-200/90',
        skipped && 'border-amber-200',
        timedOut && 'border-orange-200',
        failed && 'border-rose-200',
        active && 'ring-2 ring-teal-500/30',
      )}
    >
      <div className="flex w-full items-stretch">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-start gap-2 px-2.5 py-2 text-left transition hover:bg-slate-50/80"
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          )}
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              {ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              ) : skipped ? (
                <CircleDot className="h-3.5 w-3.5 shrink-0 text-amber-600" />
              ) : (
                <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
              )}
              <span className="truncate text-xs font-semibold text-slate-800">{run.nodeLabel}</span>
            </span>
            <span className="mt-0.5 block truncate text-[10px] text-slate-500">
              {run.typeLabel} · {run.nodeKey}
            </span>
            <span className="mt-1 flex items-center gap-1 text-[10px] font-medium text-slate-400">
              <Clock3 className="h-3 w-3" />
              {formatDuration(run.durationMs)}
              <span className="text-slate-300">·</span>
              <span
                className={cn(
                  ok && 'text-emerald-700',
                  skipped && 'text-amber-700',
                  timedOut && 'text-orange-700',
                  failed && 'text-rose-700',
                )}
              >
                {run.status}
              </span>
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={onSelect}
          className="shrink-0 border-l border-slate-100 px-2 text-[10px] font-semibold uppercase tracking-wide text-teal-700 hover:bg-teal-50/60"
          title="Select step"
        >
          Go
        </button>
      </div>

      {open ? (
        <div className="space-y-3 border-t border-slate-100 bg-slate-50/40 px-2.5 py-2.5">
          <RunSection title="Inputs" data={run.inputs} />
          <RunSection title="Processed" data={run.processed} />
          <RunSection title="Outputs" data={run.outputs} />
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Saved as</p>
            <p className="rounded-lg bg-teal-50/80 px-2 py-1.5 font-mono text-[11px] text-teal-900">
              {run.savedAs ?? '—'}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function ProblemsPanel({
  previewOpen = false,
  runs = [],
  chatbot = null,
  scenarioResult = null,
}: ProblemsPanelProps) {
  const issues = useDesignerStore((s) => s.issues)
  const nodes = useDesignerStore((s) => s.nodes)
  const flowId = useDesignerStore((s) => s.flowId)
  const selectedNodeId = useDesignerStore((s) => s.selectedNodeId)
  const selectNode = useDesignerStore((s) => s.selectNode)
  const [tab, setTab] = useState<SidebarTab>('problems')

  useEffect(() => {
    setTab(previewOpen ? 'run' : 'problems')
  }, [previewOpen])

  const activeTab: SidebarTab = previewOpen ? tab : 'problems'
  const errors = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => i.severity === 'warning')
  const failedRuns = runs.filter((r) => r.status === 'Failed').length
  const skippedRuns = runs.filter((r) => r.status === 'Skipped').length

  function downloadRunHistory() {
    if (!runs.length) return
    const bot = chatbot ?? { id: 'unknown', name: 'chatbot' }
    const payload = buildRunHistoryExport({
      chatbot: bot,
      flowId,
      runs,
    })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    downloadJson(`${safeDownloadBasename(bot.name)}-run-${stamp}.json`, payload)
  }

  return (
    <aside
      aria-label={activeTab === 'run' ? 'Preview run history' : 'Validation problems'}
      className="flex h-[calc(100vh-var(--ff-designer-aside-top,7.5rem)-1.5rem)] w-full flex-col overflow-hidden rounded-2xl border border-white/60 bg-white/80 shadow-[var(--shadow-soft)] backdrop-blur-xl lg:sticky lg:top-[var(--ff-designer-aside-top,5rem)]"
    >
      <div className="shrink-0 border-b border-slate-200/80 px-3.5 py-3">
        <div className="flex items-center gap-2">
          {activeTab === 'run' ? (
            <History className="h-4 w-4 text-teal-700" />
          ) : (
            <CircleDot className="h-4 w-4 text-teal-700" />
          )}
          <h2 className="min-w-0 flex-1 text-sm font-semibold text-slate-800">
            {activeTab === 'run' ? 'Run history' : 'Problems'}
          </h2>
          {activeTab === 'run' && runs.length ? (
            <button
              type="button"
              onClick={downloadRunHistory}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-teal-800 transition hover:bg-teal-50"
              title="Download run history as JSON"
            >
              <Download className="h-3.5 w-3.5" />
              JSON
            </button>
          ) : null}
        </div>

        {previewOpen ? (
          <div className="mt-2.5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100/80 p-1">
            <button
              type="button"
              onClick={() => setTab('problems')}
              className={cn(
                'rounded-lg px-2 py-1.5 text-[11px] font-semibold transition',
                activeTab === 'problems'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              Problems
              {errors.length ? (
                <span className="ml-1 text-rose-600">{errors.length}</span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setTab('run')}
              className={cn(
                'rounded-lg px-2 py-1.5 text-[11px] font-semibold transition',
                activeTab === 'run'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              Run
              {runs.length ? (
                <span className="ml-1 text-teal-700">{runs.length}</span>
              ) : null}
            </button>
          </div>
        ) : (
          <p className="mt-1 text-[11px] text-slate-500">
            {errors.length} error{errors.length === 1 ? '' : 's'}
            {' · '}
            {warnings.length} warning{warnings.length === 1 ? '' : 's'}
          </p>
        )}

        {activeTab === 'run' ? (
          <p className="mt-2 text-[11px] text-slate-500">
            {runs.length} step{runs.length === 1 ? '' : 's'}
            {failedRuns ? ` · ${failedRuns} failed` : ''}
            {skippedRuns ? ` · ${skippedRuns} skipped` : ''}
            {!failedRuns && !skippedRuns && runs.length ? ' · all succeeded' : ''}
          </p>
        ) : previewOpen ? (
          <p className="mt-2 text-[11px] text-slate-500">
            {errors.length} error{errors.length === 1 ? '' : 's'}
            {' · '}
            {warnings.length} warning{warnings.length === 1 ? '' : 's'}
          </p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
        {activeTab === 'run' && scenarioResult ? (
          <div
            className={cn(
              'rounded-xl px-3 py-2.5',
              scenarioResult.passed ? 'bg-emerald-50/90 text-emerald-900' : 'bg-rose-50/90 text-rose-900',
            )}
          >
            <p className="text-xs font-semibold">
              Scenario “{scenarioResult.name}” {scenarioResult.passed ? 'passed' : 'failed'}
            </p>
            <ul className="mt-1 space-y-0.5 text-[11px]">
              {scenarioResult.checks.map((c, i) => (
                <li key={`${c.message}-${i}`}>{c.ok ? '✓' : '×'} {c.message}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {activeTab === 'run' ? (
          !runs.length ? (
            <div className="flex flex-col items-start gap-2 rounded-xl bg-slate-50 px-3 py-3 text-slate-600">
              <History className="h-4 w-4 shrink-0 text-slate-400" />
              <div>
                <p className="text-xs font-semibold">Waiting for steps</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  As Preview runs, each step’s inputs, processing, outputs, and duration appear here.
                </p>
              </div>
            </div>
          ) : (
            runs.map((run) => (
              <RunCard
                key={run.id}
                run={run}
                active={run.nodeId === selectedNodeId}
                onSelect={() => selectNode(run.nodeId)}
              />
            ))
          )
        ) : !issues.length ? (
          <div className="flex flex-col items-start gap-2 rounded-xl bg-emerald-50/80 px-3 py-3 text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <div>
              <p className="text-xs font-semibold">All clear</p>
              <p className="mt-0.5 text-[11px] text-emerald-700/80">No validation problems in this flow.</p>
            </div>
          </div>
        ) : (
          issues.map((issue, idx) => {
            const node = issue.nodeId ? nodes.find((n) => n.id === issue.nodeId) : null
            const active = !!issue.nodeId && issue.nodeId === selectedNodeId
            const isError = issue.severity === 'error'
            return (
              <button
                key={`${issue.code}-${issue.nodeId}-${idx}`}
                type="button"
                disabled={!issue.nodeId}
                onClick={() => issue.nodeId && selectNode(issue.nodeId)}
                className={cn(
                  'flex w-full gap-2 rounded-xl px-2.5 py-2 text-left transition',
                  isError
                    ? 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]'
                    : 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
                  issue.nodeId && 'hover:brightness-[0.97]',
                  active && 'ring-2 ring-teal-500/30',
                  !issue.nodeId && 'cursor-default',
                )}
              >
                {isError ? (
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                )}
                <span className="min-w-0">
                  {node ? (
                    <span className="mb-0.5 block truncate text-[10px] font-semibold uppercase tracking-wide opacity-70">
                      {node.key}
                    </span>
                  ) : null}
                  <span className="block text-xs leading-snug">{issue.message}</span>
                </span>
              </button>
            )
          })
        )}
      </div>
    </aside>
  )
}
