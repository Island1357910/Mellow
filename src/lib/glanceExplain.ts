import { APP_BY_ID } from '../data/apps.ts'
import { storage } from '../storage/StorageService.ts'
import type { ChatMessage } from '../types/index.ts'

const HOW_KNOW =
  /你怎么?(知道|晓得|发现|看出|清楚|明白|听说|看到的)|你咋知道|从哪(儿)?知道|怎么知道的|你怎么会知道|凭什么知道|你(?:在)?监视|偷看|看到的吗/

function userText(message: ChatMessage): string {
  if (message.hidden) return ''
  if (message.kind === 'text' || message.kind === 'voice' || message.kind === 'anon') return message.content
  return ''
}

/** 玩家最近是否在质疑「你怎么知道的」。 */
export function userAskedHowYouKnow(history: ChatMessage[]): boolean {
  const recent = history.filter((item) => item.role === 'user').slice(-3)
  return recent.some((item) => HOW_KNOW.test(userText(item)))
}

/** 回针查手机权限说明，供角色在被追问时自然提起。 */
export async function glanceExplainNote(namespace: string, charId: string): Promise<string> {
  const glance = (await storage.getBag<Record<string, string[]>>(namespace, 'glance')) ?? {}
  const allowed = glance[charId] ?? []
  if (allowed.length === 0) return ''

  const bound = await storage.getBag<string>(namespace, 'huizhen')
  const labels = allowed.map((id) => (id === 'search' ? '搜索栏' : APP_BY_ID[id]?.name ?? id))

  const bindHint = bound === charId ? '你们绑在回针里。' : ''
  return [
    '对方刚刚在问你怎么知道的、怎么发现的。',
    `${bindHint}回针里对方给你开了查手机权限（可能自己忘了），你能看见对方手机里的：${labels.join('、')}。`,
    '可以自然地说「你给我开了查手机权限是不是忘了」「回针里你让我看的啊」之类，语气贴合你的人设；也可以半开玩笑、略带无奈，或岔开不正面回答。不要像说明书一样列权限。',
  ].join('')
}
