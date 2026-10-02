import { parentPort } from 'node:worker_threads'
import * as tf from '@tensorflow/tfjs'
import * as use from '@tensorflow-models/universal-sentence-encoder'
import { rankIntent, rankSentiment, SENTIMENT_PROTOTYPES, cosine } from './intent.mjs'

await tf.setBackend('cpu')
await tf.ready()

const useModel = await use.load()

// Pre-embed sentiment prototypes once
const sentimentPhrases = [
  ...SENTIMENT_PROTOTYPES.positive,
  ...SENTIMENT_PROTOTYPES.negative,
  ...SENTIMENT_PROTOTYPES.neutral,
]
const sentimentEmbed = await useModel.embed(sentimentPhrases)
const sentimentVectors = await sentimentEmbed.array()
sentimentEmbed.dispose()

const capabilities = ['intent', 'sentiment', 'similarity']
let mobileNetModel = null
let jpegDecode = null
let PngClass = null
let imageReady = false

try {
  const mobilenet = await import('@tensorflow-models/mobilenet')
  const jpeg = await import('jpeg-js')
  const pngjs = await import('pngjs')
  jpegDecode = jpeg.default?.decode || jpeg.decode
  PngClass = pngjs.PNG || pngjs.default?.PNG
  mobileNetModel = await mobilenet.load({ version: 2, alpha: 0.5 })
  imageReady = true
  capabilities.push('image_classify')
} catch (e) {
  console.error('Image classification unavailable:', e instanceof Error ? e.message : e)
}

parentPort.postMessage({ ready: true, capabilities })

function decodeImageBuffer(buffer) {
  if (!jpegDecode || !PngClass) throw new Error('Image decoding packages are not installed.')
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    const raw = jpegDecode(buffer, { useTArray: true })
    return { width: raw.width, height: raw.height, data: raw.data, channels: 4 }
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50) {
    const png = PngClass.sync.read(buffer)
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
  const tensors = []
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
      parentPort.postMessage({
        result: { score: cosine(arr[0], arr[1]), scoreType: 'cosine' },
      })
      return
    }
    if (request.type === 'image_classify') {
      if (!imageReady || !mobileNetModel) {
        parentPort.postMessage({ error: 'Image classification is not available on this server.' })
        return
      }
      let buffer
      if (request.imageBase64) buffer = Buffer.from(request.imageBase64, 'base64')
      else buffer = await fetchImage(request.imageUrl)
      const decoded = decodeImageBuffer(buffer)
      const rgb = tf.tidy(() => {
        const t = tf.tensor3d(decoded.data, [decoded.height, decoded.width, 4])
        return t.slice([0, 0, 0], [-1, -1, 3])
      })
      tensors.push(rgb)
      const predictions = await mobileNetModel.classify(rgb, request.topK)
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
