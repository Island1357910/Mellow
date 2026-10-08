import { askLine, readJson } from './ask.ts'
import { storage } from '../storage/StorageService.ts'
import type { Character, ChatMessage } from '../types/index.ts'

const APP_IDS = [
  { id: 'sms', name: '短信' },
  { id: 'search', name: '搜索栏' },
  { id: 'moments', name: '朋友圈' },
  { id: 'star', name: '星博' },
  { id: 'album', name: '相册' },
  { id: 'diary', name: '日记' },
] as const

function recentSnippet(messages: ChatMessage[], character: Character, limit = 18): string {
  return messages
    .slice(-limit)
    .map((item) => {
      const who = item.role === 'user' ? '对方' : character.name
      const body = item.hidden ? '（已删除）' : item.content.slice(0, 120)
      return `${who}：${body}`
    })
    .join('\n')
}

export async function assessCharOpen(input: {
  namespace: string
  character: Character
}): Promise<{ apps: string[]; line: string; bond: number }> {
  const chats = (await storage.listChats(input.namespace)).filter((chat) => chat.memberIds.includes(input.character.id))
  const chunks: ChatMessage[] = []
  for (const chat of chats) {
    const rows = await storage.listMessages(input.namespace, chat.id)
    chunks.push(...rows.filter((item) => item.kind === 'text' || item.kind === 'voice' || item.role === 'user'))
  }
  chunks.sort((a, b) => a.createdAt - b.createdAt)
  const snippet = recentSnippet(chunks, input.character)
  const names = APP_IDS.map((item) => item.name).join('、')

  let apps = ['sms']
  let line = '先只给你看短信。'
  let bond = 20

  try {
    const raw = await askLine(
      `你是${input.character.name}。性格：${input.character.personality.slice(0, 120)}。根据你和对方最近的感情、信任、亲密度变化，决定愿意给对方看你的哪些手机内容：${names}。这不是按消息条数解锁，而是按情感关系判断。感情淡可以只开短信，暧昧可以多开，很亲密可以全开。只返回 JSON：{"apps":["短信"],"line":"一句原因","bond":0到100的整数}`,
      snippet.trim() ? `最近聊天：\n${snippet}` : '你们还没怎么聊过。',
      220,
    )
    const parsed = readJson(raw) as { apps?: unknown; line?: unknown; bond?: unknown }
    if (Array.isArray(parsed.apps)) {
      const ids = parsed.apps.flatMap((name) => {
        if (typeof name !== 'string') return []
        const found = APP_IDS.find((item) => item.name === name.trim())
        return found ? [found.id] : []
      })
      if (ids.length) apps = Array.from(new Set(ids))
    }
    if (typeof parsed.line === 'string' && parsed.line.trim()) line = parsed.line.trim()
    if (typeof parsed.bond === 'number' && Number.isFinite(parsed.bond)) bond = Math.max(0, Math.min(100, Math.round(parsed.bond)))
  } catch {
    apps = snippet ? ['sms', 'moments'] : ['sms']
    line = snippet ? '按最近聊下来的感觉，先给你看这些。' : '还不熟，先只能看短信。'
  }

  if (!apps.includes('sms')) apps = ['sms', ...apps]
  return { apps, line, bond }
}
