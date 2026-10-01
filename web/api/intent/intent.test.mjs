import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateRequest, rankIntent } from './intent.mjs'
const request = () => validateRequest({ text: 'Can I pay later?', categories: [{ name: 'billing', examples: ['Pay my fees'] }, { name: 'admissions', examples: ['Apply to study'] }] })
test('routes strong matches', () => { assert.equal(rankIntent(request(), [[1,0],[1,0],[0,1]]).intent, 'billing') })
test('falls back for weak matches and ties', () => {
  assert.equal(rankIntent(request(), [[1,0],[0,1],[0,-1]]).reason, 'low_similarity')
  assert.equal(rankIntent(request(), [[1,0],[1,0],[1,0]]).reason, 'ambiguous')
})
test('rejects duplicate labels, invalid thresholds and malformed embeddings', () => {
  const r = request(); r.categories[1].name = 'billing'
  assert.throws(() => validateRequest(r))
  assert.throws(() => validateRequest({ ...request(), threshold: NaN }))
  assert.throws(() => rankIntent(request(), [[1,0],[NaN,0],[0,1]]))
})
