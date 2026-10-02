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
  return { type: 'intent', text: input.text.trim(), categories, threshold, margin }
}

export function validateSentimentRequest(input) {
  if (!input || typeof input.text !== 'string' || !input.text.trim() || input.text.length > 2000) throw new Error('Text must contain 1–2000 characters.')
  const threshold = input.threshold ?? 0.35
  if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new Error('Threshold must be a number between 0 and 1.')
  return { type: 'sentiment', text: input.text.trim(), threshold }
}

export function validateSimilarityRequest(input) {
  if (!input || typeof input.text_a !== 'string' || !input.text_a.trim() || input.text_a.length > 2000) throw new Error('text_a must contain 1–2000 characters.')
  if (typeof input.text_b !== 'string' || !input.text_b.trim() || input.text_b.length > 2000) throw new Error('text_b must contain 1–2000 characters.')
  return { type: 'similarity', text_a: input.text_a.trim(), text_b: input.text_b.trim() }
}

export function validateImageClassifyRequest(input) {
  const topK = input.top_k == null ? 5 : Number(input.top_k)
  if (!Number.isFinite(topK) || topK < 1 || topK > 10) throw new Error('top_k must be between 1 and 10.')
  let imageBase64 = typeof input.image_base64 === 'string' ? input.image_base64.trim() : ''
  let imageUrl = typeof input.image_url === 'string' ? input.image_url.trim() : ''
  if (imageBase64.startsWith('data:')) {
    const idx = imageBase64.indexOf('base64,')
    if (idx >= 0) imageBase64 = imageBase64.slice(idx + 7)
  }
  if (!imageBase64 && !imageUrl) throw new Error('Provide image_url or image_base64.')
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) throw new Error('image_url must be an http(s) URL.')
  if (imageBase64 && imageBase64.length > 6_000_000) throw new Error('image_base64 is too large.')
  return { type: 'image_classify', imageBase64, imageUrl, topK: Math.floor(topK) }
}

export function cosine(a, b) {
  if (!a?.length || a.length !== b?.length || [...a, ...b].some(n => !Number.isFinite(n))) throw new Error('Invalid model embedding.')
  let dot = 0, aa = 0, bb = 0
  a.forEach((v, i) => { dot += v * b[i]; aa += v * v; bb += b[i] * b[i] })
  return aa && bb ? Math.max(-1, Math.min(1, dot / Math.sqrt(aa * bb))) : 0
}

export function rankIntent(request, vectors) {
  if (vectors.length !== 1 + request.categories.reduce((n, c) => n + c.examples.length, 0)) throw new Error('Model returned an unexpected number of embeddings.')
  let index = 1
  const scores = request.categories.map(category => ({ intent: category.name, score: Math.max(...category.examples.map(() => cosine(vectors[0], vectors[index++]))) })).sort((a, b) => b.score - a.score)
  const gap = scores[0].score - scores[1].score
  const matched = scores[0].score >= request.threshold && gap > 0 && gap >= request.margin
  return { intent: matched ? scores[0].intent : 'unknown', matched, score: scores[0].score, margin: gap, reason: matched ? 'matched' : scores[0].score < request.threshold ? 'low_similarity' : 'ambiguous', scores, model: 'universal-sentence-encoder-lite', scoreType: 'cosine_similarity' }
}

/** Built-in zero-shot sentiment prototypes (English). */
export const SENTIMENT_PROTOTYPES = {
  positive: [
    'I am very happy with this',
    'This is excellent and wonderful',
    'Thank you, great experience',
    'I love it, works perfectly',
  ],
  negative: [
    'I am very unhappy and frustrated',
    'This is terrible and awful',
    'I hate this, worst experience',
    'Broken, useless, very disappointed',
  ],
  neutral: [
    'I need information about this',
    'What are the opening hours',
    'Please tell me more details',
    'How does this process work',
  ],
}

export function rankSentiment(textVector, prototypeVectors, threshold) {
  const labels = ['positive', 'negative', 'neutral']
  const perLabel = { positive: 4, negative: 4, neutral: 4 }
  let index = 0
  const scores = labels.map(label => {
    const n = perLabel[label]
    let best = -1
    for (let i = 0; i < n; i++) best = Math.max(best, cosine(textVector, prototypeVectors[index++]))
    return { label, score: best }
  }).sort((a, b) => b.score - a.score)
  const top = scores[0]
  const sentiment = top.score >= threshold ? top.label : 'neutral'
  return {
    sentiment,
    score: top.score,
    scores,
    model: 'universal-sentence-encoder-lite',
    scoreType: 'cosine_similarity',
  }
}
