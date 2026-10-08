import { replyInChat } from '../domain/messaging.ts'
import { isAiJobRunning, jobKey, runAiJob } from '../engine/aiJobs.ts'
import { modePresetId } from './defaults.ts'
import { isTrustedVoiceCache } from '../engine/minimax.ts'
import { storage } from '../storage/StorageService.ts'
import { useMellow } from '../store/useMellow.ts'
import type { AppSettings, Identity, Preset } from '../types/index.ts'

export async function tickProactive(input: {
  identity: Identity
  settings: AppSettings
  presets: Preset[]
}): Promise<void> {
  const globalMinutes = Math.max(0, Math.round(input.settings.proactiveMinutes || 0))
  if (globalMinutes <= 0) return

  const state = useMellow.getState()
  if (state.pendingReplyChatId) return

  const chats = await storage.listChats(input.identity.namespace)
  for (const chat of chats) {
    if (chat.kind !== 'dm' || chat.blocked || chat.allowProactive === false) continue
    const minutes = Math.max(1, Math.round(chat.proactiveMinutes || globalMinutes))
    const threshold = minutes * 60_000
    if (state.viewingChatId === chat.id) continue

    const key = jobKey('proactive', input.identity.namespace, chat.id)
    if (isAiJobRunning(key)) continue

    const messages = await storage.listMessages(input.identity.namespace, chat.id)
    const lastUser = [...messages].reverse().find((item) => item.role === 'user')
    const lastUserAt = lastUser?.createdAt ?? chat.createdAt
    const silentFor = Date.now() - lastUserAt
    if (silentFor < threshold) continue
    if (chat.proactiveLastAt && chat.proactiveLastAt >= lastUserAt + threshold) continue

    const character = await storage.getCharacter(input.identity.namespace, chat.memberIds[0] ?? '')
    if (!character || character.blocked) continue

    await runAiJob(key, async () => {
      await replyInChat({
        namespace: input.identity.namespace,
        identity: input.identity,
        character,
        chat,
        presets: input.presets,
        activePresetId: modePresetId(input.settings, 'sms'),
        fourthWall: input.settings.fourthWall,
        voiceReady: input.settings.minimax.ready && isTrustedVoiceCache(input.settings.minimax.fetchedVoices),
        proactive: true,
      })
      const fresh = (await storage.getChat(input.identity.namespace, chat.id)) ?? chat
      await storage.putChat(input.identity.namespace, { ...fresh, proactiveLastAt: Date.now() })
      useMellow.getState().refreshInbox()
      useMellow.getState().touchData()
    })
  }
}
