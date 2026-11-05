import { focusChars, putSave, type StorySave } from '../engine/story.ts'
import { uid } from './id.ts'
import { isJiushiCharacter } from './jiushi.ts'
import { patchChatMemory, readChatMemory } from './chatMemory.ts'
import { activeOfflineSave, offlineFacts, smsFacts } from './channelBridge.ts'
import { storage } from '../storage/StorageService.ts'
import { useMellow } from '../store/useMellow.ts'
import type { Character } from '../types/index.ts'

const SMS_MARK = '【从短信手动同步】'
const OFFLINE_MARK = '【从线下手动同步】'

function modernCast(chars: Character[]): Character[] {
  return chars.filter((item) => !isJiushiCharacter(item))
}

async function writeSmsIntoOffline(namespace: string, chars: Character[], save: StorySave): Promise<boolean> {
  const facts = await smsFacts(namespace, chars)
  if (!facts) return false
  const text = `${SMS_MARK}\n${facts}`
  if (save.summaries.some((item) => item.text === text)) return false
  const summaries = save.summaries.filter((item) => !item.text.startsWith(SMS_MARK))
  await putSave(namespace, {
    ...save,
    summaries: [...summaries, { id: uid('sum'), kind: 'small', text, upTo: save.lines.length, createdAt: Date.now() }],
  })
  return true
}

async function writeOfflineIntoSms(namespace: string, save: StorySave, chars: Character[]): Promise<number> {
  const chats = await storage.listChats(namespace)
  let count = 0
  for (const character of chars) {
    const facts = offlineFacts(save, character)
    if (!facts.trim()) continue
    const chat = chats.find((item) => item.kind === 'dm' && item.memberIds.includes(character.id))
    if (!chat) continue
    const block = `${OFFLINE_MARK}\n${facts}`
    const memory = await readChatMemory(namespace, chat.id)
    const kept = memory.text.replace(new RegExp(`\\n*${OFFLINE_MARK}[\\s\\S]*$`), '').trim()
    const text = `${kept}\n\n${block}`.trim().slice(-6000)
    if (text === memory.text.trim()) continue
    await patchChatMemory(namespace, chat.id, { text })
    count += 1
  }
  return count
}

/** 把这些角色的私聊写进当前线下存档，并把他们亲历的线下写进各自的私聊长期记忆。 */
export async function syncCharacters(namespace: string, chars: Character[], save?: StorySave | null): Promise<string> {
  const people = modernCast(chars)
  if (people.length === 0) return '没有能对上的角色'
  const target = save ?? (await activeOfflineSave(namespace))
  if (!target) return '还没有线下存档，先在线下建一档'
  const intoOffline = await writeSmsIntoOffline(namespace, people, target)
  const intoSms = target.lines.length ? await writeOfflineIntoSms(namespace, target, people) : 0
  useMellow.getState().touchData()
  if (!intoOffline && intoSms === 0) return '已经互通过同样的内容，或两边还没有能对上的记录'
  const parts = []
  if (intoOffline) parts.push('短信已写进线下')
  if (intoSms) parts.push(`线下已写进 ${intoSms} 段私聊`)
  return parts.join('，')
}

export async function syncChatWithOffline(namespace: string, chatId: string): Promise<string> {
  const chat = await storage.getChat(namespace, chatId)
  if (!chat || chat.kind !== 'dm') return '只有私聊可以和线下互通'
  const chars = await storage.listModernCharacters(namespace)
  const character = chars.find((item) => chat.memberIds.includes(item.id))
  if (!character) return '没有找到这个角色'
  return syncCharacters(namespace, [character])
}

export async function syncOfflineWithSms(namespace: string, save: StorySave): Promise<string> {
  const chars = modernCast(await storage.listModernCharacters(namespace))
  const focus = focusChars(chars, save)
  if (focus.length === 0) return '这场线下还看不出在场的是谁'
  return syncCharacters(namespace, focus, save)
}
