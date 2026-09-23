import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { planOperations, type AvailableAgent, type WorkItem } from './operations'

export function OperationsIntelligencePanel({ items, agents, loading, error }: { items: WorkItem[]; agents: AvailableAgent[]; loading: boolean; error: boolean }) {
  const [service, setService] = useState(10), [arrivals, setArrivals] = useState(0), [capacity, setCapacity] = useState(5)
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer) }, [])
  const plan = useMemo(() => planOperations(items, agents, now, service, arrivals, capacity), [items, agents, now, service, arrivals, capacity])
  return <Card className="space-y-3">
    <details><summary className="cursor-pointer font-semibold">Operations intelligence · priority, routing and SLA estimates</summary>
      <div className="mt-3 space-y-3 text-sm">
        <p>Advisory only. Ranking combines configured priority, waiting age and SLA urgency. Agent suggestions balance loaded work across recently online agents; confirm queue eligibility before assigning. The inbox sample is capped at 200 conversations.</p>
        <div className="flex flex-wrap gap-3">
          <div><Label htmlFor="intel-service">Assumed handling time (minutes)</Label><Input id="intel-service" type="number" min={1} max={240} value={service} onChange={e => setService(Math.min(240, Math.max(1, Number(e.target.value) || 1)))} /></div>
          <div><Label htmlFor="intel-arrivals">Expected arrivals per hour</Label><Input id="intel-arrivals" type="number" min={0} max={10000} value={arrivals} onChange={e => setArrivals(Math.min(10000, Math.max(0, Number(e.target.value) || 0)))} /></div>
          <div><Label htmlFor="intel-capacity">Assignment limit per agent</Label><Input id="intel-capacity" type="number" min={1} max={100} value={capacity} onChange={e => setCapacity(Math.min(100, Math.max(1, Number(e.target.value) || 1)))} /></div>
        </div>
        {error ? <p>Recommendations unavailable: inbox or presence data failed to load.</p> : loading ? <p>Loading workload…</p> : <>
          <p>Scenario forecast in one hour: {plan.forecastQueue} outstanding. Estimated capacity: {plan.throughput.toFixed(1)}/hour. Drain time: {plan.drainMinutes == null ? 'not draining at these assumptions' : `${Math.ceil(plan.drainMinutes)} minutes`}.</p>
          <p>{plan.recommendations.some(r => r.slaRisk) ? 'Recommendation: review at-risk conversations first and add capacity or redirect work.' : 'No predicted SLA risks under these assumptions.'}</p>
          <div className="overflow-auto"><table className="w-full text-left"><thead><tr><th>Priority order</th><th>Suggested agent ID</th><th>Estimated wait</th><th>SLA</th></tr></thead><tbody>{plan.recommendations.slice(0, 10).map((r, i) => <tr key={r.id}><td className="py-2">{i + 1}. {r.id.slice(0, 8)}</td><td>{r.agent ?? 'No available capacity'}</td><td>{r.wait == null ? 'Unknown' : `${r.wait} min`}</td><td>{r.sla_due_at ? r.slaRisk ? 'At risk' : 'Within estimate' : 'Not configured'}</td></tr>)}</tbody></table></div>
        </>}
      </div>
    </details>
  </Card>
}
