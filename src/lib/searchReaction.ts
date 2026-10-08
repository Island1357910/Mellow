import { ensureDirectChat, replyInChat } from '../domain/messaging.ts'
import { isAiJobRunning, jobKey, runAiJob } from '../engine/aiJobs.ts'
import { isTrustedVoiceCache } from '../engine/minimax.ts'
import { modePresetId } from './defaults.ts'
import { classifySearchConcern } from './searchConcern.ts'
import { storage } from '../storage/StorageService.ts'
import { useMellow } from '../store/useMellow.ts'

const COOLDOWN_MS = 30 * 60_000
const COOLDOWN_BAG = 'search_react_at'
const LAST_QUERY_BAG = 'search_react_query'

/** 回针已授权搜索栏时，敏感搜索可触发角色主动发短信关心。 */
export async function maybeReactToSearch(namespace: string, identityId: string, query: string): Promise<void> {
  const concern = classifySearchConcern(query)
  if (!concern) return

  const state = useMellow.getState()
  if (!state.ready || state.pendingReplyChatId) return

  const identity = state.identities.find((item) => item.id === identityId)
  if (!identity || identity.namespace !== namespace) return

  const bound = await storage.getBag<string>(namespace, 'huizhen')
  if (!bound) return

  const glance = (await storage.getBag<Record<string, string[]>>(namespace, 'glance')) ?? {}
  if (!glance[bound]?.includes('search')) return

  const lastQueries = (await storage.getBag<Record<string, string>>(namespace, LAST_QUERY_BAG)) ?? {}
  if (lastQueries[bound] === query.trim()) return

  const cooldowns = (await storage.getBag<Record<string, number>>(namespace, COOLDOWN_BAG)) ?? {}
  const lastAt = cooldowns[bound] ?? 0
  if (Date.now() - lastAt < COOLDOWN_MS) return

  const character = await storage.getCharacter(namespace, bound)
  if (!character || character.blocked) return

  let chat = (await storage.listChats(namespace)).find(
    (item) => item.kind === 'dm' && item.memberIds[0] === bound,
  )
  if (!chat) chat = await ensureDirectChat(namespace, character)
  if (chat.blocked || chat.allowProactive === false) return

  const reactKey = jobKey(namespace, 'search-react', bound)
  if (isAiJobRunning(reactKey)) return

  runAiJob(reactKey, async () => {
    try {
      await replyInChat({
        namespace,
        identity,
        character,
        chat,
        presets: state.presets,
        activePresetId: modePresetId(state.settings, 'sms'),
        fourthWall: state.settings.fourthWall,
        voiceReady: state.settings.minimax.ready && isTrustedVoiceCache(state.settings.minimax.fetchedVoices),
        proactive: true,
        triggerNote:
          `你刚透过回针看到 TA 在搜索栏搜了「${query.trim()}」。${concern.hint} ` +
          '请主动发一条短信关心 TA，像真人一样自然简短。不要像监控一样说「我看到你搜了」，可以说「你怎么了」「是不是不舒服」这类。就发一条，不要长篇大论。',
      })
      const now = Date.now()
      await storage.setBag(namespace, COOLDOWN_BAG, { ...cooldowns, [bound]: now })
      await storage.setBag(namespace, LAST_QUERY_BAG, { ...lastQueries, [bound]: query.trim() })
      const fresh = (await storage.getChat(namespace, chat.id)) ?? chat
      await storage.putChat(namespace, { ...fresh, proactiveLastAt: now })
      useMellow.getState().refreshInbox()
    } catch {
      // 接口未配置或忙时静默跳过
    }
  })
}
