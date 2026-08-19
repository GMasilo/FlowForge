/**
 * Manual check: npx vite-node src/shared/lib/documentHandlers.check.ts
 */
import {
  createDocumentHandlers,
  getDocumentUrl,
  getDownloadUrl,
} from '@/shared/lib/documentApi'
import {
  formatFileSize,
  getDocumentCategory,
  isPdfFile,
  validateFilename,
} from '@/shared/lib/documentHelpers'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

const scope = { instanceId: 'inst-1', chatbotId: 'bot-1', kind: 'media' as const }
const handlers = createDocumentHandlers(scope)

assert(typeof handlers.view === 'function', 'handlers.view')
assert(typeof handlers.download === 'function', 'handlers.download')
assert(typeof handlers.open === 'function', 'handlers.open')
assert(typeof handlers.list === 'function', 'handlers.list')

const inlineUrl = getDocumentUrl('inst-1', 'bot-1', 'report.pdf')
assert(inlineUrl.includes('report.pdf'), `inline url includes filename: ${inlineUrl}`)

const downloadUrl = getDownloadUrl('inst-1', 'bot-1', 'report.pdf')
assert(downloadUrl.includes('/document/download'), `download url path: ${downloadUrl}`)

assert(isPdfFile('agreement.pdf'), 'pdf detection')
assert(getDocumentCategory('agreement.pdf') === 'PDF', 'pdf category')
assert(formatFileSize(1536) === '1.5 KB', 'size format')
assert(validateFilename('report.pdf').valid, 'valid filename')
assert(!validateFilename('bad/name.pdf').valid, 'reject slash in filename')

console.log('documentHandlers.check.ts: all passed')
