import { ensureDirectChat, replyInChat } from '../domain/messaging.ts'
import { storage } from '../storage/StorageService.ts'
import { useMellow } from '../store/useMellow.ts'
import { modePresetId } from './defaults.ts'
import { isSmsProactivePaused } from './smsGuard.ts'
import { pollTogetherSource, togetherSnapshot, useTogether } from './together.ts'
import type { Identity } from '../types/index.ts'

const busy = new Set<string>()
const last = new Map<string, { at: number; key: string }>()
export async function tickTogether(identity: Identity, force = false): Promise<void> {
  const ns = identity.namespace
  if (busy.has(ns)) return
  busy.add(ns)
  try {
    await useTogether.getState().load(ns)
    const state = useMellow.getState()
    if (state.activeIdentityId !== identity.id || state.locked || isSmsProactivePaused()) return
    let config = useTogether.getState().config
    if (!config.music && !config.reading) return
    await pollTogetherSource(ns)
    if (useMellow.getState().activeIdentityId !== identity.id || useTogether.getState().namespace !== ns) return
    config = useTogether.getState().config
    const snapshot = togetherSnapshot(ns, config.charId)
    if (!snapshot.note || !config.charId || (!config.auto && !force)) return
    if (!(await storage.readModuleApi('messages'))?.ready) { useTogether.setState({ status: '请先在设置里配置可用的短信 API' }); return }
    if (state.pendingReplyChatId) return
    const key = ns + ':' + config.charId
    const previous = last.get(key)
    const gap = Math.max(1, config.minutes || 3) * 60_000
    if (!force && previous && (Date.now() - previous.at < gap || previous.key === snapshot.key)) return
    const character = await storage.getCharacter(ns, config.charId)
    if (!character || character.blocked) return
    const chat = await ensureDirectChat(ns, character)
    if (chat.blocked || chat.allowProactive === false) {
      useTogether.setState({ status: '此角色已关闭主动消息，请到聊天设置中开启' }); return
    }
    // 预约冷却，即使接口失败也不每次 tick 重试。
    last.set(key, { at: Date.now(), key: previous?.key ?? '' })
    useTogether.setState({ status: 'TA 正在想说什么…' })
    const reply = await replyInChat({ namespace: ns, identity, character, chat, presets: state.presets,
      activePresetId: modePresetId(state.settings, 'sms'), fourthWall: state.settings.fourthWall,
      proactive: true, triggerNote: snapshot.note + '\n玩家没有发送新消息。围绕共同听到或读到的内容，自然地主动聊一两句；不要重新回答旧问题，不要写分析报告。' })
    if (reply.role === 'system') throw Error(reply.content)
    last.set(key, { at: Date.now(), key: snapshot.key })
    if (useTogether.getState().namespace === ns) useTogether.setState({ status: 'TA 已发来短信 · ' + new Date().toLocaleTimeString() })
    await useMellow.getState().refreshInbox()
    useMellow.getState().touchData()
  } catch (e) {
    if (useTogether.getState().namespace === ns) useTogether.setState({ status: '这次没接上：' + (e instanceof Error ? e.message : String(e)) })
  } finally { busy.delete(ns) }
}
