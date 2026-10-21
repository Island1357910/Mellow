import { loadConfig, loadSave, type StorySave } from '../engine/story.ts'
import { messagePreview } from './messagePreview.ts'
import { storage } from '../storage/StorageService.ts'
import type { Character } from '../types/index.ts'

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function stamp(at: number): string {
  return new Date(at).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function mentioned(text: string, character: Character): boolean {
  return [character.name, character.nickname, character.remark].some((name) => {
    const trimmed = name?.trim()
    return Boolean(trimmed && trimmed.length > 0 && text.includes(trimmed))
  })
}

/** 写在短信最后一条玩家消息后面，压过短信旧记录的惯性。 */
export const SMS_RELATION_LOCK =
  '（不要写进回复：关系和情绪以线下已经发生的结果为准，不允许把这条短信的旧记录当成最重要的依据。玩家刚刚这一句如果是新的，要接住，但不要延续已经在线下结束的争吵、冷战或翻旧账。）'

const SMS_PRIORITY = `【优先级·高于上面全部短信记录】
线下见面已经发生的事，比这条短信里的旧聊天更重要。不允许把短信上下文设成最重要的依据。
短信记录只用来接玩家刚刚发来的这一句，不能拿来推翻线下的结果。
若线下已经吵过又和好、已经解释、已经约定、情绪已经缓下来，现在必须按线下最新的关系和情绪回短信。
禁止继续冷战、翻旧账、装作还在生气、装作线下没发生。
同一件事两边都写过时，以时间更晚的结果为准：线下更新的和好，不能被更早的短信怒气盖回去。
只有玩家在这条短信里新提出、且线下还没发生过的事，才按短信当下接。
若下面的现场里没有你，不要假装你在场，也不要拿别人的事改你们的关系；有你，或以你的名义发生过，就以这里为准。`

const OFFLINE_PRIORITY = `【优先级·高于上面全部线下记录】
手机短信里已经发生的事，比更早的线下剧情更重要。不允许把线下上下文设成最重要的依据。
线下记录只用来接眼前这一幕的场景和动作，不能拿来推翻短信里的结果。
若短信里已经吵过又和好、已经解释、已经约定、情绪已经缓下来，现在必须按短信最新的关系和情绪往下写。
禁止继续吵、翻旧账、装作还在生气、装作短信没说过。
同一件事两边都写过时，以时间更晚的结果为准：短信更新的和好，不能被更早的线下怒气盖回去；线下末尾如果已经比短信更新，就接住线下末尾，不要退回短信里更早的吵架。
只有玩家在线下刚刚做出、且短信里还没发生过的事，才按眼前这一幕推进。`

/** 线下读手机：短信里的关系结果高于线下旧记录。 */
export async function smsBridgeForStory(phoneNamespace: string, chars: Character[]): Promise<string> {
  if (chars.length === 0) return ''
  const ids = new Set(chars.map((item) => item.id))
  const chats = (await storage.listChats(phoneNamespace)).filter(
    (chat) => chat.kind === 'dm' && chat.memberIds.some((id) => ids.has(id)),
  )
  const bits: string[] = []
  for (const chat of chats) {
    const char = chars.find((item) => chat.memberIds.includes(item.id))
    const rows = (await storage.listMessages(phoneNamespace, chat.id)).filter(
      (item) => !item.hidden && item.kind !== 'system',
    )
    for (const row of rows.slice(-20)) {
      const who = row.role === 'user' ? '对方（玩家）' : char?.nickname || char?.name || '角色'
      bits.push(`[${stamp(row.createdAt)}] ${who}：${messagePreview(row.content, row.kind).slice(0, 320)}`)
    }
  }
  if (bits.length === 0) return ''
  return `${OFFLINE_PRIORITY}\n【手机短信·必须接上】这些是手机里已经发生的对话。约见面、让来找、说过的话、吵完又和好，线下都要接着，不能装作不知道。\n${bits.join('\n')}`
}

function offlineExcerpt(save: StorySave, character: Character): string {
  const summaries = [...save.summaries].slice(-3)
  const summaryText = summaries
    .map((item) => `[${stamp(item.createdAt)}] ${item.kind === 'big' ? '前情' : '近况'}：${item.text.trim().slice(0, 500)}`)
    .join('\n')
  const lines = save.lines.slice(-16)
  const body = lines
    .map((line) => {
      const who = line.role === 'user' ? '对方（玩家）' : '现场'
      return `[${stamp(line.createdAt)}] ${who}：${stripHtml(line.content).slice(0, 420)}`
    })
    .join('\n')
  const haystack = `${summaryText}\n${body}`
  const present = mentioned(haystack, character)
  const head = present
    ? `${character.name} 在这段线下里出现过，或这段就是刚和对方一起发生的。关系以这里的最新结果为准。`
    : `若下面没有 ${character.name}，不要假装在场。`
  return [head, summaryText, body].filter(Boolean).join('\n')
}

/** 短信读线下：线下里的关系结果高于短信旧记录。 */
export async function storyBridgeForSms(phoneNamespace: string, character: Character): Promise<string> {
  const config = await loadConfig(phoneNamespace)
  const saveId = config.activeSaveId
  if (!saveId) return ''
  const save = await loadSave(phoneNamespace, saveId)
  if (!save || save.lines.length === 0) return ''
  const text = offlineExcerpt(save, character)
  if (!text.trim()) return ''
  return `${SMS_PRIORITY}\n【线下见面·必须接上】\n${text}`
}
