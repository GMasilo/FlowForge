/** Apply / clear per-organisation branding on document CSS variables. */

export type InstanceBrandingInput = {
  brand_accent_color?: string | null
  brand_display_name?: string | null
  brand_logo_url?: string | null
  name?: string
}

const ACCENT_VARS = [
  '--color-accent',
  '--color-accent-2',
  '--color-accent-fg',
  '--color-accent-soft',
] as const

function clamp(n: number, min = 0, max = 255): number {
  return Math.min(max, Math.max(min, Math.round(n)))
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1]!, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((x) => clamp(x).toString(16).padStart(2, '0')).join('')}`
}

function mix(hex: string, toward: 'white' | 'black', amount: number): string {
  const rgb = parseHex(hex)
  if (!rgb) return hex
  const t = toward === 'white' ? 255 : 0
  return toHex(
    rgb.r + (t - rgb.r) * amount,
    rgb.g + (t - rgb.g) * amount,
    rgb.b + (t - rgb.b) * amount,
  )
}

function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex)
  if (!rgb) return 0
  const lin = [rgb.r, rgb.g, rgb.b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!
}

export function normalizeBrandAccent(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim()
  if (!raw) return null
  const withHash = raw.startsWith('#') ? raw : `#${raw}`
  if (!/^#[0-9a-fA-F]{6}$/.test(withHash)) return null
  return withHash.toLowerCase()
}

export function applyInstanceBranding(branding: InstanceBrandingInput | null | undefined): void {
  const root = document.documentElement
  const accent = normalizeBrandAccent(branding?.brand_accent_color ?? null)
  if (!accent) {
    clearInstanceBranding()
    return
  }
  const isDark = root.classList.contains('dark')
  const accent2 = mix(accent, isDark ? 'white' : 'white', isDark ? 0.35 : 0.25)
  const soft = isDark ? mix(accent, 'black', 0.55) : mix(accent, 'white', 0.82)
  const fg = relativeLuminance(accent) > 0.55 ? '#042f2e' : '#ffffff'
  root.style.setProperty('--color-accent', accent)
  root.style.setProperty('--color-accent-2', accent2)
  root.style.setProperty('--color-accent-fg', fg)
  root.style.setProperty('--color-accent-soft', soft)
  root.dataset.instanceBrand = '1'
}

export function clearInstanceBranding(): void {
  const root = document.documentElement
  for (const key of ACCENT_VARS) {
    root.style.removeProperty(key)
  }
  delete root.dataset.instanceBrand
}

export function brandWorkspaceTitle(branding: InstanceBrandingInput | null | undefined): string {
  const override = (branding?.brand_display_name ?? '').trim()
  if (override) return override
  return 'FlowForge'
}

export function brandLogoUrl(branding: InstanceBrandingInput | null | undefined): string | null {
  const url = (branding?.brand_logo_url ?? '').trim()
  return url || null
}
