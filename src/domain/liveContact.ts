import { characterFromDraft } from './importing.ts'
import { ensureDirectChat } from './messaging.ts'
import { parseCharacterCard } from '../lib/sillytavern.ts'
import { importChatBackground } from '../lib/wallpaper.ts'
import { storage } from '../storage/StorageService.ts'

export interface LiveAnchorContact {
  id: string
  realName: string
  stageName: string
  background: string
  personality: string
  chatStyle?: string
  speakingStyle?: string
  portraitUrl?: string
  appearance?: string
  hairColor?: string
  age?: number
  ageLabel?: string
  species?: string
}

const pending = new Map<string, ReturnType<typeof saveLiveFriend>>()

/** Retrying the handoff reuses the same contact and repairs old URL-only avatars. */
export function addLiveSmsFriend(namespace: string, anchor: LiveAnchorContact, frameUrl: string, playerName: string) {
  const key = JSON.stringify([namespace, anchor.id])
  const existing = pending.get(key)
  if (existing) return existing
  const task = saveLiveFriend(namespace, anchor, frameUrl, playerName).finally(() => pending.delete(key))
  pending.set(key, task)
  return task
}

async function saveLiveFriend(namespace: string, anchor: LiveAnchorContact, frameUrl: string, playerName: string) {
  let person = (await storage.listCharacters(namespace)).find(item => item.extensions?.liveAnchorId === anchor.id)
  let portrait = ''
  if (anchor.portraitUrl) {
    const url = new URL(anchor.portraitUrl, frameUrl)
    if (/^(?:https?:|blob:)$/.test(url.protocol) || /^data:image\//i.test(url.href)) portrait = url.href
  }
  if (portrait && !person?.avatar.startsWith('data:image/')) {
    try {
      const response = await fetch(portrait, { signal: AbortSignal.timeout(15_000) })
      if (!response.ok) throw new Error('主播图片暂时无法读取')
      const image = await response.blob()
      portrait = await importChatBackground(new File([image], 'live-avatar', { type: image.type }), { maxEdge: 720, maxBytes: 384 * 1024 })
    } catch { /* URL avatars remain visible when downloading the original is unavailable. */ }
  }
  const appearance = [anchor.appearance, anchor.hairColor, anchor.ageLabel || (anchor.age ? `${anchor.age}岁` : ''), anchor.species].filter(Boolean).join('，')
  if (!person) {
    person = await characterFromDraft(namespace, parseCharacterCard({
      name: anchor.realName || anchor.stageName,
      description: [`主播「${anchor.stageName}」。${anchor.background}`, appearance && `外貌形象：${appearance}`].filter(Boolean).join('\n'),
      personality: anchor.personality,
      scenario: `${playerName}在直播间认识了你，现在添加了短信好友，通过短信继续了解彼此。见面需要在对话中另行约定。`,
      system_prompt: anchor.chatStyle || anchor.speakingStyle || '',
      tags: ['直播间'],
      extensions: { liveAnchorId: anchor.id, livePortraitUrl: anchor.portraitUrl ?? '' },
    }), portrait, { skipChat: true, allowProactive: false })
  } else if (portrait && !person.avatar.startsWith('data:image/')) {
    person = { ...person, avatar: portrait, updatedAt: Date.now() }
    await storage.putCharacter(namespace, person)
  }
  const chat = await ensureDirectChat(namespace, person, { allowProactive: false })
  return { person, chat }
}
