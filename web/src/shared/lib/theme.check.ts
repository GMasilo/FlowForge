/**
 * Manual check: npx vite-node src/shared/lib/theme.check.ts
 */
import {
  isThemePreference,
  nextThemePreference,
  resolveTheme,
  type ThemePreference,
} from '@/shared/lib/theme'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

assert(isThemePreference('light'), 'light ok')
assert(isThemePreference('dark'), 'dark ok')
assert(isThemePreference('system'), 'system ok')
assert(!isThemePreference('auto'), 'reject auto')
assert(!isThemePreference(null), 'reject null')

const order: ThemePreference[] = ['system', 'light', 'dark']
for (let i = 0; i < order.length; i++) {
  assert(nextThemePreference(order[i]!) === order[(i + 1) % order.length], `cycle from ${order[i]}`)
}

assert(resolveTheme('light') === 'light', 'resolve light')
assert(resolveTheme('dark') === 'dark', 'resolve dark')

console.log('theme.check.ts: ok')
