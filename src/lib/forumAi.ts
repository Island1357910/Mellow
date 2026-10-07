import { askLine, readJson } from './ask.ts'
import { passerby } from './feed.ts'
import { uid } from './id.ts'
import { storage } from '../storage/StorageService.ts'

export interface ForumReply {
  id: string
  author: string
  text: string
  at: number
  likes: number
  liked: boolean
}

export interface ForumThread {
  id: string
  title: string
  board: string
  author: string
  text: string
  at: number
  likes: number
  liked: boolean
  replies: ForumReply[]
  mine?: boolean
}

const BOARDS = ['树洞', '日常', '提问', '剧情']

function clock(): number {
  return Date.now()
}

function localThread(plot: string, author: string): ForumThread {
  const title = plot.trim().slice(0, 18) || '有人看见了吗'
  return {
    id: uid('topic'),
    title,
    board: '剧情',
    author,
    text: plot.trim() || '楼主写到一半走了。',
    at: clock(),
    likes: 3,
    liked: false,
    replies: passerby(author).map((item) => ({ id: item.id, author: item.author, text: item.text, at: item.at, likes: 0, liked: false })),
  }
}

function parseThread(parsed: { title?: unknown; board?: unknown; author?: unknown; text?: unknown; replies?: unknown }, fallback: ForumThread): ForumThread {
  const postText = typeof parsed.text === 'string' ? parsed.text.trim() : ''
  const author = typeof parsed.author === 'string' ? parsed.author.trim() : ''
  if (!postText || !author) return fallback
  const replies = Array.isArray(parsed.replies)
    ? parsed.replies.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const row = item as { author?: unknown; text?: unknown }
        const line = typeof row.text === 'string' ? row.text.trim() : ''
        if (!line) return []
        return [{ id: uid('reply'), author: typeof row.author === 'string' && row.author.trim() ? row.author.trim() : '路人', text: line.slice(0, 80), at: clock(), likes: 0, liked: false }]
      })
    : []
  return {
    id: uid('topic'),
    title: (typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : postText).slice(0, 24),
    board: typeof parsed.board === 'string' && BOARDS.includes(parsed.board) ? parsed.board : '日常',
    author,
    text: postText.slice(0, 400),
    at: clock(),
    likes: replies.length + 1,
    liked: false,
    replies: replies.length ? replies : fallback.replies,
  }
}

export async function generateRandomForumPost(namespace: string, voice: string, baseRows: ForumThread[]): Promise<ForumThread[]> {
  const chars = await storage.listCharacters(namespace)
  const names = [...chars.map((item) => item.name), '巷口灯', '晚班店员', '楼对面', '路人甲'].join('、')
  const chats = await storage.listChats(namespace)
  const bits: string[] = []
  for (const chat of chats.slice(0, 4)) {
    const msgs = await storage.listMessages(namespace, chat.id)
    bits.push(...msgs.slice(-4).map((item) => item.content.slice(0, 80)))
  }
  const context = bits.filter(Boolean).slice(-10).join('\n')
  let made = localThread(context || '论坛里今天有点热闹', chars[0]?.name ?? '路人甲')
  try {
    const raw = await askLine(
      `${voice}\n你在写论坛帖子。根据当前世界里的角色关系和近期发生的事，随机生成一条像真论坛一样的帖子。只返回 JSON：{"title":"标题","board":"树洞或日常或提问或剧情","author":"作者","text":"正文80到160字","replies":[{"author":"路人","text":"一句"}]}。作者从可选名字里选。回复 2 到 4 条。`,
      context.trim() ? `近期发生的事：\n${context}\n可选作者：${names}` : `可选作者：${names}\n没有明确线索就写日常或树洞。`,
      700,
    )
    made = parseThread(readJson(raw) as ForumThread, made)
  } catch {
    made = localThread(context || '今天论坛挺安静', chars[0]?.name ?? '路人甲')
  }
  const next = [made, ...baseRows].slice(0, 40)
  await storage.setBag(namespace, 'forum', next)
  return next
}

export async function generatePlotForumPost(namespace: string, voice: string, plot: string, baseRows: ForumThread[]): Promise<ForumThread[]> {
  const chars = await storage.listCharacters(namespace)
  const names = [...chars.map((item) => item.name), '巷口灯', '晚班店员', '楼对面', '路人甲'].join('、')
  let made = localThread(plot, '路人甲')
  try {
    const raw = await askLine(
      `${voice}\n只返回 JSON：{"title":"标题","board":"树洞或日常或提问或剧情","author":"作者","text":"正文80到160字","replies":[{"author":"路人","text":"一句"}]}。作者从这些名字里选。回复 2 到 4 条。`,
      `想看的剧情：${plot}\n可选作者：${names}`,
      700,
    )
    made = parseThread(readJson(raw) as ForumThread, made)
  } catch {
    made = localThread(plot, chars[0]?.name ?? '路人甲')
  }
  const next = [made, ...baseRows].slice(0, 40)
  await storage.setBag(namespace, 'forum', next)
  return next
}

export async function replyForumCommentAi(input: {
  namespace: string
  threadId: string
  player: string
  voice: string
}): Promise<void> {
  const rows = (await storage.getBag<ForumThread[]>(input.namespace, 'forum')) ?? []
  const thread = rows.find((item) => item.id === input.threadId)
  if (!thread) return
  const mine = [...thread.replies].reverse().find((item) => item.author === input.player)
  if (!mine) return
  const extra: ForumReply[] = []
  try {
    const raw = await askLine(
      `${input.voice}\n只返回 JSON 数组，1 到 3 项。每项 {"author":"路人","text":"一句跟帖"}。口气要不一样，不要解释。`,
      `帖子标题：${thread.title}\n正文：${thread.text}\n最新跟帖：${mine.text}`,
      350,
    )
    const parsed = readJson(raw)
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (!item || typeof item !== 'object') continue
        const row = item as { author?: unknown; text?: unknown }
        const text = typeof row.text === 'string' ? row.text.trim() : ''
        if (!text) continue
        extra.push({
          id: uid('reply'),
          author: typeof row.author === 'string' && row.author.trim() ? row.author.trim() : '路人',
          text: text.slice(0, 120),
          at: clock(),
          likes: 0,
          liked: false,
        })
      }
    }
  } catch {
    extra.push(...passerby(input.player).map((item) => ({ id: item.id, author: item.author, text: item.text, at: item.at, likes: 0, liked: false })))
  }
  const next = rows.map((item) => (
    item.id === input.threadId ? { ...item, replies: [...item.replies, ...extra] } : item
  ))
  await storage.setBag(input.namespace, 'forum', next)
}
