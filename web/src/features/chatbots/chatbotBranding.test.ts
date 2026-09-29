import { describe, expect, it } from 'vitest'
import { brandingToSettingsPatch, chatRootStyle, chatBrandingCssVars, parseChatbotBranding, resolveChatBranding, safeChatBackgroundUrl, CHAT_APPEARANCE_THEMES } from './chatbotBranding'

describe('chat appearance', () => {
  it('uses contrasting automatic text for light and dark custom headers', () => {
    for (const theme of CHAT_APPEARANCE_THEMES) {
      for (const [headerColor, expected] of [['#ffffff', '#000000'], ['#000000', '#ffffff']]) {
        const resolved = resolveChatBranding({ settings: { branding: { appearanceTheme: theme.id, headerColor } } })
        expect(chatBrandingCssVars(resolved)['--ff-chat-header-fg']).toBe(expected)
      }
    }
  })
  it('keeps explicit header text colours and isolates native controls from the app theme', () => {
    for (const theme of CHAT_APPEARANCE_THEMES) {
      const resolved = resolveChatBranding({ settings: { branding: { appearanceTheme: theme.id, headerColor: '#ffffff', headerTextColor: '#123456' } } })
      expect(chatBrandingCssVars(resolved)['--ff-chat-header-fg']).toBe('#123456')
      expect(chatRootStyle(resolved).color).toBe('var(--color-ink)')
      expect(chatRootStyle(resolved).colorScheme).toBe(['midnight', 'ocean'].includes(theme.id) ? 'dark' : 'light')
    }
  })
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
