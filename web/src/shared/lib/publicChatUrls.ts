/** Public chatbot URL helpers — org-scoped paths with legacy slug-only fallback. */

export function appBasePath(): string {
  return (import.meta.env.BASE_URL as string).replace(/\/$/, '')
}

export function publicChatPath(orgSlug: string | null | undefined, publicSlug: string): string {
  const slug = publicSlug.trim()
  const org = orgSlug?.trim()
  if (org) return `/o/${org}/c/${slug}`
  return `/c/${slug}`
}

export function publicEmbedPath(orgSlug: string | null | undefined, publicSlug: string): string {
  const slug = publicSlug.trim()
  const org = orgSlug?.trim()
  if (org) return `/o/${org}/embed/${slug}`
  return `/embed/${slug}`
}

export function publicChatUrl(
  orgSlug: string | null | undefined,
  publicSlug: string,
  opts?: { origin?: string; query?: string },
): string {
  const origin = opts?.origin ?? (typeof window !== 'undefined' ? window.location.origin : '')
  const path = `${appBasePath()}${publicChatPath(orgSlug, publicSlug)}`
  const q = opts?.query?.replace(/^\?/, '')
  return `${origin}${path}${q ? `?${q}` : ''}`
}

export function publicEmbedUrl(
  orgSlug: string | null | undefined,
  publicSlug: string,
  opts?: { origin?: string; query?: string },
): string {
  const origin = opts?.origin ?? (typeof window !== 'undefined' ? window.location.origin : '')
  const path = `${appBasePath()}${publicEmbedPath(orgSlug, publicSlug)}`
  const q = opts?.query?.replace(/^\?/, '')
  return `${origin}${path}${q ? `?${q}` : ''}`
}

/** Embed widget dictionary key — matches embed.js widgetKey(). */
export function embedWidgetKey(orgSlug: string | null | undefined, publicSlug: string): string {
  const slug = publicSlug.trim()
  const org = orgSlug?.trim()
  return org ? `${org}/${slug}` : slug
}
