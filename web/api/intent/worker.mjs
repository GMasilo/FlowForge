import { parentPort } from 'node:worker_threads'
import * as tf from '@tensorflow/tfjs'
import * as use from '@tensorflow-models/universal-sentence-encoder'
import { rankIntent } from './intent.mjs'
await tf.setBackend('cpu')
await tf.ready()
const model = await use.load()
parentPort.postMessage({ ready: true })
parentPort.on('message', async request => {
  let embeddings
  try {
    embeddings = await model.embed([request.text, ...request.categories.flatMap(c => c.examples)])
    parentPort.postMessage({ result: rankIntent(request, await embeddings.array()) })
  } catch { parentPort.postMessage({ error: 'Model inference failed.' }) }
  finally { embeddings?.dispose() }
})
