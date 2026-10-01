export function validateRequest(input) {
  if (!input || typeof input.text !== 'string' || !input.text.trim() || input.text.length > 2000) throw new Error('Message must contain 1–2000 characters.')
  if (!Array.isArray(input.categories) || input.categories.length < 2 || input.categories.length > 10) throw new Error('Provide 2–10 categories.')
  const names = new Set()
  let count = 0
  const categories = input.categories.map(category => {
    if (!category || typeof category.name !== 'string' || !/^[a-z][a-z0-9_]{0,49}$/.test(category.name) || category.name === 'unknown' || names.has(category.name)) throw new Error('Category names must be unique lowercase keys; unknown is reserved.')
    names.add(category.name)
    if (!Array.isArray(category.examples) || !category.examples.length || category.examples.length > 10 || category.examples.some(text => typeof text !== 'string' || !text.trim() || text.length > 500)) throw new Error('Each category needs 1–10 example phrases of at most 500 characters.')
    count += category.examples.length
    return { name: category.name, examples: category.examples.map(text => text.trim()) }
  })
  if (count > 50) throw new Error('Use at most 50 example phrases in total.')
  const threshold = input.threshold ?? 0.65, margin = input.margin ?? 0.08
  if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < 0 || threshold > 1 || typeof margin !== 'number' || !Number.isFinite(margin) || margin < 0 || margin > 1) throw new Error('Threshold and margin must be numbers between 0 and 1.')
  return { text: input.text.trim(), categories, threshold, margin }
}
export function rankIntent(request, vectors) {
  const cosine = (a, b) => {
    if (!a?.length || a.length !== b?.length || [...a, ...b].some(n => !Number.isFinite(n))) throw new Error('Invalid model embedding.')
    let dot = 0, aa = 0, bb = 0
    a.forEach((v, i) => { dot += v * b[i]; aa += v * v; bb += b[i] * b[i] })
    return aa && bb ? Math.max(-1, Math.min(1, dot / Math.sqrt(aa * bb))) : 0
  }
  if (vectors.length !== 1 + request.categories.reduce((n, c) => n + c.examples.length, 0)) throw new Error('Model returned an unexpected number of embeddings.')
  let index = 1
  const scores = request.categories.map(category => ({ intent: category.name, score: Math.max(...category.examples.map(() => cosine(vectors[0], vectors[index++]))) })).sort((a, b) => b.score - a.score)
  const gap = scores[0].score - scores[1].score
  const matched = scores[0].score >= request.threshold && gap > 0 && gap >= request.margin
  return { intent: matched ? scores[0].intent : 'unknown', matched, score: scores[0].score, margin: gap, reason: matched ? 'matched' : scores[0].score < request.threshold ? 'low_similarity' : 'ambiguous', scores, model: 'universal-sentence-encoder-lite', scoreType: 'cosine_similarity' }
}
