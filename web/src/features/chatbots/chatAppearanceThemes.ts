/** Preset skins for public chat / embed / preview. `default` keeps the current look. */
export type ChatAppearanceTheme = 'default' | 'aurora' | 'sunset' | 'midnight' | 'botanical' | 'candy' | 'ocean'

export type ChatThemeColors = {
  headerColor: string
  headerTextColor: string
  bubbleUserColor: string
  bubbleBotColor: string
  bubbleBotTextColor: string
  pageBackground: string
  pageBackground2: string
  accentColor: string
}

export type ChatAppearanceThemeMeta = {
  id: ChatAppearanceTheme
  label: string
  description: string
  /** Fallback colours when branding colour fields are empty. */
  colors: ChatThemeColors
  /** Suggested bubble shape for this skin (applied only when picking the theme). */
  bubbleRadius: 'default' | 'pill' | 'square'
  /** Extra CSS custom properties merged into the chat root. */
  cssVars: Record<string, string>
  /** Swatch stops for the settings picker. */
  swatch: [string, string, string]
}

export const CHAT_APPEARANCE_THEMES: readonly ChatAppearanceThemeMeta[] = [
  {
    id: 'default',
    label: 'Default',
    description: 'Classic FlowForge teal — the current chat look.',
    colors: {
      headerColor: '#0d9488',
      headerTextColor: '#ffffff',
      bubbleUserColor: '#0d9488',
      bubbleBotColor: '#ffffff',
      bubbleBotTextColor: '#1e293b',
      pageBackground: '#f8fafc',
      pageBackground2: '#ccfbf1',
      accentColor: '#0d9488',
    },
    bubbleRadius: 'default',
    cssVars: {
      '--ff-chat-header-gradient':
        'linear-gradient(to bottom right, var(--ff-chat-header), var(--ff-chat-header-2))',
      '--ff-chat-page-gradient':
        'linear-gradient(to bottom right, var(--ff-chat-page-bg), var(--ff-chat-page-bg-2))',
      '--ff-chat-bubble-shadow': '0 1px 2px rgb(15 23 42 / 0.06)',
      '--ff-chat-bot-border': 'transparent',
      '--ff-chat-composer-surface': 'color-mix(in srgb, var(--color-surface) 90%, transparent)',
      '--ff-chat-header-sheen': 'none',
    },
    swatch: ['#0d9488', '#f8fafc', '#ffffff'],
  },
  {
    id: 'aurora',
    label: 'Aurora',
    description: 'Glass horizon — frosted panels, sky gradients, soft glow.',
    colors: {
      headerColor: '#0284c7',
      headerTextColor: '#f0f9ff',
      bubbleUserColor: '#0369a1',
      bubbleBotColor: '#f0f9ff',
      bubbleBotTextColor: '#0c4a6e',
      pageBackground: '#e0f2fe',
      pageBackground2: '#ddd6fe',
      accentColor: '#0ea5e9',
    },
    bubbleRadius: 'pill',
    cssVars: {
      '--ff-chat-header-gradient':
        'linear-gradient(115deg, #0369a1 0%, #0284c7 42%, #6366f1 100%)',
      '--ff-chat-page-gradient':
        'radial-gradient(120% 80% at 10% 0%, #bae6fd 0%, transparent 55%), radial-gradient(90% 70% at 100% 10%, #c4b5fd 0%, transparent 50%), linear-gradient(160deg, #e0f2fe, #ede9fe)',
      '--ff-chat-bubble-shadow': '0 10px 28px -14px rgb(14 165 233 / 0.45)',
      '--ff-chat-bot-border': 'rgb(255 255 255 / 0.65)',
      '--ff-chat-composer-surface': 'rgb(255 255 255 / 0.72)',
      '--ff-chat-header-sheen':
        'radial-gradient(80% 120% at 90% -20%, rgb(255 255 255 / 0.35), transparent 55%)',
    },
    swatch: ['#0284c7', '#6366f1', '#e0f2fe'],
  },
  {
    id: 'sunset',
    label: 'Sunset',
    description: 'Bold coral energy — diagonal heat, asymmetric bubbles.',
    colors: {
      headerColor: '#ea580c',
      headerTextColor: '#fff7ed',
      bubbleUserColor: '#e11d48',
      bubbleBotColor: '#fff1f2',
      bubbleBotTextColor: '#881337',
      pageBackground: '#fff7ed',
      pageBackground2: '#ffe4e6',
      accentColor: '#f43f5e',
    },
    bubbleRadius: 'square',
    cssVars: {
      '--ff-chat-header-gradient':
        'linear-gradient(135deg, #fb923c 0%, #f43f5e 55%, #db2777 100%)',
      '--ff-chat-page-gradient':
        'linear-gradient(155deg, #fff7ed 0%, #ffedd5 40%, #ffe4e6 100%)',
      '--ff-chat-bubble-shadow': '0 12px 30px -16px rgb(244 63 94 / 0.4)',
      '--ff-chat-bot-border': 'rgb(251 113 133 / 0.35)',
      '--ff-chat-composer-surface': 'rgb(255 247 237 / 0.92)',
      '--ff-chat-header-sheen':
        'linear-gradient(120deg, transparent 40%, rgb(255 255 255 / 0.22) 50%, transparent 60%)',
    },
    swatch: ['#ea580c', '#f43f5e', '#fff7ed'],
  },
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Signal dark — ink canvas with electric teal accents.',
    colors: {
      headerColor: '#0f172a',
      headerTextColor: '#e2e8f0',
      bubbleUserColor: '#14b8a6',
      bubbleBotColor: '#1e293b',
      bubbleBotTextColor: '#e2e8f0',
      pageBackground: '#020617',
      pageBackground2: '#0f172a',
      accentColor: '#2dd4bf',
    },
    bubbleRadius: 'square',
    cssVars: {
      '--ff-chat-header-gradient':
        'linear-gradient(180deg, #111827 0%, #0f172a 100%)',
      '--ff-chat-page-gradient':
        'radial-gradient(70% 50% at 50% -10%, rgb(45 212 191 / 0.18), transparent 55%), linear-gradient(180deg, #020617, #0b1220)',
      '--ff-chat-bubble-shadow': '0 0 0 1px rgb(45 212 191 / 0.12), 0 8px 24px -12px rgb(0 0 0 / 0.65)',
      '--ff-chat-bot-border': 'rgb(148 163 184 / 0.2)',
      '--ff-chat-composer-surface': 'rgb(15 23 42 / 0.92)',
      '--ff-chat-header-sheen':
        'linear-gradient(90deg, transparent, rgb(45 212 191 / 0.35), transparent)',
    },
    swatch: ['#0f172a', '#14b8a6', '#020617'],
  },
  {
    id: 'botanical', label: 'Botanical', description: 'Calm sage, warm paper and rich forest accents.',
    colors: { headerColor: '#14532d', headerTextColor: '#ffffff', bubbleUserColor: '#166534',
      bubbleBotColor: '#fffdf7', bubbleBotTextColor: '#18392b', pageBackground: '#f7f8ef',
      pageBackground2: '#dce9d5', accentColor: '#166534' },
    bubbleRadius: 'pill',
    cssVars: {
      '--ff-chat-header-gradient': 'linear-gradient(120deg, var(--ff-chat-header), var(--ff-chat-header-2))',
      '--ff-chat-page-gradient': 'radial-gradient(ellipse at top right, var(--ff-chat-page-bg-2), transparent 70%), linear-gradient(160deg, var(--ff-chat-page-bg), var(--ff-chat-page-bg-2))',
      '--ff-chat-bubble-shadow': '0 8px 24px -12px color-mix(in srgb, var(--ff-chat-accent) 30%, transparent)',
      '--ff-chat-bot-border': 'color-mix(in srgb, var(--ff-chat-accent) 18%, transparent)',
      '--ff-chat-composer-surface': '#fffdf7',
      '--ff-chat-header-sheen': 'radial-gradient(ellipse at top right, #ffffff22, transparent 65%)',
    },
    swatch: ['#14532d', '#166534', '#f7f8ef'],
  },
  {
    id: 'candy', label: 'Candy', description: 'Playful lavender, rounded surfaces and berry highlights.',
    colors: { headerColor: '#6d28d9', headerTextColor: '#ffffff', bubbleUserColor: '#7e22ce',
      bubbleBotColor: '#fffaff', bubbleBotTextColor: '#422060', pageBackground: '#faf5ff',
      pageBackground2: '#fce7f3', accentColor: '#9333ea' },
    bubbleRadius: 'pill',
    cssVars: {
      '--ff-chat-header-gradient': 'linear-gradient(120deg, var(--ff-chat-header), var(--ff-chat-header-2))',
      '--ff-chat-page-gradient': 'radial-gradient(ellipse at top right, var(--ff-chat-page-bg-2), transparent 70%), linear-gradient(160deg, var(--ff-chat-page-bg), var(--ff-chat-page-bg-2))',
      '--ff-chat-bubble-shadow': '0 8px 24px -12px color-mix(in srgb, var(--ff-chat-accent) 30%, transparent)',
      '--ff-chat-bot-border': 'color-mix(in srgb, var(--ff-chat-accent) 18%, transparent)',
      '--ff-chat-composer-surface': '#fffaff',
      '--ff-chat-header-sheen': 'radial-gradient(ellipse at top right, #ffffff22, transparent 65%)',
    },
    swatch: ['#6d28d9', '#9333ea', '#faf5ff'],
  },
  {
    id: 'ocean', label: 'Ocean', description: 'Deep blue glass with bright turquoise highlights.',
    colors: { headerColor: '#0c2540', headerTextColor: '#ffffff', bubbleUserColor: '#38bdf8',
      bubbleBotColor: '#15364c', bubbleBotTextColor: '#e0f2fe', pageBackground: '#071a2c',
      pageBackground2: '#103b50', accentColor: '#38bdf8' },
    bubbleRadius: 'pill',
    cssVars: {
      '--ff-chat-header-gradient': 'linear-gradient(120deg, var(--ff-chat-header), var(--ff-chat-header-2))',
      '--ff-chat-page-gradient': 'radial-gradient(ellipse at top right, var(--ff-chat-page-bg-2), transparent 70%), linear-gradient(160deg, var(--ff-chat-page-bg), var(--ff-chat-page-bg-2))',
      '--ff-chat-bubble-shadow': '0 8px 24px -12px color-mix(in srgb, var(--ff-chat-accent) 30%, transparent)',
      '--ff-chat-bot-border': 'color-mix(in srgb, var(--ff-chat-accent) 18%, transparent)',
      '--ff-chat-composer-surface': '#15364c',
      '--ff-chat-header-sheen': 'radial-gradient(ellipse at top right, #ffffff22, transparent 65%)',
    },
    swatch: ['#0c2540', '#38bdf8', '#071a2c'],
  },
] as const

const THEME_BY_ID = Object.fromEntries(CHAT_APPEARANCE_THEMES.map((t) => [t.id, t])) as Record<
  ChatAppearanceTheme,
  ChatAppearanceThemeMeta
>

export function parseChatAppearanceTheme(value: unknown): ChatAppearanceTheme {
  if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(THEME_BY_ID, value)) {
    return value as ChatAppearanceTheme
  }
  return 'default'
}

export function chatAppearanceThemeMeta(id: ChatAppearanceTheme): ChatAppearanceThemeMeta {
  return THEME_BY_ID[id] ?? THEME_BY_ID.default
}

export function chatAppearanceThemeClass(id: ChatAppearanceTheme): string {
  return `ff-chat-skin ff-chat-theme-${id}`
}
