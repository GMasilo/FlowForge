/**
 * Manual check: npx vite-node src/features/designer/preview/expressionEval.check.ts
 */
import { format } from 'date-fns'
import {
  interpolateTemplate,
  parseJsonValue,
  resolveExpressionValue,
  tryEvaluateExpression,
} from './expressionEval'

const ctx = {
  vars: {
    jsonStr: '{"name":"Ada","items":["a","b"],"n":3}',
    name: 'World',
    count: 2,
    empty: '',
    obj: { nested: true },
  },
  steps: {
    http_1: { data: { id: 7 } },
  },
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

const parsed = resolveExpressionValue('parseJson({{vars.jsonStr}})', ctx) as {
  name: string
  items: string[]
  n: number
}
assert(parsed?.name === 'Ada', 'parseJson({{vars.jsonStr}}) name')
assert(parsed?.items[1] === 'b', 'parseJson items')

const path = resolveExpressionValue('{{parseJson(vars.jsonStr).items[0]}}', ctx)
assert(path === 'a', 'nested path after parseJson')

const math = resolveExpressionValue('{{vars.count + 1}}', ctx)
assert(math === 3, 'arithmetic')

const coalesced = resolveExpressionValue("coalesce(vars.empty, vars.name, 'x')", ctx)
assert(coalesced === 'World', 'coalesce')

const iff = resolveExpressionValue("if(empty(vars.empty), 'yes', 'no')", ctx)
assert(iff === 'yes', 'if/empty')

const text = interpolateTemplate('Hi {{vars.name}} · {{parseJson(vars.jsonStr).n}}', ctx)
assert(text === 'Hi World · 3', `interpolate got ${text}`)

const already = parseJsonValue(ctx.vars.obj)
assert(already.ok && (already.value as { nested: boolean }).nested === true, 'parseJson object passthrough')

const bad = parseJsonValue('{not json')
assert(!bad.ok && bad.value === null, 'parseJson invalid')

const failed = tryEvaluateExpression('parseJson("nope")', ctx)
assert(!failed.ok, 'bad parseJson expression fails')

const step = resolveExpressionValue('{{steps.http_1.data.id}}', ctx)
assert(step === 7, 'steps path')

{
  const receiptCtx = {
    vars: {
      name: 'Ada',
      cart: {
        items: [{ name: 'Espresso', qty: 2, lineTotal: 7 }],
        itemCount: 2,
        subtotal: 7,
        total: 7,
        currency: 'USD',
      },
      payment: { reference: 'PF-1', status: 'paid' },
    },
    steps: {},
    templates: {
      receipt: {
        kind: 'receipt',
        title: 'Order for {{vars.name}}',
        intro: '',
        footer: 'Thanks',
        text: 'static',
      },
    },
  }
  const filled = interpolateTemplate('{{templates.receipt.text}}', receiptCtx)
  assert(filled.includes('Espresso'), `receipt fills cart lines, got ${filled}`)
  assert(filled.includes('Ada'), 'receipt interpolates vars in title')
  assert(filled.includes('PF-1'), 'receipt fills payment reference')
  const html = interpolateTemplate('{{templates.receipt.html}}', receiptCtx)
  assert(html.includes('<br>'), 'receipt html uses line breaks')
}

const mediaCtx = { ...ctx, media: { logo_png: 'https://cdn.example/logo.png' } }
assert(
  interpolateTemplate('Logo {{media.logo_png}}', mediaCtx) === 'Logo https://cdn.example/logo.png',
  'media path',
)

const mediaObjCtx = {
  ...ctx,
  media: {
    logo_png: {
      url: 'https://cdn.example/logo.png',
      filename: 'logo.png',
      name: 'logo.png',
      mime: 'image/png',
      type: 'image',
      size: 12,
      key: 'logo_png',
    },
  },
}
assert(interpolateTemplate('{{media.logo_png.filename}}', mediaObjCtx) === 'logo.png', 'media filename')
assert(interpolateTemplate('x {{media.logo_png}}', mediaObjCtx) === 'x https://cdn.example/logo.png', 'media object as url')
const preview = interpolateTemplate('Hi {{renderFile(media.logo_png)}}', { ...mediaObjCtx, embedMedia: true })
assert(preview.startsWith('Hi <<ff:file:'), `renderFile embed got ${preview}`)
assert(interpolateTemplate('{{media.logo_png.type}}', mediaObjCtx) === 'image', 'media type')

assert(resolveExpressionValue('{{startsWith("FlowForge", "Flow")}}', ctx) === true, 'startsWith')
assert(resolveExpressionValue('{{endsWith("report.pdf", ".pdf")}}', ctx) === true, 'endsWith')
assert(resolveExpressionValue('{{slice("abcdef", 1, 4)}}', ctx) === 'bcd', 'slice')
assert(resolveExpressionValue('{{padStart("42", 4, "0")}}', ctx) === '0042', 'padStart')
assert(resolveExpressionValue('{{capitalize("hello")}}', ctx) === 'Hello', 'capitalize')
assert(resolveExpressionValue('{{titleCase("ada lovelace")}}', ctx) === 'Ada Lovelace', 'titleCase')
assert(resolveExpressionValue('{{slugify("Ada Lovelace!")}}', ctx) === 'ada-lovelace', 'slugify')
assert(resolveExpressionValue('{{at(parseJson(vars.jsonStr).items, -1)}}', ctx) === 'b', 'at negative')
assert(JSON.stringify(resolveExpressionValue('{{unique(split("a,b,a", ","))}}', ctx)) === '["a","b"]', 'unique')
assert(resolveExpressionValue('{{round(19.987, 2)}}', ctx) === 19.99, 'round')
assert(resolveExpressionValue('{{clamp(140, 0, 100)}}', ctx) === 100, 'clamp')
assert(resolveExpressionValue('{{mod(5, 2)}}', ctx) === 1, 'mod')

const iso = '2026-08-07T07:35:00.000Z'
assert(
  resolveExpressionValue(`{{prettify("${iso}", "date")}}`, ctx) === format(new Date(iso), 'MMM d, yyyy'),
  'prettify date',
)
assert(
  resolveExpressionValue(`{{formatDate("${iso}", "yyyy-MM-dd")}}`, ctx) === '2026-08-07',
  'formatDate',
)
assert(
  resolveExpressionValue(`{{dateAdd("${iso}", 1, "days")}}`, ctx) === '2026-08-08T07:35:00.000Z',
  'dateAdd',
)
assert(resolveExpressionValue(`{{dateDiff("2026-08-14T00:00:00.000Z", "2026-08-07T00:00:00.000Z", "days")}}`, ctx) === 7, 'dateDiff')
assert(resolveExpressionValue('{{preetyfy("2026-08-07T12:00:00.000Z", "iso")}}', ctx) === '2026-08-07T12:00:00.000Z', 'preetyfy alias')

console.log(
  JSON.stringify(
    {
      ok: true,
      parsed,
      path,
      math,
      coalesced,
      iff,
      text,
      step,
    },
    null,
    2,
  ),
)
