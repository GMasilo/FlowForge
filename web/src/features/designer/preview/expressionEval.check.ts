/**
 * Manual check: npx vite-node src/features/designer/preview/expressionEval.check.ts
 */
import { format } from 'date-fns'
import {
  collectPathRefs,
  interpolateTemplate,
  parseJsonValue,
  resolveExpressionValue,
  tryEvaluateExpression,
} from './expressionEval'
import { decodeMapEmbed, FF_MAP_CLOSE, FF_MAP_OPEN } from '@/features/templates/mapEmbed'

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

{
  const copyCtx = {
    vars: { name: 'Ada' },
    steps: {},
    templateBindings: {
      welcome: { name: '{{vars.name}}' },
      faq: { name: '{{vars.name}}' },
    },
    templates: {
      welcome: { kind: 'message', text: 'Hello {{inputs.name}}' },
      faq: {
        kind: 'faq',
        text: 'Hi {{inputs.name}}\n\n• Hours?\n  We open at 9.',
      },
    },
  }
  assert(
    interpolateTemplate('{{templates.welcome.text}}', copyCtx) === 'Hello Ada',
    'message template fills inputs from bindings',
  )
  assert(
    interpolateTemplate('{{templates.faq.text}}', copyCtx).startsWith('Hi Ada'),
    'faq .text fills inputs on access',
  )
}

{
  const mapCtx = {
    vars: { office_lat: '-26.2041', office_lon: '28.0473' },
    steps: {},
    embedMedia: true,
    templateBindings: {
      office_map: { lat: '{{vars.office_lat}}', lon: '{{vars.office_lon}}' },
    },
    templates: {
      office_map: {
        id: 't1',
        key: 'office_map',
        name: 'Office Map',
        kind: 'map',
        title: 'Head Office',
        intro: '',
        centerLat: '-26.2041',
        centerLng: '28.0473',
        zoom: 12,
        style: 'roadmap',
        // Pre-baked like templateExprValue — must be rebuilt after pin fill.
        embedUrl:
          'https://www.openstreetmap.org/export/embed.html?bbox=0%2C0%2C1%2C1&layer=mapnik&marker=0%2C0',
        pins: [
          {
            label: 'Head Office',
            description: '123 Main Street, Johannesburg',
            lat: '{{inputs.lat}}',
            lng: '{{inputs.lon}}',
            link: '',
          },
        ],
        inputs: [
          { key: 'lat', label: 'Latitude', type: 'text' },
          { key: 'lon', label: 'Longitude', type: 'text' },
        ],
        text: 'static',
      },
    },
  }
  const viaText = interpolateTemplate('{{templates.office_map.text}}', mapCtx)
  assert(viaText.startsWith(FF_MAP_OPEN), `map .text embed got ${viaText.slice(0, 40)}`)
  const textB64 = viaText.slice(FF_MAP_OPEN.length, viaText.endsWith(FF_MAP_CLOSE) ? -FF_MAP_CLOSE.length : undefined)
  const textPayload = decodeMapEmbed(textB64)
  assert(textPayload, 'map .text decodes')
  assert(textPayload!.pins[0]?.lat === '-26.2041', `map .text lat got ${textPayload!.pins[0]?.lat}`)
  assert(textPayload!.pins[0]?.lng === '28.0473', `map .text lng got ${textPayload!.pins[0]?.lng}`)
  assert(
    textPayload!.embedUrl.includes('-26.2041') && textPayload!.embedUrl.includes('28.0473'),
    `map .text embedUrl should center on filled pins, got ${textPayload!.embedUrl}`,
  )

  const viaEmbed = interpolateTemplate('{{embed(templates.office_map)}}', mapCtx)
  assert(viaEmbed.startsWith(FF_MAP_OPEN), `embed(map) got ${viaEmbed.slice(0, 40)}`)
  const embedB64 = viaEmbed.slice(FF_MAP_OPEN.length, viaEmbed.endsWith(FF_MAP_CLOSE) ? -FF_MAP_CLOSE.length : undefined)
  const embedPayload = decodeMapEmbed(embedB64)
  assert(embedPayload, 'embed(map) decodes')
  assert(embedPayload!.pins[0]?.lat === '-26.2041', `embed(map) lat got ${embedPayload!.pins[0]?.lat}`)
  assert(embedPayload!.pins[0]?.lng === '28.0473', `embed(map) lng got ${embedPayload!.pins[0]?.lng}`)
  assert(
    embedPayload!.embedUrl.includes('marker=-26.2041%2C28.0473') ||
      embedPayload!.embedUrl.includes('marker=-26.2041,28.0473'),
    `embed(map) marker should use filled coords, got ${embedPayload!.embedUrl}`,
  )
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
const ytEmbed = interpolateTemplate(
  '{{embed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")}}',
  { ...ctx, embedMedia: true },
)
assert(ytEmbed.startsWith('<<ff:embed:'), `embed youtube got ${ytEmbed}`)
const xEmbed = interpolateTemplate('{{embed("https://x.com/demo/status/1234567890123456789")}}', {
  ...ctx,
  embedMedia: true,
})
assert(xEmbed.startsWith('<<ff:embed:'), `embed x got ${xEmbed}`)
assert(
  interpolateTemplate('{{embed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")}}', ctx) ===
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'embed without chat context returns URL',
)
assert(
  JSON.stringify(collectPathRefs('{{embed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")}}')) === '[]',
  'embed URL expression has no path refs',
)
assert(
  JSON.stringify(collectPathRefs('{{embed(vars.video_url)}}')) === '["vars.video_url"]',
  'embed var still collects path ref',
)
assert(
  JSON.stringify(collectPathRefs('Hi {{parseJson(vars.jsonStr).n}}')) === '["vars.jsonStr"]',
  'parseJson still collects path ref',
)
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
