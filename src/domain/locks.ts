import { ensureDirectChat } from './messaging.ts'
import { uid } from '../lib/id.ts'
import { storage } from '../storage/StorageService.ts'
import type { ChatMessage } from '../types/index.ts'

/** 角色问起某个上锁应用。不包含密码本身，同一天只问一次。 */
export async function maybeAskAboutLock(namespace: string, appName: string): Promise<void> {
  const day = new Date().toISOString().slice(0, 10)
  const asked = await storage.getBag<string>(namespace, 'lock-ask-day')
  if (asked === day) return
  const chars = await storage.listCharacters(namespace)
  const character = chars.find((item) => !item.blocked)
  if (!character) return
  const chat = await ensureDirectChat(namespace, character)
  const message: ChatMessage = {
    id: uid('msg'),
    chatId: chat.id,
    role: 'assistant',
    kind: 'text',
    content: `${appName}锁着。密码我不会替你说，你自己记得就行。`,
    charId: character.id,
    createdAt: Date.now(),
    status: 'sent',
  }
  await storage.putMessage(namespace, message)
  await storage.putChat(namespace, {
    ...chat,
    lastMessage: message.content,
    lastMessageAt: message.createdAt,
    unread: chat.unread + 1,
    updatedAt: message.createdAt,
  })
  await storage.setBag(namespace, 'lock-ask-day', day)
}
