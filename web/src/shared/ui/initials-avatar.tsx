import { cn } from '@/shared/lib/utils'

const AVATAR_PALETTES = [
  ['#0f766e', '#0891b2', '#155e75'],
  ['#0e7490', '#0369a1', '#0f766e'],
  ['#115e59', '#0e7490', '#164e63'],
  ['#134e4a', '#0f766e', '#075985'],
  ['#1e3a5f', '#0e7490', '#0f766e'],
  ['#3f3f46', '#0f766e', '#0891b2'],
  ['#44403c', '#115e59', '#0e7490'],
  ['#292524', '#134e4a', '#0369a1'],
] as const

export function getInitials(nameOrEmail?: string | null): string {
  const raw = (nameOrEmail ?? '').trim()
  if (!raw) return '?'

  if (raw.includes('@')) {
    const local = raw.split('@')[0] ?? ''
    const parts = local.split(/[._\-\s]+/).filter(Boolean)
    if (parts.length >= 2) {
      return ((parts[0][0] ?? '') + (parts[1][0] ?? '')).toUpperCase()
    }
    return local.slice(0, 2).toUpperCase() || '?'
  }

  const parts = raw.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return ((parts[0][0] ?? '') + (parts[1][0] ?? '')).toUpperCase()
  }
  return raw.slice(0, 2).toUpperCase()
}

function hashSeed(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0
  }
  return h
}

export function avatarRadialStyle(seed: string): { background: string } {
  const palette = AVATAR_PALETTES[hashSeed(seed) % AVATAR_PALETTES.length]!
  return {
    background: `radial-gradient(circle at 32% 28%, ${palette[1]} 0%, ${palette[0]} 48%, ${palette[2]} 100%)`,
  }
}

const sizeClass = {
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-xl',
  xl: 'h-24 w-24 text-3xl',
} as const

export function InitialsAvatar({
  name,
  email,
  seed,
  size = 'md',
  className,
  title,
}: {
  name?: string | null
  email?: string | null
  /** Stable id for colour; falls back to email/name */
  seed?: string | null
  size?: keyof typeof sizeClass
  className?: string
  title?: string
}) {
  const label = name?.trim() || email?.trim() || 'User'
  const initials = getInitials(name?.trim() || email)
  const colourSeed = seed?.trim() || email?.trim() || name?.trim() || label

  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full font-semibold tracking-wide text-white shadow-[inset_0_1px_0_rgb(255_255_255_/_0.22),0_6px_14px_-8px_rgb(15_23_42_/_0.45)] ring-2 ring-[var(--color-surface)]',
        sizeClass[size],
        className,
      )}
      style={avatarRadialStyle(colourSeed)}
      title={title ?? label}
      role="img"
      aria-label={title ?? label}
    >
      <span className="translate-y-px drop-shadow-sm" aria-hidden>
        {initials}
      </span>
    </span>
  )
}
