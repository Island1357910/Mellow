import { loadConfig, loadSave } from '../engine/story.ts'
import { messagePreview } from './messagePreview.ts'
import { storage } from '../storage/StorageService.ts'
import type { Character } from '../types/index.ts'

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** 线下/番外读手机：把与该角色相关的近期短信带给模型 */
export async function smsBridgeForStory(phoneNamespace: string, chars: Character[]): Promise<string> {
  if (chars.length === 0) return ''
  const ids = new Set(chars.map((item) => item.id))
  const chats = (await storage.listChats(phoneNamespace)).filter(
    (chat) => chat.kind === 'dm' && chat.memberIds.some((id) => ids.has(id)),
  )
  const bits: string[] = []
  for (const chat of chats) {
    const char = chars.find((item) => item.id === chat.memberIds[0])
    const rows = (await storage.listMessages(phoneNamespace, chat.id)).filter(
      (item) => !item.hidden && item.kind !== 'system',
    )
    for (const row of rows.slice(-14)) {
      const who = row.role === 'user' ? '对方（玩家）' : char?.nickname || char?.name || '角色'
      bits.push(`${who}：${messagePreview(row.content, row.kind).slice(0, 180)}`)
    }
  }
  if (bits.length === 0) return ''
  return `【手机短信·角色已知情】这些对话刚发生在手机里。若短信里约见面、让来找、说了要去哪，线下必须接得上，不能装作不知道、没说过、没约好。\n${bits.join('\n')}`
}

/** 短信读线下：把近期线下剧情带给该角色 */
export async function storyBridgeForSms(phoneNamespace: string, character: Character): Promise<string> {
  const config = await loadConfig(phoneNamespace)
  const saveId = config.activeSaveId
  if (!saveId) return ''
  const save = await loadSave(phoneNamespace, saveId)
  if (!save || save.lines.length === 0) return ''
  const recent = save.lines.slice(-10)
  const text = recent
    .map((line) => {
      const who = line.role === 'user' ? '对方（玩家）' : '现场/剧情'
      return `${who}：${stripHtml(line.content).slice(0, 200)}`
    })
    .join('\n')
  return `【线下见面近况】${character.name} 刚经历过或知道的事（短信里要接得上，别提好像完全没发生过）：\n${text}`
}
