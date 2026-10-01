import http from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { Worker } from 'node:worker_threads'
import { validateRequest } from './intent.mjs'
const token = process.env.INTENT_API_TOKEN ?? ''
if (token.length < 32) throw new Error('Set INTENT_API_TOKEN to a random secret of at least 32 characters.')
const worker = new Worker(new URL('./worker.mjs', import.meta.url))
let ready = false, pending = null
const send = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)) }
worker.on('message', message => {
  if (message.ready) { ready = true; return }
  if (!pending) return
  clearTimeout(pending.timer)
  send(pending.res, message.error ? 502 : 200, message.error ? { error: message.error } : message.result)
  pending = null
})
const unavailable = () => { ready = false; if (pending) { clearTimeout(pending.timer); send(pending.res, 503, { error: 'Model service unavailable. Restart the service.' }); pending = null } }
worker.on('error', unavailable)
worker.on('exit', unavailable)
const server = http.createServer(async (req, res) => {
  const provided = Buffer.from(req.headers.authorization ?? ''), expected = Buffer.from(`Bearer ${token}`)
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return send(res, 401, { error: 'Unauthorized' })
  if (req.method === 'GET' && req.url === '/health') return send(res, ready ? 200 : 503, { ready, busy: !!pending })
  if (req.method !== 'POST' || req.url !== '/classify') return send(res, 404, { error: 'Not found' })
  if (!ready) return send(res, 503, { error: 'Model is loading or unavailable.' })
  if (pending) return send(res, 429, { error: 'Model is busy. Try again shortly.' })
  try {
    let size = 0
    const chunks = []
    for await (const chunk of req) { size += chunk.length; if (size > 65536) { send(res, 413, { error: 'Request too large' }); return } chunks.push(chunk) }
    const request = validateRequest(JSON.parse(Buffer.concat(chunks).toString('utf8')))
    if (pending) return send(res, 429, { error: 'Model is busy. Try again shortly.' })
    const timer = setTimeout(() => { unavailable(); void worker.terminate() }, 15000)
    pending = { res, timer }
    worker.postMessage(request)
  } catch (error) { send(res, 400, { error: error instanceof Error ? error.message : 'Invalid request' }) }
})
server.requestTimeout = 10000
server.headersTimeout = 10000
server.listen(Number(process.env.PORT || 8091), process.env.HOST || '127.0.0.1', () => console.log('Intent service listening; model loading in background.'))
