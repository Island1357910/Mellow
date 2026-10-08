import { replyInChat } from '../domain/messaging.ts'
import { isAiJobRunning, jobKey, runAiJob } from '../engine/aiJobs.ts'
import { isTrustedVoiceCache } from '../engine/minimax.ts'
import { askLine, readJson } from './ask.ts'
import { modePresetId } from './defaults.ts'
import { getNearbyMeta, isNearbyCharacter, refreshNearbyLife } from './nearbyContact.ts'
import { storage, defaultCharState } from '../storage/StorageService.ts'
import { useMellow } from '../store/useMellow.ts'
import type { AppSettings, Character, Identity, Preset } from '../types/index.ts'

async function aiRefreshLife(namespace: string, character: Character): Promise<void> {
  const meta = getNearbyMeta(character)
  const state = (await storage.getCharState(namespace, character.id)) ?? defaultCharState(character.id)
  try {
    const raw = await askLine(
      `为${character.name}写此刻的生活状态。像真人，15字内。只返回 JSON：{"mood":"","location":"","activity":""}`,
      `性格：${character.personality.slice(0, 80)}\n城市：${meta?.city || '附近'}`,
      120,
    )
    const parsed = readJson(raw) as { mood?: unknown; location?: unknown; activity?: unknown }
    const next = { ...state, updatedAt: Date.now() }
    if (typeof parsed.mood === 'string' && parsed.mood.trim()) next.mood = parsed.mood.trim().slice(0, 12)
    if (typeof parsed.location === 'string' && parsed.location.trim()) next.location = parsed.location.trim().slice(0, 24)
    const act = typeof parsed.activity === 'string' && parsed.activity.trim() ? parsed.activity.trim().slice(0, 40) : meta?.lifeNote
    if (meta && act) {
      const fresh = (await storage.getCharacter(namespace, character.id)) ?? character
      await storage.putCharacter(namespace, {
        ...fresh,
        extensions: { ...fresh.extensions, nearby: { ...meta, lifeNote: act } },
        updatedAt: Date.now(),
      })
    }
    await storage.saveCharState(namespace, next)
  } catch {
    await refreshNearbyLife(namespace, character)
  }
}

export async function tickNearbyLife(input: {
  namespace: string
  identity: Identity
  settings: AppSettings
  presets: Preset[]
}): Promise<void> {
  const chars = (await storage.listCharacters(input.namespace)).filter(isNearbyCharacter)
  if (chars.length === 0) return

  for (const character of chars) {
    const state = (await storage.getCharState(input.namespace, character.id)) ?? defaultCharState(character.id)
    if (Date.now() - state.updatedAt < 20 * 60_000) continue

    const key = jobKey(input.namespace, 'nearby-life', character.id)
    if (isAiJobRunning(key)) continue

    runAiJob(key, async () => {
      await aiRefreshLife(input.namespace, character)

      const meta = getNearbyMeta(character)
      if (!meta) return
      const lastPing = meta.lastLifePingAt ?? 0
      if (Date.now() - lastPing < 2 * 60 * 60_000) return
      if (Math.random() > 0.12) return

      const chat = (await storage.listChats(input.namespace)).find(
        (item) => item.kind === 'dm' && item.memberIds[0] === character.id,
      )
      if (!chat || chat.blocked || chat.allowProactive === false) return

      const messages = await storage.listMessages(input.namespace, chat.id)
      const talked = messages.filter((item) => item.role === 'user' && item.kind !== 'system').length
      if (talked < 2) return

      const lastUser = [...messages].reverse().find((item) => item.role === 'user')
      if (lastUser && Date.now() - lastUser.createdAt < 45 * 60_000) return
      if (useMellow.getState().pendingReplyChatId) return

      const life = (await storage.getCharState(input.namespace, character.id)) ?? state
      const freshChar = (await storage.getCharacter(input.namespace, character.id)) ?? character
      const doing = getNearbyMeta(freshChar)?.lifeNote || '忙自己的'
      try {
        await replyInChat({
          namespace: input.namespace,
          identity: input.identity,
          character: freshChar,
          chat,
          presets: input.presets,
          activePresetId: modePresetId(input.settings, 'sms'),
          fourthWall: input.settings.fourthWall,
          voiceReady: input.settings.minimax.ready && isTrustedVoiceCache(input.settings.minimax.fetchedVoices),
          proactive: true,
          triggerNote: `你刚在${life.location || '外面'}${doing}，想起对方，主动发一条生活化的短信。不要解释为什么发，像真人顺嘴说一句，比如「刚下班」「今天好累」。`,
        })
        const updated = (await storage.getCharacter(input.namespace, character.id)) ?? freshChar
        const latest = getNearbyMeta(updated) ?? meta
        await storage.putCharacter(input.namespace, {
          ...updated,
          extensions: { ...updated.extensions, nearby: { ...latest, lastLifePingAt: Date.now() } },
          updatedAt: Date.now(),
        })
        useMellow.getState().refreshInbox()
      } catch {
        // API 未配置时跳过
      }
    })
  }
}
