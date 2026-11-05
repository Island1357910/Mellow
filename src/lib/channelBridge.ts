import { listSaves, loadConfig, loadSave, type StorySave } from '../engine/story.ts'
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
  '（不要写进回复：接续你亲历的线下与短信经历，同一事件以时间更晚的结果为准。接住玩家的新消息，不要退回已经结束的冲突，也不要把见面误当作双方现在仍在一起。）'

const SMS_PRIORITY = `【优先级·高于上面全部短信记录】
短信和线下都是连续的真实经历，同一事件以时间更晚的结果为准，不能固定偏向任何一个渠道。
下面只提供你自己参与的线下片段；没有提供的其他角色私事不是你的记忆。
若线下已经吵过又和好、已经解释、已经约定、情绪已经缓下来，现在必须按线下最新的关系和情绪回短信。
禁止继续冷战、翻旧账、装作还在生气、装作线下没发生。
同一件事两边都写过时，以时间更晚的结果为准：线下更新的和好，不能被更早的短信怒气盖回去。
只有玩家在这条短信里新提出、且线下还没发生过的事，才按短信当下接。
若下面的现场里没有你，不要假装你在场，也不要拿别人的事改你们的关系；有你，或以你的名义发生过，就以这里为准。`

const OFFLINE_PRIORITY = `【优先级·高于上面全部线下记录】
手机短信和线下剧情是连续的真实经历，同一事件以时间更晚的结果为准，不能固定偏向任何一个渠道。
每个角色只能知道自己的私聊以及亲历的线下场景，不能互相读取私聊。
若短信里已经吵过又和好、已经解释、已经约定、情绪已经缓下来，现在必须按短信最新的关系和情绪往下写。
禁止继续吵、翻旧账、装作还在生气、装作短信没说过。
同一件事两边都写过时，以时间更晚的结果为准：短信更新的和好，不能被更早的线下怒气盖回去；线下末尾如果已经比短信更新，就接住线下末尾，不要退回短信里更早的吵架。
只有玩家在线下刚刚做出、且短信里还没发生过的事，才按眼前这一幕推进。`

export async function smsFacts(phoneNamespace: string, chars: Character[]): Promise<string> {
  if (chars.length === 0) return ''
  const ids = new Set(chars.map((item) => item.id))
  const chats = (await storage.listChats(phoneNamespace)).filter(
    (chat) => chat.kind === 'dm' && chat.memberIds.some((id) => ids.has(id)),
  )
  const bits: Array<{ at: number; text: string }> = []
  for (const chat of chats) {
    const char = chars.find((item) => chat.memberIds.includes(item.id))
    const rows = (await storage.listMessages(phoneNamespace, chat.id)).filter(
      (item) => !item.hidden && item.kind !== 'system',
    )
    for (const row of rows.slice(-10)) {
      const who = row.role === 'user' ? '对方（玩家）' : char?.nickname || char?.name || '角色'
      bits.push({ at: row.createdAt, text: `[${stamp(row.createdAt)} · ${char?.name ?? '角色'} 的私聊，仅本人知情] ${who}：${messagePreview(row.content, row.kind).slice(0, 320)}` })
    }
  }
  if (bits.length === 0) return ''
  return bits.sort((a, b) => a.at - b.at).slice(-20).map((item) => item.text).join('\n')
}

/** 线下读手机：短信里的关系结果高于线下旧记录。 */
export async function smsBridgeForStory(phoneNamespace: string, chars: Character[]): Promise<string> {
  const recent = await smsFacts(phoneNamespace, chars)
  if (!recent) return ''
  return `${OFFLINE_PRIORITY}\n【手机短信·必须接上】每段私聊只属于标注的角色，其他在场角色不自动知道。所有记录按真实发生时间排列，同一事件以较晚结果为准；线下当前的新动作和已经发生的后续仍有效。\n${recent}`
}

function offlineExcerpt(save: StorySave, character: Character): string {
  // Old summaries contain everyone's experiences, so never broadcast them to a DM.
  let present = false
  const lines = save.lines.filter(line => {
    if (line.participantIds) present = line.participantIds.includes(character.id)
    else if (line.role === 'user') {
      // Legacy scenes have no participant metadata. Only expose explicitly named
      // passages, rather than guessing that every continuation belongs to this person.
      present = mentioned(stripHtml(line.content), character)
    } else if (mentioned(stripHtml(line.content), character)) present = true
    return present
  }).slice(-12)
  if (!lines.length) return ''
  const body = lines
    .map((line) => {
      const who = line.role === 'user' ? '对方（玩家）' : '现场'
      const text = stripHtml(line.content)
      return `[${stamp(line.createdAt)}] ${who}：${text.length > 650 ? `${text.slice(0, 250)}…${text.slice(-400)}` : text}`
    })
    .join('\n')
  return `${character.name} 参与的线下经历（不代表你们此刻仍在同一地点）：\n${body}`
}

export async function activeOfflineSave(phoneNamespace: string) {
  const config = await loadConfig(phoneNamespace)
  const saveId = config.activeSaveId || (await listSaves(phoneNamespace))[0]?.id
  if (!saveId) return null
  const save = await loadSave(phoneNamespace, saveId)
  if (save) return save
  const latest = (await listSaves(phoneNamespace))[0]
  return latest ? loadSave(phoneNamespace, latest.id) : null
}

export function offlineFacts(save: StorySave, character: Character): string {
  return offlineExcerpt(save, character)
}

/** 短信读线下：线下里的关系结果高于短信旧记录。 */
export async function storyBridgeForSms(phoneNamespace: string, character: Character): Promise<string> {
  const save = await activeOfflineSave(phoneNamespace)
  if (!save || save.lines.length === 0) return ''
  const text = offlineFacts(save, character)
  if (!text.trim()) return ''
  return `${SMS_PRIORITY}\n【线下见面·必须接上】\n${text}`
}
