import { describe, expect, it } from 'vitest'
import type { DesignerNode, DesignerEdge } from '@/features/designer/model/flowSchema'
import { analyzeGraph } from './graphIntelligence'
import { analyzeObservations, type Observation } from './observations'
import { planOperations, type WorkItem } from './operations'
import { RuntimeResilience } from './runtimeResilience'

const node = (id: string, type: DesignerNode['type'] = 'message', config = {}): DesignerNode => ({ id, key: id, label: id, type, config, position: { x: 0, y: 0 } })
const edge = (source: string, target: string): DesignerEdge => ({ id: `${source}-${target}`, source, target })
describe('design intelligence', () => {
  it('finds disconnected steps, broken links, shortest exits and branch complexity', () => {
    const result = analyzeGraph([node('a'), node('b'), node('c', 'end'), node('orphan')], [edge('a', 'b'), edge('a', 'c'), edge('b', 'c'), edge('gone', 'c')])
    expect(result.dead).toEqual(['orphan']); expect(result.danglingEdges).toBe(1)
    expect(result.shortestExit).toBe(2); expect(result.complexity).toBe(2)
  })
  it('detects strongly connected cycles and distinguishes a cycle with an exit', () => {
    const nodes = [node('a'), node('b'), node('c', 'end')]
    const links = [edge('a', 'b'), edge('b', 'a')]
    expect(analyzeGraph(nodes, links).cycles).toHaveLength(1)
    // The runtime chooses the first node without incoming links as entry.
    const cycle = analyzeGraph(nodes.slice(0, 2), links)
    expect(cycle.trapped.sort()).toEqual(['a', 'b']); expect(cycle.shortestExit).toBeNull()
    expect(analyzeGraph(nodes, [...links, edge('b', 'c')]).trapped).toEqual([])
  })
  it('includes skip-to jumps and lays out cycles without overlapping positions', () => {
    const result = analyzeGraph([node('a', 'skip_to', { targetNodeKey: 'c' }), node('b'), node('c', 'end')], [edge('a', 'b')])
    expect(result.dead).toEqual(['b']); expect(result.shortestExit).toBe(2)
    expect(new Set([...result.positions.values()].map(p => `${p.x},${p.y}`)).size).toBe(3)
  })
  it('handles an empty graph and a self-loop', () => {
    expect(analyzeGraph([], []).complexity).toBe(0)
    expect(analyzeGraph([node('a')], [edge('a', 'a')]).cycles).toEqual([['a']])
  })
})

const observation = (overrides: Partial<Observation> = {}): Observation => ({ session: 's', bot: 'b', version: '1', environment: 'production', node: 'http', seq: 1, duration: 100, failed: false, ...overrides })
describe('runtime and analytics signals', () => {
  it('requires enough samples for anomalies', () => {
    expect(analyzeObservations([observation({ duration: 10000 })]).steps[0]!.anomalies).toBeNull()
    const result = analyzeObservations([...Array.from({ length: 10 }, () => observation()), observation({ duration: 3000 })])
    expect(result.steps[0]!.anomalies).toBe(1)
  })
  it('detects version latency regression without mixing bots or environments', () => {
    const data = [1, 2].flatMap(version => Array.from({ length: 20 }, () => observation({ version: String(version), duration: version === 1 ? 100 : 500 })))
    data.push(observation({ bot: 'other', duration: 30000 }))
    const report = analyzeObservations(data)
    expect(report.steps.find(s => s.bot === 'b')!.regression).toBe(true)
    expect(report.steps.find(s => s.bot === 'other')!.regression).toBe(false)
  })
  it('orders journeys by sequence and does not bridge missing events', () => {
    const report = analyzeObservations([observation({ node: 'b', seq: 2 }), observation({ node: 'a', seq: 1 }), observation({ node: 'd', seq: 4 })])
    expect(report.transitions).toEqual([{ bot: 'b', from: 'a', to: 'b', count: 1 }])
  })
  it('ranks bottlenecks by cumulative measured time and excludes missing timings', () => {
    const report = analyzeObservations([observation(), observation({ node: 'slow', duration: 300 }), observation({ node: 'unknown', duration: null })])
    expect(report.steps[0]!.node).toBe('slow')
    expect(report.steps.find(s => s.node === 'unknown')!.median).toBeNull()
  })
})

describe('HTTP runtime protection', () => {
  it('retries transient reads with backoff and preserves successful result', async () => {
    const waits: number[] = []; let calls = 0
    const guard = new RuntimeResilience(() => 1000, async ms => { waits.push(ms) }, () => .5)
    expect((await guard.run('a', 'GET', async () => ({ status: ++calls < 3 ? 503 : 200 }))).status).toBe(200)
    expect(waits).toEqual([250, 500])
  })
  it('never retries writes, authentication failures, or long Retry-After delays', async () => {
    const guard = new RuntimeResilience(() => 0, async () => { throw new Error('Must not wait') })
    let calls = 0
    await guard.run('a', 'POST', async () => { calls++; return { status: 503 } })
    await guard.run('a', 'GET', async () => { calls++; return { status: 401 } })
    await guard.run('a', 'GET', async () => { calls++; return { status: 429, headers: { 'Retry-After': '60' } } })
    expect(calls).toBe(3)
  })
  it('opens the circuit and permits a recovery probe after cooldown', async () => {
    let now = 0
    const guard = new RuntimeResilience(() => now, async () => {})
    await guard.run('a', 'GET', async () => ({ status: 503 }))
    await guard.run('a', 'GET', async () => ({ status: 503 }))
    await expect(guard.run('a', 'GET', async () => ({ status: 200 }))).rejects.toThrow('temporarily paused')
    now = 31000
    expect((await guard.run('a', 'GET', async () => ({ status: 200 }))).status).toBe(200)
  })
  it('limits bursts per connection and honors cancellation', async () => {
    const guard = new RuntimeResilience(() => 0)
    for (let i = 0; i < 10; i++) await guard.run('a', 'GET', async () => ({ status: 200 }))
    await expect(guard.run('a', 'GET', async () => ({ status: 200 }))).rejects.toThrow('limit')
    expect((await guard.run('b', 'GET', async () => ({ status: 200 }))).status).toBe(200)
    const abort = new AbortController(); abort.abort()
    await expect(guard.run('b', 'GET', async () => ({ status: 200 }), abort.signal)).rejects.toThrow('Cancelled')
  })
})

describe('operations planning', () => {
  const now = Date.parse('2026-09-23T12:00:00Z')
  const item = (id: string, extra: Partial<WorkItem> = {}): WorkItem => ({ id, priority: 0, created_at: new Date(now - 60000).toISOString(), sla_due_at: null, assigned_to: null, queue_id: null, ...extra })
  const agents = ['a', 'b'].map(user_id => ({ user_id, status: 'online', last_seen_at: new Date(now).toISOString() }))
  it('prioritizes urgent SLA work and balances available agent load', () => {
    const plan = planOperations([item('normal'), item('urgent', { sla_due_at: new Date(now - 1).toISOString() })], agents, now, 10, 2, 3)
    expect(plan.recommendations[0]!.id).toBe('urgent')
    expect(plan.recommendations[0]!.slaRisk).toBe(true)
    expect(new Set(plan.recommendations.map(r => r.agent)).size).toBe(2)
  })
  it('excludes stale agents and avoids predictions of service without capacity', () => {
    const plan = planOperations([item('a', { sla_due_at: new Date(now + 60000).toISOString() })], agents.map(a => ({ ...a, last_seen_at: new Date(now - 100000).toISOString() })), now, 10, 3, 1)
    expect(plan.online).toBe(0); expect(plan.recommendations[0]!.agent).toBeNull()
    expect(plan.recommendations[0]!.wait).toBeNull(); expect(plan.forecastQueue).toBe(4)
    expect(plan.drainMinutes).toBeNull()
  })
  it('respects assignment capacity and does not mutate work', () => {
    const items = [item('assigned', { assigned_to: 'a' }), item('waiting')]
    const plan = planOperations(items, [agents[0]!], now, 10, 0, 1)
    expect(plan.recommendations[0]!.agent).toBeNull()
    expect(items[1]!.assigned_to).toBeNull()
  })
})
