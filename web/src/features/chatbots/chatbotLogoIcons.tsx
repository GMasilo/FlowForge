import type { LucideIcon } from 'lucide-react'
import {
  Bot,
  Building2,
  Coffee,
  Heart,
  HelpCircle,
  Headset,
  Leaf,
  LifeBuoy,
  MessageCircle,
  MessagesSquare,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  UserRound,
  Zap,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export type ChatLogoIconId =
  | 'sparkles'
  | 'message-circle'
  | 'messages-square'
  | 'bot'
  | 'headset'
  | 'life-buoy'
  | 'help-circle'
  | 'heart'
  | 'star'
  | 'zap'
  | 'user-round'
  | 'store'
  | 'shopping-bag'
  | 'building-2'
  | 'leaf'
  | 'coffee'

type ChatLogoIconDef = {
  id: ChatLogoIconId
  label: string
  Icon: LucideIcon
  /** Inline SVG paths for embed.js (Lucide 24×24, stroke icons). */
  paths: string
}

export const CHAT_LOGO_ICONS: ChatLogoIconDef[] = [
  {
    id: 'sparkles',
    label: 'Sparkles',
    Icon: Sparkles,
    paths: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
  },
  {
    id: 'message-circle',
    label: 'Message',
    Icon: MessageCircle,
    paths: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  },
  {
    id: 'messages-square',
    label: 'Messages',
    Icon: MessagesSquare,
    paths:
      '<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>',
  },
  {
    id: 'bot',
    label: 'Bot',
    Icon: Bot,
    paths:
      '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
  },
  {
    id: 'headset',
    label: 'Headset',
    Icon: Headset,
    paths:
      '<path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z"/><path d="M21 16v2a4 4 0 0 1-4 4h-5"/>',
  },
  {
    id: 'life-buoy',
    label: 'Support',
    Icon: LifeBuoy,
    paths:
      '<circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/>',
  },
  {
    id: 'help-circle',
    label: 'Help',
    Icon: HelpCircle,
    paths:
      '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  },
  {
    id: 'heart',
    label: 'Heart',
    Icon: Heart,
    paths:
      '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  },
  {
    id: 'star',
    label: 'Star',
    Icon: Star,
    paths:
      '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  },
  {
    id: 'zap',
    label: 'Zap',
    Icon: Zap,
    paths: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  },
  {
    id: 'user-round',
    label: 'Person',
    Icon: UserRound,
    paths: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  },
  {
    id: 'store',
    label: 'Store',
    Icon: Store,
    paths:
      '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M10 22V12h4v10"/><path d="M15 7a3 3 0 1 0-6 0"/><path d="M2 7h20"/>',
  },
  {
    id: 'shopping-bag',
    label: 'Bag',
    Icon: ShoppingBag,
    paths:
      '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  },
  {
    id: 'building-2',
    label: 'Building',
    Icon: Building2,
    paths:
      '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
  },
  {
    id: 'leaf',
    label: 'Leaf',
    Icon: Leaf,
    paths:
      '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  },
  {
    id: 'coffee',
    label: 'Coffee',
    Icon: Coffee,
    paths:
      '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>',
  },
]

const ICON_BY_ID = Object.fromEntries(CHAT_LOGO_ICONS.map((i) => [i.id, i])) as Record<
  ChatLogoIconId,
  ChatLogoIconDef
>

export function parseChatLogoIconId(raw: unknown): ChatLogoIconId | null {
  if (typeof raw !== 'string') return null
  const id = raw.trim() as ChatLogoIconId
  return id in ICON_BY_ID ? id : null
}

export function chatLogoIconDef(id: ChatLogoIconId | null | undefined): ChatLogoIconDef | null {
  if (!id) return null
  return ICON_BY_ID[id] ?? null
}

export function ChatLogoGlyph({
  id,
  className,
}: {
  id?: ChatLogoIconId | null
  className?: string
}) {
  const def = chatLogoIconDef(id) ?? ICON_BY_ID.sparkles
  const Icon = def.Icon
  return <Icon className={cn(className)} aria-hidden />
}
