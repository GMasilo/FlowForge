import { useMemo } from 'react'
import { useDesignerStore } from '@/features/designer/store/designerStore'
import { Card } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { analyzeGraph } from './graphIntelligence'

export function DesignIntelligencePanel({ editable }: { editable: boolean }) {
  const nodes = useDesignerStore(s => s.nodes), edges = useDesignerStore(s => s.edges)
  const report = useMemo(() => analyzeGraph(nodes, edges), [nodes, edges])
  const label = (id: string) => nodes.find(n => n.id === id)?.label || id
  return <Card>
    <details>
      <summary className="cursor-pointer font-semibold">Design intelligence · {report.dead.length} unreachable · {report.cycles.length} cycles</summary>
      <div className="mt-3 space-y-3 text-sm">
        <p>Branch complexity: {report.complexity}. Shortest structural exit: {report.shortestExit ?? 'none'} steps. Broken links: {report.danglingEdges}.</p>
        <p className="text-xs text-[var(--color-ink-muted)]">Structural estimates include Skip-to links. Conditions are treated as possible paths. Loops may be intentional; dynamic scripts and run-after jumps can change actual reachability.</p>
        {report.dead.length ? <p>Unreachable steps: {report.dead.map(id => <button key={id} className="mr-2 underline" onClick={() => useDesignerStore.getState().selectNode(id)}>{label(id)}</button>)}</p> : <p>All steps are structurally reachable from the entry.</p>}
        {report.trapped.length ? <p>No structural exit: {report.trapped.map(label).join(', ')}. Add an exit condition or an End step.</p> : null}
        {report.cycles.map((cycle, i) => <p key={i}>Cycle: {cycle.map(label).join(' → ')}. Check iteration limits and exit conditions.</p>)}
        {report.complexity > 10 ? <p>Recommendation: split heavily branching sections into smaller flows and test each branch.</p> : null}
        <p className="text-xs text-[var(--color-ink-muted)]">HTTP read protection: up to 3 attempts with jittered backoff; a 30-second circuit pause after 5 transient failures; a 10-request burst with 1 request/second refill per connection and chat session in this browser. Write requests are never automatically retried. Server quotas still apply.</p>
        <Button size="sm" disabled={!editable || !nodes.length} onClick={() => useDesignerStore.getState().setNodesAndEdges(nodes.map(n => ({ ...n, position: report.positions.get(n.id)! })), edges)}>Apply cycle-aware auto layout</Button>
      </div>
    </details>
  </Card>
}
