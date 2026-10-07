import { askLine, readJson } from './ask.ts'
import { uid } from './id.ts'
import { storage } from '../storage/StorageService.ts'
import type { Character } from '../types/index.ts'

export interface PeekLine {
  id: string
  author: string
  text: string
  at: number
}

export interface PeekThread {
  id: string
  title: string
  preview: string
  lines: PeekLine[]
}

function line(author: string, text: string, at: number): PeekLine {
  return { id: uid('peek'), author, text, at }
}

function seed(person: Character): PeekThread[] {
  const now = Date.now()
  const habit = person.personality.trim().slice(0, 18) || '普通的一天'
  const threads = [
    {
      title: '妈妈',
      lines: [
        line('妈妈', '晚饭吃了没。', now - 86_400_000),
        line(person.name, '吃了。别等我。', now - 86_000_000),
        line('妈妈', '那你早点睡。', now - 85_000_000),
      ],
    },
    {
      title: '同事',
      lines: [
        line('同事', '明天的表你看了吗，有一栏是空的。', now - 28_000_000),
        line(person.name, '看见了。我晚点填。', now - 27_000_000),
        line('同事', '行，别又拖到早上。', now - 26_000_000),
      ],
    },
    {
      title: '朋友',
      lines: [
        line('朋友', '上次那家还开着，要不要去。', now - 9_000_000),
        line(person.name, habit ? `再说。我今天有点${habit.slice(0, 8)}。` : '再说吧。', now - 8_000_000),
        line('朋友', '那你先回。我把位置留着。', now - 7_000_000),
      ],
    },
  ]
  return threads.map((item) => ({
    id: uid('thread'),
    title: item.title,
    preview: item.lines[item.lines.length - 1]?.text ?? '',
    lines: item.lines,
  }))
}

function bag(charId: string) {
  return `peek_${charId}`
}

export async function loadPeek(namespace: string, person: Character): Promise<PeekThread[]> {
  const saved = await storage.getBag<PeekThread[]>(namespace, bag(person.id))
  if (saved?.length) return saved
  const rows = seed(person)
  await storage.setBag(namespace, bag(person.id), rows)
  return rows
}

export async function refreshPeek(namespace: string, person: Character): Promise<PeekThread[]> {
  const fallback = seed(person)
  try {
    const raw = await askLine(
      `你在模拟${person.name}的手机短信。这个人：${person.personality || person.description || '普通人'}。只返回 JSON 数组，3 段和不同的人的短对话。每项 {"title":"对方称呼","lines":[{"author":"对方或${person.name}","text":"一句短信"}]}。要像真的来往，不要和玩家说话，不要解释。`,
      '写出妈妈、同事、朋友之外也可以，但必须是生活里的人。',
      700,
    )
    const parsed = readJson(raw)
    if (!Array.isArray(parsed)) throw new Error('empty')
    const now = Date.now()
    const rows = parsed.flatMap((item, index) => {
      if (!item || typeof item !== 'object') return []
      const row = item as { title?: unknown; lines?: unknown }
      const title = typeof row.title === 'string' ? row.title.trim() : ''
      if (!title || !Array.isArray(row.lines)) return []
      const lines = row.lines.flatMap((entry, at) => {
        if (!entry || typeof entry !== 'object') return []
        const message = entry as { author?: unknown; text?: unknown }
        const text = typeof message.text === 'string' ? message.text.trim() : ''
        if (!text) return []
        const author = typeof message.author === 'string' && message.author.trim() ? message.author.trim() : title
        return [line(author, text.slice(0, 80), now - (index + 1) * 3_600_000 + at)]
      })
      if (lines.length < 2) return []
      return [{ id: uid('thread'), title, preview: lines[lines.length - 1]?.text ?? '', lines }]
    })
    const next = rows.length ? rows : fallback
    await storage.setBag(namespace, bag(person.id), next)
    return next
  } catch {
    await storage.setBag(namespace, bag(person.id), fallback)
    return fallback
  }
}
