import { fetchFlowModules } from '@/features/operations/subflowApi'
import { expandSubflows } from '@/features/operations/subflows'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, ShieldCheck } from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { TestScenariosPanel } from '@/features/chatbots/TestScenariosPanel'
import { fetchChatbotTemplates } from '@/features/templates/templateApi'
import { templatesExprMap } from '@/features/templates/templateModel'
import type { DesignerNode, DesignerEdge } from '../model/flowSchema'
import type { ValidationIssue } from '../validation/referenceValidator'
import { chatbotTestScenariosQueryKey, fetchChatbotTestScenarios } from './testScenarioApi'
import { runAutomatedScenario, type AutomatedResult } from './automatedScenarios'

type Props = { chatbotId: string; nodes: DesignerNode[]; edges: DesignerEdge[]; issues: ValidationIssue[]; selectNode: (id: string) => void }
export function ReleaseChecksPanel({ chatbotId, nodes, edges, issues, selectNode }: Props) {
  const { instance } = useRequiredInstance()
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [report, setReport] = useState<{ fingerprint: string; results: AutomatedResult[]; issues: ValidationIssue[]; at: string; totalSteps:number } | null>(null)
  const runId = useRef(0)
  useEffect(() => () => { runId.current++ }, [])
  const scenarios = useQuery({ queryKey: chatbotTestScenariosQueryKey(chatbotId), queryFn: () => fetchChatbotTestScenarios(chatbotId) })
  const resources = useQuery({ queryKey: ['release-check-resources', chatbotId], queryFn: async () => {
    const [{ data, error }, templates] = await Promise.all([
      supabase.from('chatbot_variables').select('key, default_value').eq('chatbot_id', chatbotId).eq('scope', 'global'),
      fetchChatbotTemplates(chatbotId),
    ])
    if (error) throw error
    return { globals: Object.fromEntries((data ?? []).map(r => [r.key, r.default_value])), templates: templatesExprMap(templates) }
  } })
  const hasSubflows=nodes.some(n=>n.type==='operation'&&n.config.operation==='subflow')
  const modules=useQuery({queryKey:['flow-modules',instance.id],queryFn:()=>fetchFlowModules(instance.id),enabled:hasSubflows})
  const fingerprint = JSON.stringify([chatbotId, nodes, edges, issues, scenarios.data, resources.data, hasSubflows?modules.data:[]])
  const stale = !!report && report.fingerprint !== fingerprint
  async function run() {
    const id = ++runId.current
    setRunning(true); setError(''); setReport(null); setProgress('Loading latest scenarios and defaults…')
    try {
      const [scenarioRefresh, resourceRefresh] = await Promise.all([scenarios.refetch(), resources.refetch()])
      if (scenarioRefresh.error) throw scenarioRefresh.error
      if (resourceRefresh.error) throw resourceRefresh.error
      if (!scenarioRefresh.data || !resourceRefresh.data) throw new Error('Test resources are unavailable.')
      const moduleRefresh=hasSubflows?await modules.refetch():null
      if(moduleRefresh?.error)throw moduleRefresh.error
      const usedModules=moduleRefresh?.data??[]
      const expanded = expandSubflows(nodes, edges, usedModules)
      const results: AutomatedResult[] = []
      for (const [index, scenario] of scenarioRefresh.data.entries()) {
        if (runId.current !== id) return
        setProgress(`Testing ${index + 1} of ${scenarioRefresh.data.length}: ${scenario.name}`)
        await new Promise(resolve => setTimeout(resolve, 0))
        if (runId.current !== id) return
        results.push(runAutomatedScenario({ scenario, nodes: expanded.nodes, edges: expanded.edges, ...resourceRefresh.data }))
      }
      if (runId.current !== id) return
      setReport({ fingerprint: JSON.stringify([chatbotId, nodes, edges, issues, scenarioRefresh.data, resourceRefresh.data, usedModules]), totalSteps:expanded.nodes.length, results, issues: [...issues], at: new Date().toLocaleString() })
    } catch (e) { if (runId.current === id) setError(e instanceof Error ? e.message : 'Could not load checks.') }
    finally { if (runId.current === id) { setRunning(false); setProgress('') } }
  }
  const failed = report?.results.filter(r => r.status === 'failed').length ?? 0
  const blocked = report?.results.filter(r => r.status === 'blocked').length ?? 0
  const errors = report?.issues.filter(i => i.severity === 'error').length ?? 0
  const visited = new Set(report?.results.flatMap(r => r.visited) ?? [])
  return <Card className="space-y-3 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-semibold">Check before publishing</h2><p className="text-sm text-[var(--color-ink-muted)]">Check this draft and run saved conversation tests. Live services and visual appearance still need manual preview.</p></div>
      <Button variant="secondary" disabled={running} onClick={() => void run()}>{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} {running ? 'Checking…' : 'Run checks'}</Button>
    </div>
    <p className="text-xs text-[var(--color-ink-muted)]">Checks are advisory and do not publish your chatbot. They never send payments, emails or external requests.</p>
    {running ? <p role="status" className="text-sm">{progress}</p> : null}
    {error ? <p role="alert" className="text-sm text-red-600">Checks could not complete: {error}</p> : null}
    {report ? <div className="space-y-2 text-sm" aria-live="polite">
      <p className="font-medium">{stale ? 'Draft or test data changed — run checks again.' : errors || failed ? 'Checks found problems.' : blocked || !report.results.length ? 'Automatic testing is incomplete.' : 'Configured automatic checks passed.'}</p>
      <p>{report.at} · {errors} validation errors · {report.issues.length - errors} warnings · {report.results.filter(r => r.status === 'passed').length} passed · {failed} failed · {blocked} need manual testing</p>
      <p>{visited.size} of {report.totalSteps} steps exercised. {report.results.length ? 'Untested paths still need review.' : 'Add a scenario below to test conversation behaviour.'}</p>
      <details><summary className="cursor-pointer">Validation details ({report.issues.length})</summary>
        {report.issues.length ? <ul className="space-y-1 py-2">{report.issues.map((issue, i) => <li key={i}><span>{issue.severity}: {issue.message}</span> {issue.nodeId ? <Button size="sm" variant="ghost" onClick={() => selectNode(issue.nodeId!)}>Show step</Button> : null}</li>)}</ul> : <p>No current designer validation issues.</p>}
      </details>
      {report.results.map((result, i) => <details key={i} open={result.status !== 'passed'} className="rounded-lg border border-[var(--color-border)] p-2"><summary className="cursor-pointer font-medium">{result.name} — {result.status === 'blocked' ? 'Incomplete' : result.status}</summary><ul className="space-y-1 py-2">{result.checks.map((check, j) => <li key={j}>{check.ok ? '✓' : '•'} {check.message}</li>)}</ul>{result.nodeId ? <Button size="sm" variant="ghost" onClick={() => selectNode(result.nodeId!)}>Show step</Button> : null}</details>)}
    </div> : null}
    <TestScenariosPanel chatbotId={chatbotId} nodes={nodes} globals={resources.data?.globals} flowLoading={resources.isPending} flowError={resources.error?.message} />
  </Card>
}
