/**
 * Builds samples/flowforge-home-demo.json — FlowForge landing-page showcase bot.
 * Reuses the comprehensive feature-tour graph, rebranded for the public home page.
 *
 * Run from repo root: node samples/home-demo/build.mjs
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TOUR = join(ROOT, 'flowforge-feature-tour.json')
const OUT = join(ROOT, 'flowforge-home-demo.json')

execSync('node samples/feature-tour/build.mjs', { cwd: join(ROOT, '..'), stdio: 'inherit' })

/** @type {import('../feature-tour/build.mjs')} */
const tour = JSON.parse(readFileSync(TOUR, 'utf8'))

function replaceAll(value, pairs) {
  if (typeof value === 'string') {
    let out = value
    for (const [from, to] of pairs) out = out.split(from).join(to)
    return out
  }
  if (Array.isArray(value)) return value.map((v) => replaceAll(v, pairs))
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = replaceAll(v, pairs)
    return out
  }
  return value
}

const BRAND = [
  ['ForgeHub', 'FlowForge'],
  ['forgehub', 'flowforge'],
  ['hello@forgehub.example', 'hello@flowforge.example'],
  ['forgehub_store', 'ff_demo_store'],
  ['ForgeHub merch', 'FlowForge demo store'],
  ['Your ForgeHub code', 'Your FlowForge code'],
]

const home = replaceAll(structuredClone(tour), BRAND)

home.exportedAt = new Date().toISOString()
home.chatbot = {
  id: 'c2000000-0000-4000-8000-000000000001',
  name: 'FlowForge Platform Demo',
  description:
    'Public landing-page demo — question types, templates, expressions, formatting, entities, shop, logic, HTTP, and email. Import via Admin → Platform or Chatbots → Import.',
}
home.flow = {
  id: 'f2000000-0000-4000-8000-000000000001',
  name: 'Home demo',
  version: 1,
}

const welcomeTemplate = home.templates.find((t) => t.key === 'welcome_msg')
if (welcomeTemplate?.content && typeof welcomeTemplate.content === 'object') {
  welcomeTemplate.content.text =
    'Hi **{{titleCase(inputs.name)}}** — welcome to the **FlowForge platform demo** on our home page.\n\nI will show you conversational flows: rich question types, reusable templates, structured data, shop checkout, logic, and {color:accent}expressions{/color} (`coalesce`, `formatDate`, `join`, …) with markdown formatting.\n\nToday: {{formatDate(utcNow(), "EEEE, MMM d")}}.'
}

const tourMenu = home.templates.find((t) => t.key === 'tour_menu')
if (tourMenu?.content && typeof tourMenu.content === 'object') {
  tourMenu.content.title = 'What this demo covers'
  tourMenu.content.items = [
    { label: 'Inputs', description: '40+ answer types', value: 'inputs' },
    { label: 'Expressions', description: 'Functions & formatting', value: 'expr' },
    { label: 'Shop', description: 'Catalog, cart, payment, receipt', value: 'shop' },
    { label: 'Data & logic', description: 'Entities, variables, HTTP, email', value: 'data' },
  ]
}

const welcomeNode = home.nodes.find((n) => n.key === 'welcome')
if (welcomeNode?.config) {
  welcomeNode.config.text =
    '{{templates.welcome_msg.text}}\n\n{{templates.tour_menu.text}}\n\n{{templates.studio_hours.text}}\n\n{{templates.help_faq.text}}\n\n{{templates.terms_of_use.text}}\n\nTip: this is the same bot embedded on the FlowForge landing page. Watch for {color:accent}**expressions**{/color} (`formatDate`, `join`, `if`, …) and chat formatting. Optional steps can be skipped where allowed.'
}

const endNode = home.nodes.find((n) => n.key === 'end_tour')
if (endNode?.config) {
  endNode.config.message = [
    '**Thanks for exploring FlowForge**, {{vars.full_name}}.',
    '',
    'Your visit was saved to the tour_visits entity. You saw question types, templates, shop, logic, and {color:accent}expression functions + formatting{/color}.',
    '',
    'Sign in to design your own bots, connect live agents, and publish to your site.',
  ].join('\n')
}

if (home.globals) {
  for (const g of home.globals) {
    if (g.key === 'brand_name') g.default_value = 'FlowForge'
    if (g.key === 'guest_label') g.default_value = 'visitor'
    if (g.key === 'support_email') g.default_value = 'hello@flowforge.example'
  }
}

if (home.testScenarios?.[0]?.globals) {
  home.testScenarios[0].globals.brand_name = 'FlowForge'
  home.testScenarios[0].globals.guest_label = 'Alex'
}

writeFileSync(OUT, `${JSON.stringify(home, null, 2)}\n`)
console.log(`Wrote ${OUT}`)
console.log(`${home.nodes.length} nodes · ${home.templates.length} templates · ${home.entityDefs?.length ?? 0} entities`)
