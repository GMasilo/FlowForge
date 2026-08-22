/**
 * Manual check: npx vite-node src/features/templates/documentFill.check.ts
 */
import { interpolateTemplate, resolveExpressionValue } from '@/features/designer/preview/expressionEval'
import {
  encodeDocumentEmbed,
  decodeDocumentEmbed,
  fillDocumentSnapshot,
} from '@/features/templates/documentFill'
import { generateDocumentFile } from '@/features/templates/documentGenerate'
import {
  clampBlock,
  emptyDocumentBlock,
  flowToPageBlocks,
  mmToPct,
  normalizeDocumentColor,
  pctToMm,
  snapBlockMove,
  snapToGrid,
} from '@/features/templates/documentLayout'
import { parseTemplateContent, starterTemplateContent, templateExprValue, type DocumentContent } from '@/features/templates/templateModel'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

const content = parseTemplateContent('document', starterTemplateContent('document')) as DocumentContent
assert(content.format === 'pdf', 'starter is pdf')
assert(content.fields.some((f) => f.as === 'image'), 'starter has signature image field')

const ctx = {
  vars: {
    name: 'Ada',
    email: 'ada@example.com',
    signature: {
      filename: 'signature.png',
      originalName: 'signature.png',
      url: 'https://example.com/file/get?name=signature.png',
      mime: 'image/png',
      size: 12,
      key: 'signature_png',
    },
  },
  steps: {},
  inputs: {
    name: 'Ada',
    email: 'ada@example.com',
    signature: {
      filename: 'signature.png',
      originalName: 'signature.png',
      url: 'https://example.com/file/get?name=signature.png',
      mime: 'image/png',
      size: 12,
      key: 'signature_png',
    },
  },
}

const filled = fillDocumentSnapshot(
  content,
  (source) => interpolateTemplate(source, ctx),
  (source) => resolveExpressionValue(source, ctx),
  ctx.vars,
)
assert(filled.filename.includes('Ada'), `filename interpolates, got ${filled.filename}`)
assert(filled.filename.endsWith('.pdf'), 'filename keeps pdf')
assert(filled.fields.some((f) => f.text === 'Ada'), 'name field filled')
assert(
  filled.fields.some((f) => f.imageUrl?.includes('signature.png')),
  'signature image url captured',
)

const embed = encodeDocumentEmbed(filled)
const roundTrip = decodeDocumentEmbed(embed.slice('<<ff:doc:'.length, -2))
assert(roundTrip?.filename === filled.filename, 'embed round-trip')
assert(filled.layout === 'flow', 'starter stays list layout')

{
  const docExpr = templateExprValue({
    id: '1',
    key: 'agreement',
    name: 'Agreement',
    kind: 'document',
    content,
  })
  const viaBindings = interpolateTemplate('{{templates.agreement.file}}', {
    vars: ctx.vars,
    steps: {},
    templates: { agreement: docExpr },
    templateBindings: {
      agreement: {
        name: '{{vars.name}}',
        email: '{{vars.email}}',
        signature: '{{vars.signature}}',
      },
    },
  })
  assert(viaBindings === filled.filename, `document .file fills inputs from bindings, got ${viaBindings}`)
}

{
  const pageContent: DocumentContent = {
    ...content,
    layout: 'page',
    blocks: flowToPageBlocks(content),
  }
  assert(pageContent.blocks.some((b) => b.type === 'heading'), 'page blocks from list')
  assert(pageContent.blocks.some((b) => b.type === 'image'), 'signature block placed')
  const pageFilled = fillDocumentSnapshot(
    pageContent,
    (source) => interpolateTemplate(source, ctx),
    (source) => resolveExpressionValue(source, ctx),
    ctx.vars,
  )
  assert(pageFilled.layout === 'page', 'page snapshot')
  assert(pageFilled.blocks.some((b) => b.text === 'Ada' || b.text.includes('Ada')), 'page field filled')
  const pagePdf = await generateDocumentFile(pageFilled)
  assert(pagePdf.bytes[0] === 0x25 && pagePdf.bytes[1] === 0x50, 'page pdf magic')
}

assert(snapToGrid(7.4) === 8, 'snap 7.4 to 8')
assert(snapToGrid(1) === 0 || snapToGrid(1) === 2, 'snap 1 to nearest 2%')
assert(normalizeDocumentColor('#c00') === '#cc0000', 'expand 3-digit hex')
assert(pctToMm(100, 'x') === 210, 'full A4 width mm')
assert(Math.abs(mmToPct(21, 'x') - 10) < 0.01, '21mm is 10% width')
assert(pctToMm(100, 'y') === 297, 'full A4 height mm')
{
  const line = clampBlock({ ...emptyDocumentBlock('divider', 10), h: mmToPct(0.1, 'y') })
  assert(Math.abs(pctToMm(line.h, 'y') - 0.1) < 0.001, `0.1mm line kept, got ${pctToMm(line.h, 'y')}`)
  const box = clampBlock({ ...emptyDocumentBlock('text', 10), w: mmToPct(12.37, 'x') })
  assert(Math.abs(pctToMm(box.w, 'x') - 12.37) < 0.001, `12.37mm width kept, got ${pctToMm(box.w, 'x')}`)
}
{
  const moving = { x: 8, y: 10, w: 20, h: 6 }
  const sibling = { x: 20, y: 40, w: 30, h: 8 }
  const aligned = snapBlockMove(moving, 11.7, 0, [sibling], { grid: false, guides: true })
  assert(Math.abs(aligned.x - 20) < 0.05, `object snap x, got ${aligned.x}`)
  assert(aligned.guides.some((g) => g.axis === 'v' && g.pos === 20), 'vertical guide')
  const gridded = snapBlockMove(moving, 1.1, 1.1, [], { grid: true, guides: false })
  assert(gridded.x === 10 && gridded.y === 12, `grid snap, got ${gridded.x},${gridded.y}`)
}

{
  const styled = emptyDocumentBlock('heading', 8)
  styled.fontFamily = 'times'
  styled.color = '#1d4ed8'
  styled.fill = '#fff7ed'
  styled.bold = true
  const pageContent: DocumentContent = {
    ...content,
    layout: 'page',
    blocks: [styled],
  }
  const styledFilled = fillDocumentSnapshot(
    pageContent,
    (source) => interpolateTemplate(source, ctx),
    (source) => resolveExpressionValue(source, ctx),
    ctx.vars,
  )
  assert(styledFilled.blocks[0]?.fontFamily === 'times', 'font round-trip')
  assert(styledFilled.blocks[0]?.color === '#1d4ed8', 'colour round-trip')
  assert(styledFilled.blocks[0]?.fill === '#fff7ed', 'fill round-trip')
  const styledEmbed = decodeDocumentEmbed(encodeDocumentEmbed(styledFilled).slice('<<ff:doc:'.length, -2))
  assert(styledEmbed?.blocks[0]?.fontFamily === 'times', 'embed keeps font')
  const styledPdf = await generateDocumentFile(styledFilled)
  assert(styledPdf.bytes[0] === 0x25, 'styled pdf')
}

const xlsxContent: DocumentContent = {
  ...content,
  format: 'xlsx',
  filename: 'export.xlsx',
  includeCart: true,
}
const withCart = fillDocumentSnapshot(
  xlsxContent,
  (source) => interpolateTemplate(source, {
    ...ctx,
    vars: {
      ...ctx.vars,
      cart: {
        items: [{ name: 'Espresso', qty: 2, lineTotal: 7 }],
        itemCount: 2,
        subtotal: 7,
        total: 7,
        currency: 'USD',
        fees: [],
      },
    },
  }),
  (source) => resolveExpressionValue(source, ctx),
  {
    ...ctx.vars,
    cart: {
      items: [{ name: 'Espresso', qty: 2, lineTotal: 7 }],
      itemCount: 2,
      subtotal: 7,
      total: 7,
      currency: 'USD',
      fees: [],
    },
  },
)
assert(withCart.cart?.items[0]?.name === 'Espresso', 'cart snapshot')

const xlsx = await generateDocumentFile(withCart)
assert(xlsx.bytes.length > 100, 'xlsx bytes')
assert(xlsx.filename.endsWith('.xlsx'), 'xlsx name')
assert(xlsx.mime.includes('spreadsheet'), 'xlsx mime')

const pdf = await generateDocumentFile({ ...filled, cart: null })
assert(pdf.bytes.length > 200, 'pdf bytes')
assert(pdf.bytes[0] === 0x25 && pdf.bytes[1] === 0x50, 'pdf magic')

console.log('documentFill.check.ts: all passed')
