import { Worker } from 'node:worker_threads'
import { validateRequest } from './intent.mjs'
const worker = new Worker(new URL('./worker.mjs', import.meta.url))
const timer = setTimeout(() => { console.error('Model smoke test timed out'); void worker.terminate(); process.exitCode = 1 }, 180000)
worker.on('error', error => { clearTimeout(timer); console.error(error.message); process.exitCode = 1 })
worker.on('message', message => {
  if (message.ready) worker.postMessage(validateRequest({ text: 'How do I pay my fees?', categories: [{ name: 'billing', examples: ['How do I pay my fees?'] }, { name: 'admissions', examples: ['Apply for admission to university'] }] }))
  else { clearTimeout(timer); console.log(JSON.stringify(message)); if (message.result?.intent !== 'billing') process.exitCode = 1; void worker.terminate() }
})
