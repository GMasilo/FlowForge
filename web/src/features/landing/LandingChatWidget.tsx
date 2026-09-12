import { useEffect, useRef } from 'react'
import { appBasePath, ensureEmbedScriptLoaded } from '@/features/platform/platformSettings'
import { embedWidgetKey } from '@/shared/lib/publicChatUrls'

type LandingChatWidgetProps = {
  publicSlug: string | null
  orgSlug?: string | null
  open?: boolean
  /** When the slug changes, destroy other embed widgets so only one launcher remains. */
  switchOnSlugChange?: boolean
}

/** Loads the self-contained embed.js widget (launcher + panel + CSS). */
export function LandingChatWidget({
  publicSlug,
  orgSlug,
  open,
  switchOnSlugChange,
}: LandingChatWidgetProps) {
  const slug = publicSlug?.trim() || null
  const org = orgSlug?.trim() || null
  const widgetKey = slug ? embedWidgetKey(org, slug) : null
  const previousKey = useRef<string | null>(null)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    ;(async () => {
      try {
        if (switchOnSlugChange && previousKey.current && previousKey.current !== widgetKey) {
          window.FlowForgeEmbed?.destroy()
        }
        await ensureEmbedScriptLoaded({
          slug,
          org: org || undefined,
          base: `${window.location.origin}${appBasePath()}`,
        })
        if (cancelled) return
        previousKey.current = widgetKey
        if (open) window.FlowForgeEmbed?.open(widgetKey!)
      } catch {
        // Script load failure — no toast on public pages.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug, org, widgetKey, switchOnSlugChange])

  useEffect(() => {
    if (open === undefined || !widgetKey) return
    if (open) window.FlowForgeEmbed?.open(widgetKey)
    else window.FlowForgeEmbed?.close(widgetKey)
  }, [open, widgetKey])

  return null
}
