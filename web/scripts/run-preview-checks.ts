import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dirs = [
  'src/features/designer/preview',
  'src/features/designer/model',
  'src/features/designer/utils',
  'src/features/designer/validation',
  'src/features/entities',
  'src/features/templates',
  'src/shared/lib',
]

const files = dirs.flatMap((dir) =>
  readdirSync(join(root, dir))
    .filter((name) => name.endsWith('.check.ts'))
    .map((name) => join(dir, name).replace(/\\/g, '/')),
)

if (!files.length) {
  console.error('No *.check.ts files found')
  process.exit(1)
}

let failed = 0
for (const file of files) {
  console.log(`\n→ ${file}`)
  const result = spawnSync('npx', ['vite-node', file], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  })
  if ((result.status ?? 1) !== 0) {
    failed += 1
    console.error(`FAILED: ${file}`)
  }
}

if (failed) {
  console.error(`\n${failed} check(s) failed`)
  process.exit(1)
}

console.log(`\nAll ${files.length} preview checks passed`)
process.exit(0)
