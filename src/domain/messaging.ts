import { AIAdapter, AIError } from '../engine/AIAdapter.ts'
import { eventBus } from '../engine/EventBus.ts'
import { searchNoteFor } from './glance.ts'
import { glanceExplainNote, userAskedHowYouKnow } from '../lib/glanceExplain.ts'
import { maybeEnrichNearby } from '../lib/nearbyEnrich.ts'
import { nearbyLifeNote } from '../lib/nearbyContact.ts'
import { buildSmsMessages, pickPreset } from '../engine/prompt.ts'
import { noteRemoteChat } from '../engine/space.ts'
import { uid } from '../lib/id.ts'
import { messagePreview } from '../lib/messagePreview.ts'
import { enabledWorldText } from '../lib/worldbook.ts'
import { capReplySegments, expandReplyParts } from '../lib/stickerReply.ts'
import { stripThinkingFromSms } from '../lib/smsSanitize.ts'
import { deliverReplyParts } from './replyDelivery.ts'
import { storyBridgeForSms } from '../lib/channelBridge.ts'
import { useMellow } from '../store/useMellow.ts'

const replyLocks = new Set<string>()
import { storage } from '../storage/StorageService.ts'
import type { Character, Chat, ChatMessage, Identity, Preset } from '../types/index.ts'

function textMessage(input: {
  chatId: string
  role: ChatMessage['role']
  kind?: ChatMessage['kind']
  content: string
  charId: string | null
}): ChatMessage {
  return {
    id: uid('msg'),
    chatId: input.chatId,
    role: input.role,
    kind: input.kind ?? 'text',
    content: input.content,
    charId: input.charId,
    createdAt: Date.now(),
    status: 'sent',
  }
}

async function touchChat(namespace: string, stale: Chat, lastMessage: string, unreadDelta: number, lastKind: ChatMessage['kind'] = 'text'): Promise<Chat> {
  const preview = messagePreview(lastMessage, lastKind)
  const chat = (await storage.getChat(namespace, stale.id)) ?? stale
  const viewing = useMellow.getState().viewingChatId === stale.id
  const next: Chat = {
    ...chat,
    lastMessage: preview,
    lastMessageAt: Date.now(),
    updatedAt: Date.now(),
    unread: viewing ? 0 : Math.max(0, chat.unread + unreadDelta),
  }
  await storage.putChat(namespace, next)
  if (viewing && unreadDelta > 0) await storage.markChatRead(namespace, stale.id)
  return next
}

export async function ensureDirectChat(namespace: string, character: Character): Promise<Chat> {
  const chats = await storage.listChats(namespace)
  const existing = chats.find((chat) => chat.kind === 'dm' && chat.memberIds.length === 1 && chat.memberIds[0] === character.id)
  if (existing) return existing
  const chat: Chat = {
    id: uid('chat'),
    kind: 'dm',
    title: character.name,
    memberIds: [character.id],
    lastMessage: '',
    lastMessageAt: Date.now(),
    unread: 0,
    presetId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  await storage.putChat(namespace, chat)
  if (character.firstMes.trim()) {
    const greeting = textMessage({
      chatId: chat.id,
      role: 'assistant',
      content: character.firstMes.trim(),
      charId: character.id,
    })
    await storage.putMessage(namespace, greeting)
    return touchChat(namespace, chat, greeting.content, 1, greeting.kind)
  }
  return chat
}

export async function postUserText(input: {
  namespace: string
  identity: Identity
  chat: Chat
  text: string
  kind?: ChatMessage['kind']
  quoteOf?: string | null
  quoteText?: string | null
}): Promise<ChatMessage> {
  const userMessage: ChatMessage = {
    ...textMessage({
      chatId: input.chat.id,
      role: 'user',
      kind: input.kind ?? 'text',
      content: input.text.trim(),
      charId: null,
    }),
    quoteOf: input.quoteOf ?? null,
    quoteText: input.quoteText ?? null,
  }
  await storage.putMessage(input.namespace, userMessage)
  await touchChat(input.namespace, input.chat, userMessage.content, 0, userMessage.kind)
  const fresh = await storage.getChat(input.namespace, input.chat.id)
  if (fresh?.proactiveLastAt) await storage.putChat(input.namespace, { ...fresh, proactiveLastAt: undefined })
  if (input.chat.memberIds[0]) await noteRemoteChat(input.namespace, input.chat.memberIds[0], true)
  eventBus.emit({
    type: 'send_message',
    app: 'messages',
    identityId: input.identity.id,
    meta: { chatId: input.chat.id },
  })
  return userMessage
}

export async function createGroupChat(namespace: string, title: string, memberIds: string[], ownerId: string): Promise<Chat> {
  const chat: Chat = {
    id: uid('chat'),
    kind: 'group',
    title: title.trim() || '群聊',
    memberIds,
    lastMessage: '',
    lastMessageAt: Date.now(),
    unread: 0,
    presetId: null,
    ownerId,
    adminIds: [],
    titles: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  await storage.putChat(namespace, chat)
  return chat
}

function replyNote(chat: Chat): string {
  const bits: string[] = []
  if (chat.realTime !== false) {
    bits.push(`现在的现实时间是 ${new Date().toLocaleString('zh-CN', { hour12: false })}。可以自然地感知早晚，但不要每句都报时。`)
  }
  const { min, max } = replyRange(chat)
  bits.push(
    max > 1
      ? `像真人发短信一样，把这次回复拆成 ${min === max ? max : `${min} 到 ${max}`} 条消息。每条之间单独一行写 ${SPLIT}，不要编号。`
      : '这次只发一条消息。',
  )
  if (chat.backstory?.trim()) bits.push(`你和对方的过往与关系（对方补充的，当作你们共同的记忆）：\n${chat.backstory.trim()}`)
  if (chat.kind === 'group') bits.push('这是群聊。只写你自己的话，不要替其他成员发言。')
  bits.push(PROFILE_RULE)
  return bits.join('\n')
}

const PROFILE_RULE = `你的头像、个性签名、昵称由你自己做主。只有你真心想改时，才在回复里单独写一行指令（对方看不到指令本身）：
【换头像】——换成对方在聊天里最近发来的那张图片，比如对方提议用情侣头像并发了图，而你愿意；
【改签名：新的签名】；
【改昵称：新的昵称】。
不想改就不用写，也可以拒绝对方。`

interface ProfileChange {
  avatar: boolean
  signature?: string
  nickname?: string
}

function takeProfileChange(content: string): { text: string; change: ProfileChange } {
  const change: ProfileChange = { avatar: false }
  let text = content.replace(/【换头像】/g, () => {
    change.avatar = true
    return ''
  })
  text = text.replace(/【改签名[:：]\s*([^】]*)】/g, (_, value: string) => {
    change.signature = value.trim().slice(0, 60)
    return ''
  })
  text = text.replace(/【改昵称[:：]\s*([^】]*)】/g, (_, value: string) => {
    change.nickname = value.trim().slice(0, 20)
    return ''
  })
  return { text: text.replace(/\n{3,}/g, '\n\n').trim(), change }
}

async function applyProfileChange(namespace: string, character: Character, chatId: string, history: ChatMessage[], change: ProfileChange): Promise<string[]> {
  const notes: string[] = []
  const next: Character = { ...character, updatedAt: Date.now() }
  const shown = character.nickname || character.name
  if (change.avatar) {
    const image = [...history].reverse().find((item) => item.role === 'user' && item.kind === 'image' && item.content.startsWith('data:'))
    if (image) {
      next.avatar = image.content
      notes.push(`${shown} 换上了你发来的头像`)
    }
  }
  if (change.signature !== undefined && change.signature !== character.signature) {
    next.signature = change.signature
    notes.push(change.signature ? `${shown} 把签名改成了「${change.signature}」` : `${shown} 清空了签名`)
  }
  if (change.nickname && change.nickname !== shown) {
    next.nickname = change.nickname
    notes.push(`${shown} 把昵称改成了「${change.nickname}」`)
    for (const chat of await storage.listChats(namespace)) {
      if (chat.kind === 'dm' && chat.memberIds[0] === character.id) await storage.putChat(namespace, { ...chat, title: change.nickname })
    }
  }
  if (notes.length === 0) return notes
  await storage.putCharacter(namespace, next)
  for (const [index, note] of notes.entries()) {
    await storage.putMessage(namespace, { ...textMessage({ chatId, role: 'system', kind: 'system', content: note, charId: character.id }), createdAt: Date.now() + 20 + index })
  }
  return notes
}

const SPLIT = '<<<分>>>'

export function replyRange(chat: Chat): { min: number; max: number } {
  const clean = (value: number | undefined, fallback: number) => (value && value >= 1 && value <= 10 ? Math.round(value) : fallback)
  const min = clean(chat.replyMin, 1)
  const max = Math.max(min, clean(chat.replyMax, 3))
  return { min, max }
}

function splitReply(content: string, max: number): string[] {
  const parts = content
    .split(SPLIT)
    .flatMap((part) => part.split(/\n\s*-{3,}\s*\n/))
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length <= max) return parts.length ? parts : [content.trim()]
  return [...parts.slice(0, max - 1), parts.slice(max - 1).join('\n')]
}

export async function replyInChat(input: {
  namespace: string
  identity: Identity
  character: Character
  chat: Chat
  presets: Preset[]
  activePresetId: string
  fourthWall: boolean
  voiceReady?: boolean
  proactive?: boolean
  triggerNote?: string
}): Promise<ChatMessage> {
  if (replyLocks.has(input.chat.id)) {
    throw new AIError('BUSY', 'api')
  }
  if (input.chat.blocked || input.character.blocked) {
    const system = textMessage({
      chatId: input.chat.id,
      role: 'system',
      kind: 'system',
      content: '已经拉黑，对方不会回。',
      charId: null,
    })
    await storage.putMessage(input.namespace, system)
    return system
  }
  replyLocks.add(input.chat.id)
  try {
    const all = await storage.listMessages(input.namespace, input.chat.id)
    const history = all.filter((item) => item.kind !== 'system').slice(-(input.chat.contextLimit ?? 30))
    const preset = pickPreset(input.presets, input.activePresetId, input.character.presetId, input.chat.presetId)
    const glance = await searchNoteFor(input.namespace, input.character.id)
    const explain =
      userAskedHowYouKnow(history) ? await glanceExplainNote(input.namespace, input.character.id) : ''
    const life = await nearbyLifeNote(input.namespace, input.character)
    const world = await enabledWorldText(input.namespace, input.character.id, input.chat.smsWorldOff ?? [])
    const storyBridge = await storyBridgeForSms(input.namespace, input.character)
    const built = buildSmsMessages({
      character: input.character,
      identity: input.identity,
      preset,
      history,
      fourthWall: input.fourthWall,
      note: [
        replyNote(input.chat),
        input.triggerNote ?? '',
        input.proactive && !input.triggerNote ? '玩家有一会儿没回了，可以自然地主动发一条，不要提时间或「怎么不回」。' : '',
        storyBridge,
        input.triggerNote ? '' : glance,
        explain,
        life,
        world,
      ].filter(Boolean).join('\n'),
    })
    const stored = await storage.readApi()
    const key = await storage.readApiKey()
    const adapter = await AIAdapter.fromStored(stored, key)
    const { max } = replyRange(input.chat)
    const response = await adapter.complete({
      messages: built.messages,
      temperature: built.temperature,
      topP: built.topP,
      frequencyPenalty: built.frequencyPenalty,
      presencePenalty: built.presencePenalty,
      maxTokens: Math.min(1600, 220 * max),
    })
    const { text, change } = takeProfileChange(stripThinkingFromSms(response.content))
    const parts = capReplySegments(expandReplyParts(splitReply(text || '……', max)), max)
    const replies = await deliverReplyParts({
      namespace: input.namespace,
      identity: input.identity,
      character: input.character,
      chat: input.chat,
      parts,
      voiceReady: Boolean(input.voiceReady),
      history: all,
      makeMessage: (part, kind) =>
        textMessage({ chatId: input.chat.id, role: 'assistant', kind, content: part, charId: input.character.id }),
    })
    const last = replies[replies.length - 1] ?? textMessage({ chatId: input.chat.id, role: 'assistant', content: text, charId: input.character.id })
    await applyProfileChange(input.namespace, input.character, input.chat.id, all, change)
    void maybeEnrichNearby(input.namespace, input.character, [...all, ...replies])
    return last
  } catch (error) {
    const message =
      error instanceof AIError
        ? error.message
        : error instanceof Error && /timed out|timeout|signal/i.test(error.message)
          ? '等了太久，接口没有回来。'
          : error instanceof Error
            ? error.message
            : '没能发出去'
    const system = textMessage({
      chatId: input.chat.id,
      role: 'system',
      kind: 'system',
      content: message,
      charId: null,
    })
    await storage.putMessage(input.namespace, system)
    return system
  } finally {
    replyLocks.delete(input.chat.id)
  }
}

export async function deliverSms(input: {
  namespace: string
  identity: Identity
  character: Character
  chat: Chat
  text: string
  presets: Preset[]
  activePresetId: string
  fourthWall: boolean
}): Promise<ChatMessage> {
  const userMessage = textMessage({
    chatId: input.chat.id,
    role: 'user',
    content: input.text.trim(),
    charId: null,
  })
  await storage.putMessage(input.namespace, userMessage)
  let chat = await touchChat(input.namespace, input.chat, userMessage.content, 0, userMessage.kind)
  await noteRemoteChat(input.namespace, input.character.id, true)
  eventBus.emit({
    type: 'send_message',
    app: 'messages',
    identityId: input.identity.id,
    meta: { charId: input.character.id, chatId: input.chat.id },
  })

  try {
    const history = await storage.listMessages(input.namespace, input.chat.id)
    const preset = pickPreset(input.presets, input.activePresetId, input.character.presetId, input.chat.presetId)
    const glance = await searchNoteFor(input.namespace, input.character.id)
    const explain =
      userAskedHowYouKnow(history) ? await glanceExplainNote(input.namespace, input.character.id) : ''
    const life = await nearbyLifeNote(input.namespace, input.character)
    const built = buildSmsMessages({
      character: input.character,
      identity: input.identity,
      preset,
      history,
      fourthWall: input.fourthWall,
      note: [glance, explain, life].filter(Boolean).join('\n'),
    })
    const stored = await storage.readApi()
    const key = await storage.readApiKey()
    const adapter = await AIAdapter.fromStored(stored, key)
    const response = await adapter.complete({
      messages: built.messages,
      temperature: built.temperature,
      topP: built.topP,
      frequencyPenalty: built.frequencyPenalty,
      presencePenalty: built.presencePenalty,
      maxTokens: 800,
    })
    const reply = textMessage({
      chatId: input.chat.id,
      role: 'assistant',
      content: stripThinkingFromSms(response.content) || '……',
      charId: input.character.id,
    })
    await storage.putMessage(input.namespace, reply)
    await touchChat(input.namespace, chat, reply.content, 1, reply.kind)
    void maybeEnrichNearby(input.namespace, input.character, [...history, userMessage, reply])
    return reply
  } catch (error) {
    const message = error instanceof AIError ? error.message : error instanceof Error ? error.message : '没能发出去'
    const system = textMessage({
      chatId: input.chat.id,
      role: 'system',
      kind: 'system',
      content: message,
      charId: null,
    })
    await storage.putMessage(input.namespace, system)
    await touchChat(input.namespace, chat, input.text.trim(), 0)
    return system
  }
}
