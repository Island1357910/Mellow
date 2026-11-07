import { eventBus } from '../engine/EventBus.ts'
import { messagePreview } from '../lib/messagePreview.ts'
import { storage } from '../storage/StorageService.ts'
import { useMellow } from '../store/useMellow.ts'
import type { Character, Chat, ChatMessage, Identity } from '../types/index.ts'
import { phoneIsAway, showPhoneMessage } from '../lib/phoneNotify.ts'
import { shouldReplyAsVoice } from './voiceReply.ts'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function staggerDelay(index: number): number {
  if (index <= 0) return 0
  return 520 + Math.floor(Math.random() * 1100) + index * 80
}

function isViewingChat(chatId: string): boolean {
  const state=useMellow.getState()
  return state.activeApp === 'messages' && !state.locked && state.viewingChatId === chatId
}

async function touchDelivered(
  namespace: string,
  stale: Chat,
  message: ChatMessage,
  unreadDelta: number,
): Promise<Chat> {
  const chat = (await storage.getChat(namespace, stale.id)) ?? stale
  const viewing = isViewingChat(stale.id)
  const next: Chat = {
    ...chat,
    lastMessage: messagePreview(message.content, message.kind),
    lastMessageAt: message.createdAt,
    updatedAt: Date.now(),
    unread: viewing ? 0 : Math.max(0, chat.unread + unreadDelta),
  }
  await storage.putChat(namespace, next)
  if (viewing) await storage.markChatRead(namespace, stale.id)
  return next
}

async function maybeNotify(input: {
  identity: Identity
  chat: Chat
  character: Character
  message: ChatMessage
  popup: boolean
}): Promise<void> {
  const away = phoneIsAway()
  const onThisChat = !away && isViewingChat(input.chat.id)
  if (input.chat.muted || onThisChat) return
  const body = messagePreview(input.message.content, input.message.kind)
  await useMellow.getState().pushNotice({
    kind: 'message',
    title: input.character.name,
    body,
    appId: 'messages',
    identityId: input.identity.id,
    chatId: input.chat.id,
    charId: input.character.id,
    priority: input.chat.specialCare ? 5 : 4,
  })
  if (input.popup) void showPhoneMessage(input.character.name, body)
}

export async function deliverReplyParts(input: {
  namespace: string
  identity: Identity
  character: Character
  chat: Chat
  parts: Array<{ kind: 'text' | 'sticker'; content: string }>
  voiceReady: boolean
  history: ChatMessage[]
  proactive?: boolean
  makeMessage: (part: string, kind: ChatMessage['kind'], index: number) => ChatMessage
}): Promise<ChatMessage[]> {
  const replies: ChatMessage[] = []
  let chat = input.chat

  for (const [index, part] of input.parts.entries()) {
    if (index > 0) await sleep(staggerDelay(index))
    const kind = part.kind === 'sticker'
      ? 'sticker'
      : shouldReplyAsVoice({
          chat,
          voiceReady: input.voiceReady,
          history: [...input.history, ...replies],
          partIndex: index,
          partCount: input.parts.length,
          content: part.content,
        })
        ? 'voice'
        : 'text'
    const reply = {
      ...input.makeMessage(part.content, kind, index),
      createdAt: Date.now() + index * 3,
    }
    await storage.putMessage(input.namespace, reply)
    replies.push(reply)
    chat = await touchDelivered(input.namespace, chat, reply, 1)
    useMellow.getState().touchData()
    eventBus.emit({
      type: 'send_message',
      app: 'messages',
      identityId: input.identity.id,
      meta: { chatId: input.chat.id, charId: input.character.id, messageId: reply.id },
    })
    if (reply.role === 'assistant') {
      await maybeNotify({
        identity: input.identity,
        chat,
        character: input.character,
        message: reply,
        popup: index === 0 && (Boolean(input.proactive) || phoneIsAway()),
      })
    }
  }

  void useMellow.getState().refreshInbox()
  return replies
}
