import type { ChatbotStory, ResolvedChatStory } from '@/features/chatbots/chatbotBranding'
import { mediaKindOf } from '@/features/designer/model/chatbotMedia'

export const STORY_TTL_MS = 24 * 60 * 60 * 1000
export const STORY_DEFAULT_IMAGE_MS = 5000
export const STORY_MAX_VIDEO_MS = 30_000
export const STORY_MAX_COUNT = 10
export const STORY_MEDIA_ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.mp4,.webm'

export function storyExpiresAt(createdAt: string): string {
  const t = Date.parse(createdAt)
  if (Number.isNaN(t)) return createdAt
  return new Date(t + STORY_TTL_MS).toISOString()
}

export function isStoryActive(story: Pick<ChatbotStory, 'createdAt'>, now = Date.now()): boolean {
  const t = Date.parse(story.createdAt)
  if (Number.isNaN(t)) return false
  return now - t < STORY_TTL_MS
}

export function filterActiveStories(stories: ChatbotStory[], now = Date.now()): ChatbotStory[] {
  return stories.filter((s) => isStoryActive(s, now))
}

export function pruneExpiredStories(stories: ChatbotStory[], now = Date.now()): ChatbotStory[] {
  return filterActiveStories(stories, now).slice(0, STORY_MAX_COUNT)
}

export function storyKindFromFilename(filename: string): 'image' | 'video' | null {
  const kind = mediaKindOf({ filename, mime: '' })
  if (kind === 'image' || kind === 'video') return kind
  return null
}

export function storyRemainingLabel(createdAt: string, now = Date.now()): string {
  const t = Date.parse(createdAt)
  if (Number.isNaN(t)) return 'Expired'
  const left = t + STORY_TTL_MS - now
  if (left <= 0) return 'Expired'
  const hours = Math.floor(left / (60 * 60 * 1000))
  const mins = Math.floor((left % (60 * 60 * 1000)) / (60 * 1000))
  if (hours >= 1) return `${hours}h ${mins}m left`
  if (mins >= 1) return `${mins}m left`
  return 'Under 1m left'
}

export function storiesSeenStorageKey(chatbotId: string): string {
  return `ff-chat-stories-seen:${chatbotId}`
}

export function loadSeenStoryIds(chatbotId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storiesSeenStorageKey(chatbotId))
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && !!id))
  } catch {
    return new Set()
  }
}

export function markStoriesSeen(chatbotId: string, ids: string[]): Set<string> {
  const next = loadSeenStoryIds(chatbotId)
  for (const id of ids) {
    if (id) next.add(id)
  }
  try {
    localStorage.setItem(storiesSeenStorageKey(chatbotId), JSON.stringify([...next]))
  } catch {
    // ignore quota / private mode
  }
  return next
}

export function hasUnreadStories(stories: ResolvedChatStory[], chatbotId: string): boolean {
  if (!stories.length) return false
  const seen = loadSeenStoryIds(chatbotId)
  return stories.some((s) => !seen.has(s.id))
}

export function newStoryId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `story_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
