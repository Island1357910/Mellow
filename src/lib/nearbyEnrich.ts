import { isAiJobRunning, jobKey, runAiJob } from '../engine/aiJobs.ts'
import { askLine, readJson } from './ask.ts'
import { getNearbyMeta, isNearbyCharacter } from './nearbyContact.ts'
import { storage } from '../storage/StorageService.ts'
import type { Character, ChatMessage } from '../types/index.ts'

const ENRICH_THRESHOLDS = [6, 14, 28]

export async function maybeEnrichNearby(namespace: string, character: Character, messages: ChatMessage[]): Promise<void> {
  if (!isNearbyCharacter(character)) return
  const meta = getNearbyMeta(character)
  if (!meta) return
  const level = meta.enrichLevel
  if (level >= ENRICH_THRESHOLDS.length) return
  const count = messages.filter((item) => item.kind !== 'system').length
  if (count < ENRICH_THRESHOLDS[level]) return

  const key = jobKey(namespace, 'nearby-enrich', character.id)
  if (isAiJobRunning(key)) return

  runAiJob(key, async () => {
    try {
      const snippet = messages
        .filter((item) => item.kind === 'text' || item.kind === 'voice' || item.role === 'user')
        .slice(-18)
        .map((item) => `${item.role === 'user' ? '对方' : character.name}：${item.content.slice(0, 100)}`)
        .join('\n')
      const raw = await askLine(
        `你在补全一个「附近认识的人」${character.name} 的人设。根据已有资料和最近聊天，让性格与描述更立体，但仍像真人。只返回 JSON：{"personality":"80字内","description":"120字内","signature":"15字内个性签名"}`,
        `已有性格：${character.personality}\n已有描述：${character.description}\n最近聊天：\n${snippet || '还没怎么聊'}`,
        260,
      )
      const parsed = readJson(raw) as { personality?: unknown; description?: unknown; signature?: unknown }
      const personality = typeof parsed.personality === 'string' && parsed.personality.trim() ? parsed.personality.trim() : character.personality
      const description = typeof parsed.description === 'string' && parsed.description.trim() ? parsed.description.trim() : character.description
      const signature = typeof parsed.signature === 'string' && parsed.signature.trim() ? parsed.signature.trim() : character.signature
      const fresh = (await storage.getCharacter(namespace, character.id)) ?? character
      await storage.putCharacter(namespace, {
        ...fresh,
        personality,
        description,
        signature,
        extensions: { ...fresh.extensions, nearby: { ...meta, enrichLevel: level + 1 } },
        updatedAt: Date.now(),
      })
    } catch {
      const fresh = (await storage.getCharacter(namespace, character.id)) ?? character
      await storage.putCharacter(namespace, {
        ...fresh,
        extensions: { ...fresh.extensions, nearby: { ...meta, enrichLevel: level + 1 } },
        updatedAt: Date.now(),
      })
    }
  })
}
