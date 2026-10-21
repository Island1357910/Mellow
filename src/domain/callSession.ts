import { AIAdapter, AIError } from '../engine/AIAdapter.ts'
import { buildCallMessages, pickPreset } from '../engine/prompt.ts'
import { minimaxSpeak, normalizeMinimaxKey, resolveCharacterVoiceId } from '../engine/minimax.ts'
import { stripThinkingFromSms } from '../lib/smsSanitize.ts'
import { decryptSecret } from '../storage/crypto.ts'
import { storage } from '../storage/StorageService.ts'
import type { Character, Chat, ChatMessage, Identity, MinimaxSettings, Preset } from '../types/index.ts'

export type CallTurn = {
  role: 'user' | 'assistant'
  text: string
  charId?: string | null
  charName?: string
}

export type CallSession = {
  turns: CallTurn[]
  startedAt: number
}

const callLocks = new Set<string>()

export function createCallSession(): CallSession {
  return { turns: [], startedAt: Date.now() }
}

function clock(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export async function runCallTurn(input: {
  namespace: string
  identity: Identity
  character: Character
  chat: Chat
  presets: Preset[]
  activePresetId: string
  fourthWall: boolean
  session: CallSession
  userText: string
  smsHistory: ChatMessage[]
}): Promise<{ assistant: CallTurn | null; error?: string }> {
  const text = input.userText.trim()
  if (!text) return { assistant: null, error: '请输入内容' }
  if (callLocks.has(input.chat.id)) return { assistant: null, error: 'BUSY' }
  if (input.chat.blocked || input.character.blocked) {
    return { assistant: null, error: '已经拉黑，对方不会接。' }
  }

  const userTurn: CallTurn = { role: 'user', text }
  input.session.turns.push(userTurn)
  callLocks.add(input.chat.id)

  try {
    const preset = pickPreset(input.presets, input.activePresetId, input.character.presetId, input.chat.presetId)
    const built = buildCallMessages({
      character: input.character,
      identity: input.identity,
      preset,
      history: input.smsHistory,
      callTurns: input.session.turns.map((turn) => ({
        role: turn.role,
        text: turn.text,
        charName: turn.charName,
      })),
      fourthWall: input.fourthWall,
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
      maxTokens: 400,
    })
    const replyText = stripThinkingFromSms(response.content).trim() || '……'
    const assistant: CallTurn = {
      role: 'assistant',
      text: replyText,
      charId: input.character.id,
      charName: input.character.nickname || input.character.name,
    }
    input.session.turns.push(assistant)
    return { assistant }
  } catch (error) {
    input.session.turns.pop()
    const message =
      error instanceof AIError
        ? error.message
        : error instanceof Error && /timed out|timeout|signal/i.test(error.message)
          ? '等了太久，接口没有回来。'
          : error instanceof Error
            ? error.message
            : '没能接通'
    return { assistant: null, error: message }
  } finally {
    callLocks.delete(input.chat.id)
  }
}

export async function playCallVoice(input: {
  settings: MinimaxSettings
  character: Character
  text: string
}): Promise<string | null> {
  if (!input.settings.ready) return null
  const raw = input.settings.encryptedKey ? await decryptSecret(input.settings.encryptedKey) : ''
  const voice = resolveCharacterVoiceId(input.character, input.settings)
  return minimaxSpeak(input.settings, normalizeMinimaxKey(raw), input.text, voice)
}

async function summarizeCall(input: {
  identity: Identity
  character: Character
  turns: CallTurn[]
}): Promise<string> {
  if (input.turns.length === 0) return ''
  const lines = input.turns.map((turn) =>
    turn.role === 'user' ? `${input.identity.name}：${turn.text}` : `${turn.charName ?? input.character.name}：${turn.text}`,
  )
  try {
    const stored = await storage.readApi()
    const key = await storage.readApiKey()
    const adapter = await AIAdapter.fromStored(stored, key)
    const response = await adapter.complete({
      messages: [
        {
          role: 'system',
          content: '根据下面的电话记录，用一句不超过 18 个字的口语写通话摘要。不要引号，不要列表。',
        },
        { role: 'user', content: lines.join('\n') },
      ],
      temperature: 0.6,
      topP: 0.9,
      maxTokens: 60,
    })
    return stripThinkingFromSms(response.content).trim().slice(0, 24)
  } catch {
    const last = [...input.turns].reverse().find((turn) => turn.role === 'assistant')
    return last ? last.text.slice(0, 18) : `共 ${input.turns.length} 轮`
  }
}

export async function finishCallSession(input: {
  namespace: string
  chatId: string
  session: CallSession
  seconds: number
  group: boolean
  identity: Identity
  character: Character
  cancelled?: boolean
}): Promise<string> {
  const label = input.group ? '群语音通话' : '语音通话'
  if (input.cancelled || input.session.turns.length === 0) {
    return input.cancelled ? `${label} · 已取消` : `${label} · 通话时长 ${clock(input.seconds)}`
  }

  const summary = await summarizeCall({
    identity: input.identity,
    character: input.character,
    turns: input.session.turns,
  })
  const rounds = Math.ceil(input.session.turns.filter((turn) => turn.role === 'user').length)
  const bagId = `call_transcript_${input.chatId}_${input.session.startedAt}`
  await storage.setBag(input.namespace, bagId, {
    chatId: input.chatId,
    startedAt: input.session.startedAt,
    seconds: input.seconds,
    turns: input.session.turns,
    summary,
  })

  const parts = [`${label} · 通话时长 ${clock(input.seconds)}`]
  if (summary) parts.push(summary)
  if (rounds > 0) parts.push(`${rounds} 轮`)
  return parts.join('｜')
}
