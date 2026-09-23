import { describe, expect, it } from 'vitest'
import { brandingToSettingsPatch, chatBrandingCssVars, parseChatbotBranding, resolveChatBranding, safeChatBackgroundUrl, CHAT_APPEARANCE_THEMES } from './chatbotBranding'

describe('chat appearance', () => {
  it('round trips every theme and background selection', () => {
    for (const theme of CHAT_APPEARANCE_THEMES) {
      const original = parseChatbotBranding({ branding: { appearanceTheme: theme.id, backgroundPattern: 'grid', backgroundImageUrl: 'https://example.com/photo.jpg' } })
      expect(parseChatbotBranding({ branding: brandingToSettingsPatch(original) })).toEqual(original)
    }
  })
  it('rejects unsafe image URLs and credentials', () => {
    for (const url of ['javascript:alert(1)', 'data:image/svg+xml,test', 'https://user:secret@example.com/image', 'invalid']) expect(safeChatBackgroundUrl(url)).toBeNull()
  })
  it('retains the theme fallback beneath an image and pattern', () => {
    const vars = chatBrandingCssVars(resolveChatBranding({ settings: { branding: { appearanceTheme: 'ocean', backgroundPattern: 'dots', backgroundImageUrl: 'https://example.com/a.jpg' } } }))
    expect(vars['--ff-chat-page-gradient']).toContain('url("https://example.com/a.jpg")')
    expect(vars['--ff-chat-page-gradient']).toContain('20px 20px')
    expect(vars['--ff-chat-page-gradient']).toContain('var(--ff-chat-page-bg)')
  })
  it('clears images explicitly and honors custom theme colors', () => {
    const branding = parseChatbotBranding({ branding: { appearanceTheme: 'aurora', headerColor: '#123456', pageBackground: '#abcdef' } })
    expect(brandingToSettingsPatch(branding).backgroundImageUrl).toBeNull()
    const vars = chatBrandingCssVars(resolveChatBranding({ chatbotBranding: branding }))
    expect(vars['--ff-chat-header-gradient']).toContain('var(--ff-chat-header)')
    expect(vars['--ff-chat-page-gradient']).toContain('var(--ff-chat-page-bg)')
  })
})
