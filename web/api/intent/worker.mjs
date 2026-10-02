import { parentPort } from 'node:worker_threads'
import * as tf from '@tensorflow/tfjs'
import * as use from '@tensorflow-models/universal-sentence-encoder'
import * as mobilenet from '@tensorflow-models/mobilenet'
import jpeg from 'jpeg-js'
import { PNG } from 'pngjs'
import { rankIntent, rankSentiment, SENTIMENT_PROTOTYPES, cosine } from './intent.mjs'

await tf.setBackend('cpu')
await tf.ready()

const useModel = await use.load()
let mobileNetModel = null
async function getMobileNet() {
  if (!mobileNetModel) mobileNetModel = await mobilenet.load({ version: 2, alpha: 0.5 })
  return mobileNetModel
}

// Pre-embed sentiment prototypes once
const sentimentPhrases = [
  ...SENTIMENT_PROTOTYPES.positive,
  ...SENTIMENT_PROTOTYPES.negative,
  ...SENTIMENT_PROTOTYPES.neutral,
]
const sentimentEmbed = await useModel.embed(sentimentPhrases)
const sentimentVectors = await sentimentEmbed.array()
sentimentEmbed.dispose()

parentPort.postMessage({ ready: true, capabilities: ['intent', 'sentiment', 'similarity', 'image_classify'] })

function decodeImageBuffer(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    const raw = jpeg.decode(buffer, { useTArray: true })
    return { width: raw.width, height: raw.height, data: raw.data, channels: 4 }
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50) {
    const png = PNG.sync.read(buffer)
    return { width: png.width, height: png.height, data: png.data, channels: 4 }
  }
  throw new Error('Only JPEG and PNG images are supported.')
}

async function fetchImage(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 10000)
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow' })
    if (!res.ok) throw new Error(`Failed to download image (${res.status}).`)
    const ctype = (res.headers.get('content-type') || '').toLowerCase()
    if (ctype && !ctype.includes('image/') && !ctype.includes('octet-stream')) {
      throw new Error('URL did not return an image.')
    }
    const ab = await res.arrayBuffer()
    if (ab.byteLength > 5_000_000) throw new Error('Image is larger than 5 MB.')
    return Buffer.from(ab)
  } finally {
    clearTimeout(timer)
  }
}

parentPort.on('message', async request => {
  let tensors = []
  try {
    if (request.type === 'intent') {
      const embeddings = await useModel.embed([request.text, ...request.categories.flatMap(c => c.examples)])
      tensors.push(embeddings)
      parentPort.postMessage({ result: rankIntent(request, await embeddings.array()) })
      return
    }
    if (request.type === 'sentiment') {
      const embeddings = await useModel.embed([request.text])
      tensors.push(embeddings)
      const arr = await embeddings.array()
      parentPort.postMessage({ result: rankSentiment(arr[0], sentimentVectors, request.threshold) })
      return
    }
    if (request.type === 'similarity') {
      const embeddings = await useModel.embed([request.text_a, request.text_b])
      tensors.push(embeddings)
      const arr = await embeddings.array()
      const score = cosine(arr[0], arr[1])
      parentPort.postMessage({
        result: {
          score,
          model: 'universal-sentence-encoder-lite',
          scoreType: 'cosine_similarity',
        },
      })
      return
    }
    if (request.type === 'image_classify') {
      let buffer
      if (request.imageBase64) buffer = Buffer.from(request.imageBase64, 'base64')
      else buffer = await fetchImage(request.imageUrl)
      const decoded = decodeImageBuffer(buffer)
      const rgb = tf.tidy(() => {
        const t = tf.tensor3d(decoded.data, [decoded.height, decoded.width, 4])
        return t.slice([0, 0, 0], [-1, -1, 3])
      })
      tensors.push(rgb)
      const model = await getMobileNet()
      const predictions = await model.classify(rgb, request.topK)
      parentPort.postMessage({
        result: {
          predictions: predictions.map(p => ({ label: p.className, score: p.probability })),
          top: predictions[0] ? { label: predictions[0].className, score: predictions[0].probability } : null,
          model: 'mobilenet-v2',
          scoreType: 'probability',
        },
      })
      return
    }
    parentPort.postMessage({ error: 'Unknown task type.' })
  } catch (error) {
    parentPort.postMessage({ error: error instanceof Error ? error.message : 'Model inference failed.' })
  } finally {
    for (const t of tensors) {
      try { t.dispose() } catch { /* ignore */ }
    }
  }
})
