import assert from 'node:assert/strict'
import { locksFromPresence, queuePosition, type PresenceEntry } from './stepLocks.ts'

function presence(
  rows: Array<[string, PresenceEntry]>,
): Record<string, PresenceEntry[]> {
  const out: Record<string, PresenceEntry[]> = {}
  for (const [id, entry] of rows) out[id] = [entry]
  return out
}

{
  const state = presence([
    ['user-a', { name: 'Alice', selected_node_key: 'welcome', selected_at: '2026-01-01T10:00:00.000Z' }],
    ['user-b', { name: 'Bob', selected_node_key: 'welcome', selected_at: '2026-01-01T10:00:05.000Z' }],
  ])

  const forAlice = locksFromPresence(state, 'user-a')
  assert.equal(forAlice.has('welcome'), false, 'Alice claimed first — not locked for her')

  const forBob = locksFromPresence(state, 'user-b')
  const bobLock = forBob.get('welcome')
  assert.ok(bobLock)
  assert.equal(bobLock!.userId, 'user-a')
  assert.equal(bobLock!.name, 'Alice')
  assert.equal(queuePosition(bobLock!, 'user-b'), 1)
  assert.deepEqual(
    bobLock!.queue.map((q) => q.userId),
    ['user-b'],
  )
}

{
  // Later click must not steal — even if Object key order puts Bob first
  const state = presence([
    ['user-b', { name: 'Bob', selected_node_key: 'step_1', selected_at: '2026-01-01T12:00:10.000Z' }],
    ['user-a', { name: 'Alice', selected_node_key: 'step_1', selected_at: '2026-01-01T12:00:01.000Z' }],
    ['user-c', { name: 'Carol', selected_node_key: 'step_1', selected_at: '2026-01-01T12:00:20.000Z' }],
  ])
  const forCarol = locksFromPresence(state, 'user-c')
  const lock = forCarol.get('step_1')
  assert.equal(lock?.userId, 'user-a')
  assert.deepEqual(
    lock?.queue.map((q) => q.name),
    ['Bob', 'Carol'],
  )
  assert.equal(queuePosition(lock!, 'user-c'), 2)
}

{
  // Untimed claim loses to timed first click
  const state = presence([
    ['user-b', { name: 'Bob', selected_node_key: 'x' }],
    ['user-a', { name: 'Alice', selected_node_key: 'x', selected_at: '2026-01-01T10:00:00.000Z' }],
  ])
  const forBob = locksFromPresence(state, 'user-b')
  assert.equal(forBob.get('x')?.userId, 'user-a')
}

console.log('stepLocks.check: ok')
