import { moduleAdapter } from '../lib/ask.ts'
import { walletTask } from '../lib/wallet.ts'
import { sharedLifeNote, rememberGift, normalizeSharedLife, addKeepsake, SHARED_LIFE_KEY, type SharedLife } from '../lib/sharedLife.ts'
import { observeSharedLifeTurn } from '../lib/sharedLifeAi.ts'
import { runAiJob, jobKey } from '../engine/aiJobs.ts'
import { mapMemoryNote } from '../lib/mapMemory.ts'
import { togetherNoteFor } from '../lib/together.ts'
import { purchaseMemory } from '../lib/deliveryMemory.ts'
import { momentMemory } from '../lib/socialAi.ts'
import { AIError } from '../engine/AIAdapter.ts'
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
import { buildSmsReplySegments, isPageBanner, SMS_SPLIT, stripVoicePrefix } from '../lib/smsReply.ts'
import { stripThinkingFromSms } from '../lib/smsSanitize.ts'
import { deliverReplyParts } from './replyDelivery.ts'
import { storyBridgeForSms } from '../lib/channelBridge.ts'
import { smsSeenHistory } from '../engine/prompt.ts'
import { useMellow } from '../store/useMellow.ts'
import { chatMemoryNote, scheduleChatMemory } from '../lib/chatMemory.ts'
import { directivePrompt } from '../lib/directives.ts'
import { mergeThought, takeReasoning } from '../lib/reasoning.ts'
import { loadStickerLibrary, visibleStickers } from '../lib/stickerLibrary.ts'
import { maybeWriteStage } from '../lib/stage.ts'

const replyLocks = new Set<string>()
import { storage } from '../storage/StorageService.ts'
import type { Character, Chat, ChatMessage, Identity, Preset } from '../types/index.ts'

function textMessage(input: {
  chatId: string
  role: ChatMessage['role']
  kind?: ChatMessage['kind']
  content: string
  charId: string | null
  reasoning?: string
  roundId?: string
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
    ...(input.reasoning?.trim() ? { reasoning: input.reasoning.trim(), roundId: input.roundId } : {}),
  }
}

function replyThought(content: string, reasoning?: string): string {
  return mergeThought(reasoning, takeReasoning(content).reasoning)
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

export async function ensureDirectChat(
  namespace: string,
  character: Character,
  options?: { allowProactive?: boolean },
): Promise<Chat> {
  const chats = await storage.listChats(namespace)
  const existing = chats.find((chat) => chat.kind === 'dm' && chat.memberIds.length === 1 && chat.memberIds[0] === character.id)
  if (existing) {
    if (options?.allowProactive === false && existing.allowProactive !== false) {
      const patched = { ...existing, allowProactive: false, updatedAt: Date.now() }
      await storage.putChat(namespace, patched)
      return patched
    }
    return existing
  }
  const chat: Chat = {
    id: uid('chat'),
    kind: 'dm',
    title: character.name,
    memberIds: [character.id],
    lastMessage: '',
    lastMessageAt: Date.now(),
    unread: 0,
    presetId: null,
    allowProactive: options?.allowProactive === false ? false : undefined,
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
  if(userMessage.kind==='gift'){const parts=userMessage.content.replace(/^\[[^\]]+\]\s*/,'').split('｜');const name=parts[1]?.trim();if(name){const people=await storage.listModernCharacters(input.namespace);for(const id of input.chat.memberIds){const person=people.find(p=>p.id===id);if(person&&(input.chat.kind==='dm'||parts[2]?.includes('所有')||parts[2]?.includes('全体')||parts[2]?.includes(person.name)))await rememberGift(input.namespace,{id:userMessage.id+':'+id,charId:id,name})}}}
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

export async function postPaidGiftMessage(input: { namespace: string; identity: Identity; chat: Chat; text: string; cost: number; requestId: string }): Promise<void> {
  const people = await storage.listModernCharacters(input.namespace)
  const parts = input.text.replace(/^\[[^\]]+\]\s*/, '').split('｜')
  const name = parts[1]?.trim()
  if (!name) throw Error('请选择一份礼物')
  const recipients = input.chat.memberIds.filter(id => {
    const p = people.find(p => p.id === id)
    return p && !p.blocked && (input.chat.kind === 'dm' || /全体|所有/.test(parts[2] ?? '') || parts[2]?.includes(p.nickname || p.name))
  })
  if (!recipients.length) throw Error('没有可以接收礼物的人')
  const message = { ...textMessage({ chatId: input.chat.id, role: 'user', kind: 'gift', content: input.text.trim(), charId: null }), id: input.requestId }
  await walletTask(input.namespace,()=>storage.commitPaidChatMessage(input.namespace, input.chat.id, message, input.cost, SHARED_LIFE_KEY, saved => {
    let s = normalizeSharedLife(saved as SharedLife | null)
    for (const charId of recipients) {
      const id = message.id + ':' + charId
      s = addKeepsake({ ...s, gifts: [{ id, charId, name, from: 'player', at: message.createdAt, status: 'received', uses: [] }, ...s.gifts] }, { charId, title: name, text: `你送给 TA 的${name}。`, at: message.createdAt, kind: 'gift', source: id })
    }
    return s
  }))
  eventBus.emit({ type: 'send_message', app: 'messages', identityId: input.identity.id, meta: { chatId: input.chat.id } })
  useMellow.getState().touchData()
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
      ? `像真人发短信一样，把这次回复拆成 ${min === max ? max : `${min} 到 ${max}`} 条消息。每条之间单独占一行，这一行只能是 ${SMS_SPLIT}。不要少写后面的尖括号，不要把 <<<分 留在短信正文里，不要编号，也不要写 ===== Page 1 =====。每条只说一个意思。`
      : '这次只发一条消息。',
  )
  if (chat.backstory?.trim()) bits.push(`${chat.kind === 'group' ? '群内公开背景（不视为每位成员都亲历）' : '你和对方的过往与关系（对方补充的，当作你们共同的记忆）'}：\n${chat.backstory.trim()}`)
  if (chat.kind === 'group') bits.push('这是群聊。只写你自己的话，不要替其他成员发言。')
  bits.push(PROFILE_RULE)
  return bits.join('\n')
}

const PROFILE_RULE = `你的头像、个性签名、昵称由你自己做主。只有你真心想改时，才在回复里单独写一行指令（对方看不到指令本身）：
玩家发来的图片按先后编号，图1最早，数字最大的是刚发的那张。玩家说「这张」「刚发的」，就用数字最大的编号；玩家点明第几张，就用那个编号。
【换头像：图N】——N 必须是你真正想用的那一张。有多张图时不能不写编号，也不能猜另一张。只有一张图时可以只写【换头像】。
【改签名：新的签名】；
【改昵称：新的昵称】。
不想改就不用写，也可以拒绝对方。`

interface ProfileChange {
  avatar: boolean
  avatarIndex?: number
  signature?: string
  nickname?: string
}

function takeProfileChange(content: string): { text: string; change: ProfileChange } {
  const change: ProfileChange = { avatar: false }
  let text = content.replace(/【换头像(?:\s*[:：]\s*图?\s*(\d+))?】/g, (_, raw: string | undefined) => {
    change.avatar = true
    if (raw) change.avatarIndex = Number(raw)
    return ''
  })
  text = text.replace(/【改签名[:：]\s*([^】]*)】/g, (_, value: string) => {
    const next = value.trim().slice(0, 60)
    if (!isPageBanner(next)) change.signature = next
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
  let changed = false
  if (change.avatar) {
    const images = smsSeenHistory(history).filter((item) => item.role === 'user' && item.kind === 'image' && item.content.startsWith('data:'))
    const image = change.avatarIndex ? images[change.avatarIndex - 1] : images.length === 1 ? images[0] : undefined
    if (image) {
      next.avatar = image.content
      changed = true
      notes.push(`${shown} 换上了你发来的${change.avatarIndex ? `图${change.avatarIndex}` : '头像'}`)
    } else if (change.avatarIndex) {
      notes.push(`${shown} 想换头像，但没有图${change.avatarIndex}，所以没换`)
    } else if (images.length > 1) {
      notes.push(`${shown} 愿意换头像，但这会儿有 ${images.length} 张图，没有写明用哪一张，所以没换`)
    } else {
      notes.push(`${shown} 想换头像，但这会儿没有能用的图片`)
    }
  }
  if (change.signature !== undefined && change.signature !== character.signature) {
    next.signature = change.signature
    changed = true
    notes.push(change.signature ? `${shown} 把签名改成了「${change.signature}」` : `${shown} 清空了签名`)
  }
  if (change.nickname && change.nickname !== shown) {
    next.nickname = change.nickname
    changed = true
    notes.push(`${shown} 把昵称改成了「${change.nickname}」`)
    for (const chat of await storage.listChats(namespace)) {
      if (chat.kind === 'dm' && chat.memberIds[0] === character.id) await storage.putChat(namespace, { ...chat, title: change.nickname })
    }
  }
  if (notes.length === 0) return notes
  if (changed) await storage.putCharacter(namespace, next)
  for (const [index, note] of notes.entries()) {
    await storage.putMessage(namespace, { ...textMessage({ chatId, role: 'system', kind: 'system', content: note, charId: character.id }), createdAt: Date.now() + 20 + index })
  }
  return notes
}


export function replyRange(chat: Chat): { min: number; max: number } {
  const clean = (value: number | undefined, fallback: number) => (value && value >= 1 && value <= 10 ? Math.round(value) : fallback)
  const min = clean(chat.replyMin, 1)
  const max = Math.max(min, clean(chat.replyMax, 3))
  return { min, max }
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
    const storyBridge = input.chat.kind === 'group' ? '' : await storyBridgeForSms(input.namespace, input.character)
    const sharedContent = await togetherNoteFor(input.namespace, input.character.id)
    const stickers = visibleStickers(await loadStickerLibrary())
    const writing = await directivePrompt(input.namespace, [input.character.id])
    const built = buildSmsMessages({
      character: input.character,
      identity: input.identity,
      preset,
      history,
      groupMembers: input.chat.kind === 'group' ? (await storage.listModernCharacters(input.namespace)).filter(person => input.chat.memberIds.includes(person.id)).map(person => ({ id: person.id, name: person.nickname || person.name })) : undefined,
      fourthWall: input.fourthWall,
      priority: storyBridge,
      proactive: input.proactive,
      triggerNote: input.triggerNote,
      stickers,
      directives: writing.text,
      cot: writing.cot,
      note: [
        replyNote(input.chat),
        await chatMemoryNote(input.namespace, input.chat.id),
        await momentMemory(input.namespace, [input.character]),
        input.chat.kind === 'dm' ? await purchaseMemory(input.namespace, [input.character.id]) : '',
        sharedContent,
        await mapMemoryNote(input.namespace,input.character.id),
        await sharedLifeNote(input.namespace,input.character.id),
        input.triggerNote ?? '',
        input.proactive && !input.triggerNote ? '玩家有一会儿没回了，可以自然地主动发一条，不要提时间或「怎么不回」。' : '',
        input.triggerNote ? '' : glance,
        explain,
        life,
        world,
      ].filter(Boolean).join('\n'),
    })
    const adapter = await moduleAdapter('messages')
    const range = replyRange(input.chat)
    const { max } = range
    const response = await adapter.complete({
      messages: built.messages,
      temperature: built.temperature,
      topP: built.topP,
      frequencyPenalty: built.frequencyPenalty,
      presencePenalty: built.presencePenalty,
      maxTokens: Math.min(1600, 220 * max),
    })
    const { text, change } = takeProfileChange(stripThinkingFromSms(response.content))
    const thought = replyThought(response.content, response.reasoning)
    const roundId = uid('round')
    const parts = buildSmsReplySegments(text || '……', range, stickers)
    const replies = await deliverReplyParts({
      namespace: input.namespace,
      identity: input.identity,
      character: input.character,
      chat: input.chat,
      parts,
      voiceReady: Boolean(input.voiceReady),
      history: all,
      proactive: Boolean(input.proactive),
      makeMessage: (part, kind) =>
        textMessage({ chatId: input.chat.id, role: 'assistant', kind, content: part, charId: input.character.id, reasoning: thought, roundId }),
    })
    const last = replies[replies.length - 1] ?? textMessage({ chatId: input.chat.id, role: 'assistant', content: text, charId: input.character.id })
    await applyProfileChange(input.namespace, input.character, input.chat.id, all, change)
    if (replies.length) scheduleChatMemory(input.namespace, input.chat.id)
    if (input.chat.kind === 'dm') void maybeEnrichNearby(input.namespace, input.character, [...all, ...replies])
    if(!input.proactive&&input.chat.kind==='dm')runAiJob(jobKey(input.namespace,'shared-life-observe',last.id),async()=>{try{await observeSharedLifeTurn(input.namespace,input.character,[...all,...replies],last.id)}catch{/* 后台观察失败不影响已经送达的短信 */}})
    if (!input.proactive && input.chat.kind === 'dm' && replies.length) {
      const playerLine = [...history].reverse().find((item) => item.role === 'user')?.content ?? ''
      maybeWriteStage({ namespace: input.namespace, character: input.character, playerLine, reply: text })
    }
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
    const system = { ...textMessage({
      chatId: input.chat.id,
      role: 'system',
      kind: 'system',
      content: message,
      charId: null,
    }), diagnostic: error instanceof AIError ? error.diagnostic : undefined }
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
  if(userMessage.kind==='gift'){const parts=userMessage.content.replace(/^\[[^\]]+\]\s*/,'').split('｜');const name=parts[1]?.trim();if(name){const people=await storage.listModernCharacters(input.namespace);for(const id of input.chat.memberIds){const person=people.find(p=>p.id===id);if(person&&(input.chat.kind==='dm'||parts[2]?.includes('所有')||parts[2]?.includes('全体')||parts[2]?.includes(person.name)))await rememberGift(input.namespace,{id:userMessage.id+':'+id,charId:id,name})}}}
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
    const storyBridge = input.chat.kind === 'group' ? '' : await storyBridgeForSms(input.namespace, input.character)
    const stickers = visibleStickers(await loadStickerLibrary())
    const writing = await directivePrompt(input.namespace, [input.character.id])
    const built = buildSmsMessages({
      character: input.character,
      identity: input.identity,
      preset,
      history,
      groupMembers: input.chat.kind === 'group' ? (await storage.listModernCharacters(input.namespace)).filter(person => input.chat.memberIds.includes(person.id)).map(person => ({ id: person.id, name: person.nickname || person.name })) : undefined,
      fourthWall: input.fourthWall,
      priority: storyBridge,
      stickers,
      directives: writing.text,
      cot: writing.cot,
      note: [
        replyNote(input.chat),
        await chatMemoryNote(input.namespace, input.chat.id),
        await momentMemory(input.namespace, [input.character]),
        input.chat.kind === 'dm' ? await purchaseMemory(input.namespace, [input.character.id]) : '',
        await sharedLifeNote(input.namespace, input.character.id),
        await mapMemoryNote(input.namespace, input.character.id),
        glance, explain, life,
        await togetherNoteFor(input.namespace, input.character.id),
      ].filter(Boolean).join('\n'),
    })
    const adapter = await moduleAdapter('messages')
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
      content: stripVoicePrefix(stripThinkingFromSms(response.content)) || '……',
      charId: input.character.id,
      reasoning: replyThought(response.content, response.reasoning),
      roundId: uid('round'),
    })
    await storage.putMessage(input.namespace, reply)
    await touchChat(input.namespace, chat, reply.content, 1, reply.kind)
    scheduleChatMemory(input.namespace, chat.id)
    if (input.chat.kind === 'dm') void maybeEnrichNearby(input.namespace, input.character, [...history, userMessage, reply])
    return reply
  } catch (error) {
    const message = error instanceof AIError ? error.message : error instanceof Error ? error.message : '没能发出去'
    const system = { ...textMessage({
      chatId: input.chat.id,
      role: 'system',
      kind: 'system',
      content: message,
      charId: null,
    }), diagnostic: error instanceof AIError ? error.diagnostic : undefined }
    await storage.putMessage(input.namespace, system)
    await touchChat(input.namespace, chat, input.text.trim(), 0)
    return system
  }
}
