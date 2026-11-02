import { readSharedLife, changeSharedLife } from './sharedLife.ts'
import { moduleAi, readJson } from './ask.ts'
import { uid } from './id.ts'
import { storage } from '../storage/StorageService.ts'
import type { Character } from '../types/index.ts'

const { askLine } = moduleAi('huizhen')

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

function bag(charId: string) {
  return `peek_live_v2_${charId}`
}

export async function loadPeek(namespace: string, person: Character): Promise<PeekThread[]> {
  return (await storage.getBag<PeekThread[]>(namespace, bag(person.id))) ?? []
}

export async function refreshPeek(namespace: string, person: Character): Promise<PeekThread[]> {
    const contacts=(await readSharedLife(namespace)).contacts.filter(c=>c.charId===person.id)

    const raw = await askLine(
      `你在模拟${person.name}的手机短信。这个人：${person.personality || person.description || '普通人'}。只返回 JSON 数组，3 段和不同的人的短对话。每项 {"title":"对方称呼","lines":[{"author":"对方或${person.name}","text":"一句短信"}]}。要像真的来往，不要和玩家说话，不要解释。`,
      `已有长期联系人：${JSON.stringify(contacts)}。有联系人时优先从这些人中写对话，保留姓名与关系，结合他们的生活线索；没有联系人时根据人物设定现场决定，不预设亲属、职业或关系。现实时间：${new Date().toLocaleString("zh-CN")}。`,
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
      if (contacts.length && !contacts.some(c=>c.name===title)) return []
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
    if (!rows.length) throw Error('角色短信没有生成完整，请重试')
    const next = rows
    await storage.setBag(namespace, bag(person.id), next)
    if(!contacts.length)await changeSharedLife(namespace,s=>{const names=new Set(s.contacts.filter(c=>c.charId===person.id).map(c=>c.name));return {...s,contacts:[...s.contacts,...rows.filter(r=>!names.has(r.title)).map(r=>({id:uid('life_contact'),charId:person.id,name:r.title,relation:'短信联系人',description:r.preview,introduced:false}))]}})
    return next
}
