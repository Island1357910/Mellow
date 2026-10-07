import { AIAdapter } from '../engine/AIAdapter.ts'
import { askLine, readJson } from './ask.ts'
import { uid } from './id.ts'
import { needsAiStarSeed, passerby, saveFeed, type FeedComment, type FeedPost } from './feed.ts'
import { storage } from '../storage/StorageService.ts'

const FEED_SYSTEM = '你是星博（类似微博）的内容生成器。只输出 JSON，不要 Markdown，不要代码块，不要任何解释或前后缀。'

function readJsonArray(text: string): unknown[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = (fenced?.[1] ?? text).trim()
  const parsed = readJson(body)
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === 'object') {
    for (const key of ['posts', 'items', 'data', 'results', 'feed', 'list']) {
      const val = (parsed as Record<string, unknown>)[key]
      if (Array.isArray(val)) return val
    }
    const row = parsed as { author?: unknown; text?: unknown; content?: unknown }
    if (typeof row.text === 'string' || typeof row.content === 'string') return [parsed]
  }
  throw new Error('没有读出帖子列表')
}

function postText(row: { text?: unknown; content?: unknown; body?: unknown }): string {
  for (const key of ['text', 'content', 'body'] as const) {
    const val = row[key]
    if (typeof val === 'string' && val.trim()) return val.trim()
  }
  return ''
}

function parsePosts(raw: unknown, chars: Array<{ id: string; name: string }>, player: string): FeedPost[] {
  if (!Array.isArray(raw)) return []
  const now = Date.now()
  return raw.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return []
    const row = item as { author?: unknown; text?: unknown; content?: unknown; body?: unknown; comments?: unknown; mine?: unknown }
    const author = typeof row.author === 'string' ? row.author.trim() : ''
    const text = postText(row)
    if (!author || !text) return []
    const person = chars.find((char) => char.name === author)
    const comments = Array.isArray(row.comments)
      ? row.comments.flatMap((entry, at) => {
          if (!entry || typeof entry !== 'object') return []
          const message = entry as { author?: unknown; text?: unknown; content?: unknown }
          const body = postText(message)
          if (!body) return []
          return [{
            id: uid('cmt'),
            author: typeof message.author === 'string' && message.author.trim() ? message.author.trim() : '路人',
            text: body.slice(0, 80),
            at: now - index * 1_800_000 + at * 600_000,
          } satisfies FeedComment]
        })
      : []
    return [{
      id: uid('post'),
      author: row.mine ? player : author,
      handle: person?.name || author,
      text: text.slice(0, 140),
      at: now - (index + 1) * 2_400_000,
      likes: comments.length + (index % 4),
      liked: false,
      comments,
      charId: person?.id,
      mine: Boolean(row.mine),
    } satisfies FeedPost]
  })
}

async function starComplete(system: string, user: string, maxTokens: number): Promise<string> {
  const adapter = await AIAdapter.fromStored(await storage.readApi(), await storage.readApiKey())
  const result = await adapter.complete({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.85,
    maxTokens,
  })
  return result.content.trim()
}

async function generatePosts(
  instruction: string,
  user: string,
  maxTokens: number,
  chars: Array<{ id: string; name: string }>,
  player: string,
): Promise<FeedPost[]> {
  const raw = await starComplete(`${FEED_SYSTEM}\n${instruction}`, user, maxTokens)
  const posts = parsePosts(readJsonArray(raw), chars, player)
  if (!posts.length) throw new Error('没有写成帖子')
  return posts
}

export async function seedStarFeedAi(
  namespace: string,
  player: string,
  chars: Array<{ id: string; name: string }>,
): Promise<void> {
  const saved = (await storage.getBag<FeedPost[]>(namespace, 'star_feed')) ?? []
  const done = await storage.getBag<boolean>(namespace, 'star_feed_ai_done')
  if (done && !needsAiStarSeed(saved)) return

  const names = [...chars.map((item) => item.name), '巷口灯', '晚班店员', '楼对面', '花店', '末班车'].join('、')
  const mine = saved.filter((item) => item.mine)
  const posts = await generatePosts(
    '写 5 到 7 条星博动态。返回 JSON 数组。每项 {"author":"名字","text":"40字以内生活句子","comments":[{"author":"路人","text":"一句评论"}]}。',
    `作者从这些名字里选：${names}`,
    900,
    chars,
    player,
  )
  const merged = [...posts, ...mine].sort((a, b) => b.at - a.at)
  await saveFeed(namespace, merged)
  await storage.setBag(namespace, 'star_feed_ai_done', true)
}

export async function refreshStarFeedAi(
  namespace: string,
  chars: Array<{ id: string; name: string }>,
): Promise<FeedPost[]> {
  const saved = (await storage.getBag<FeedPost[]>(namespace, 'star_feed')) ?? []
  const names = [...chars.map((item) => item.name), '巷口灯', '晚班店员', '楼对面', '花店'].join('、')
  const made = await generatePosts(
    '写 2 到 3 条新的星博动态。返回 JSON 数组。每项 {"author":"名字","text":"40字以内的生活句子"}。',
    `作者从这些名字里选：${names}`,
    500,
    chars,
    '',
  )
  const extra = made.map((item) => ({ ...item, at: Date.now(), comments: [] as FeedComment[] }))
  const next = [...extra, ...saved].slice(0, 40)
  await saveFeed(namespace, next)
  return next
}

export async function replyStarCommentAi(input: {
  namespace: string
  postId: string
  player: string
  starVoice: string
}): Promise<void> {
  const saved = (await storage.getBag<FeedPost[]>(input.namespace, 'star_feed')) ?? []
  const post = saved.find((item) => item.id === input.postId)
  if (!post) return
  const mine = [...post.comments].reverse().find((item) => item.author === input.player)
  if (!mine) return
  const replies: FeedComment[] = []
  if (post.charId) {
    try {
      const line = await askLine(
        `${input.starVoice}\n你是${post.author}。用一句口语回复这条评论，不超过 30 字，不要加引号。`,
        `帖子：${post.text}\n评论：${mine.text}`,
        60,
      )
      replies.push({
        id: uid('cmt'),
        author: post.author,
        text: line.replace(/^["“]|["”]$/g, '').slice(0, 40) || '看到了。',
        at: Date.now(),
      })
    } catch {
      replies.push({ id: uid('cmt'), author: post.author, text: '看到了。', at: Date.now() })
    }
  }
  try {
    const raw = await askLine(
      `${input.starVoice}\n只返回 JSON 数组，1 到 2 项。每项 {"author":"路人","text":"一句评论"}。不要解释。`,
      `帖子：${post.text}\n最新评论：${mine.text}`,
      180,
    )
    const crowd = parsePosts(readJsonArray(raw), [], input.player).flatMap((item) => item.comments)
    replies.push(...crowd.filter((item) => item.author !== post.author && item.author !== input.player))
  } catch {
    replies.push(...passerby(input.player).filter((item) => item.author !== post.author))
  }
  const next = saved.map((item) => (
    item.id === input.postId ? { ...item, comments: [...item.comments, ...replies] } : item
  ))
  await saveFeed(input.namespace, next)
}
