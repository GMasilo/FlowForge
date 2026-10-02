import http from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { Worker } from 'node:worker_threads'
import {
  validateRequest,
  validateSentimentRequest,
  validateSimilarityRequest,
  validateImageClassifyRequest,
} from './intent.mjs'

const token = process.env.INTENT_API_TOKEN ?? ''
if (token.length < 32) throw new Error('Set INTENT_API_TOKEN to a random secret of at least 32 characters.')

const worker = new Worker(new URL('./worker.mjs', import.meta.url))
let ready = false
let capabilities = []
let pending = null

const send = (res, status, value) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(value))
}

worker.on('message', message => {
  if (message.ready) {
    ready = true
    capabilities = message.capabilities || []
    return
  }
  if (!pending) return
  clearTimeout(pending.timer)
  send(pending.res, message.error ? 502 : 200, message.error ? { error: message.error } : message.result)
  pending = null
})

const unavailable = () => {
  ready = false
  if (pending) {
    clearTimeout(pending.timer)
    send(pending.res, 503, { error: 'Model service unavailable. Restart the service.' })
    pending = null
  }
}
worker.on('error', unavailable)
worker.on('exit', unavailable)

function authorize(req) {
  const provided = Buffer.from(req.headers.authorization ?? '')
  const expected = Buffer.from(`Bearer ${token}`)
  return provided.length === expected.length && timingSafeEqual(provided, expected)
}

async function readJson(req) {
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > 6_500_000) {
      const err = new Error('Request too large')
      err.status = 413
      throw err
    }
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function queueWork(res, request) {
  if (!ready) return send(res, 503, { error: 'Model is loading or unavailable.' })
  if (pending) return send(res, 429, { error: 'Model is busy. Try again shortly.' })
  const timer = setTimeout(() => {
    unavailable()
    void worker.terminate()
  }, 30000)
  pending = { res, timer }
  worker.postMessage(request)
}

const routes = {
  'POST /classify': async (req, res) => {
    const body = await readJson(req)
    queueWork(res, validateRequest(body))
  },
  'POST /sentiment': async (req, res) => {
    const body = await readJson(req)
    queueWork(res, validateSentimentRequest(body))
  },
  'POST /similarity': async (req, res) => {
    const body = await readJson(req)
    queueWork(res, validateSimilarityRequest(body))
  },
  'POST /image/classify': async (req, res) => {
    const body = await readJson(req)
    queueWork(res, validateImageClassifyRequest(body))
  },
  'GET /health': (req, res) => {
    send(res, ready ? 200 : 503, { ready, busy: !!pending, capabilities })
  },
}

const server = http.createServer(async (req, res) => {
  if (!authorize(req)) return send(res, 401, { error: 'Unauthorized' })
  const key = `${req.method} ${req.url?.split('?')[0] || ''}`
  const handler = routes[key]
  if (!handler) return send(res, 404, { error: 'Not found' })
  try {
    await handler(req, res)
  } catch (error) {
    const status = error?.status === 413 ? 413 : 400
    send(res, status, { error: error instanceof Error ? error.message : 'Invalid request' })
  }
})

server.requestTimeout = 35000
server.headersTimeout = 15000
server.listen(Number(process.env.PORT || 8091), process.env.HOST || '127.0.0.1', () => {
  console.log('ML service listening; models loading in background.')
})
