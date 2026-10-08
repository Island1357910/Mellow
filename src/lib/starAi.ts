import { AIAdapter } from '../engine/AIAdapter.ts'
import { askLine, readJsonArray } from './ask.ts'
import { uid } from './id.ts'
import {
  freshFallbackPosts,
  isFixedStarNpc,
  needsAiStarSeed,
  passerby,
  saveFeed,
  STAR_POST_MAX,
  type FeedComment,
  type FeedPost,
  type StarPerson,
} from './feed.ts'
import { storage } from '../storage/StorageService.ts'

const FEED_SYSTEM = '你是星博（类似微博）的内容生成器。只输出 JSON，不要 Markdown，不要代码块，不要任何解释或前后缀。'
const GENERATE_ATTEMPTS = 3

const SEED_INSTRUCTION = `写 5 到 7 条星博动态。硬性规则：
- 每条 author 必须互不相同
- 除「角色卡」里列出的名字外，其余 author 必须是本次现场新编的微博昵称，禁止复用任何旧账号名
- 禁止出现模板化固定路人（如：晚班店员、巷口灯、便利店、楼对面、末班车、花店 等）
- 昵称要像真实网友：可含数字、口语、职业感，但必须是新造的，每次生成都要换一批新名字
- 话题多样：美食、工作、恋爱、吐槽、段子、宠物、追星、运动、学习、旅行、购物、天气……
- 同一批里 text 长短必须明显不同，不要每条都差不多长：
  · 超短（4～15字）：牢骚、记录、感叹，如「累。」「不想干了。」「今天也。」
  · 中等（20～70字）：日常片段、小观察
  · 长篇（90～220字）：吐槽、感慨、讲故事，可以写多句，像真人在发泄或日记
- 至少包含 1 条超短、1 条中等、1 条偏长；其余长短交错
- 返回 JSON 数组，每项 {"author":"昵称","text":"正文","comments":[{"author":"另一个新昵称","text":"一句评论"}]}`

const REFRESH_INSTRUCTION = `写 2 到 4 条新的星博动态。硬性规则：
- 每条 author 必须是全新昵称，不得与「已有作者」或任何常见模板路人重复
- 禁止晚班店员、巷口灯、便利店、楼对面 等固定账号
- 几条之间长短要不一样：可极短、可中等、可长篇吐槽感慨
- 返回 JSON 数组，每项 {"author":"新昵称","text":"正文（4～220字，长短因帖而异）"}`

function postText(row: { text?: unknown; content?: unknown; body?: unknown }): string {
  for (const key of ['text', 'content', 'body'] as const) {
    const val = row[key]
    if (typeof val === 'string' && val.trim()) return val.trim()
  }
  return ''
}

function buildAuthorBrief(chars: StarPerson[]): string {
  const cards = chars.map((item) => {
    const vibe = (item.personality || item.description || item.signature || '').trim().split(/[。\n]/)[0]?.slice(0, 42) ?? '日常'
    const handle = item.signature?.trim()
    return `- ${item.name}${handle ? ` @${handle}` : ''}：${vibe}`
  })
  if (!cards.length) {
    return '暂无角色卡。请为每条动态各起一个全新的网友昵称，不要复用任何已有账号。'
  }
  return [
    '角色卡（最多各发一条，内容贴合人设）：',
    cards.join('\n'),
    '其余动态：必须为本次新编的网友昵称，不得与角色卡重名，不得使用固定模板路人。',
  ].join('\n')
}

function authorsUnique(posts: FeedPost[]): boolean {
  const seen = new Set<string>()
  for (const item of posts) {
    if (seen.has(item.author)) return false
    seen.add(item.author)
  }
  return true
}

function lengthsDiverse(posts: FeedPost[]): boolean {
  if (posts.length < 2) return true
  const lengths = posts.map((item) => item.text.length)
  const hasShort = lengths.some((len) => len <= 16)
  const hasLong = lengths.some((len) => len >= 80)
  const spread = Math.max(...lengths) - Math.min(...lengths)
  if (posts.length >= 3) return hasShort && hasLong && spread >= 30
  return spread >= 20 || (hasShort && lengths.some((len) => len >= 25))
}

function postsValid(posts: FeedPost[], avoidAuthors: string[]): boolean {
  if (!authorsUnique(posts)) return false
  if (!lengthsDiverse(posts)) return false
  const avoid = new Set(avoidAuthors)
  for (const item of posts) {
    if (isFixedStarNpc(item.author)) return false
    if (avoid.has(item.author)) return false
    for (const comment of item.comments) {
      if (isFixedStarNpc(comment.author)) return false
    }
  }
  return true
}

function parsePosts(raw: unknown, chars: StarPerson[], player: string): FeedPost[] {
  if (!Array.isArray(raw)) return []
  const now = Date.now()
  return raw.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return []
    const row = item as { author?: unknown; text?: unknown; content?: unknown; body?: unknown; comments?: unknown; mine?: unknown }
    const author = typeof row.author === 'string' ? row.author.trim() : ''
    const text = postText(row)
    if (!author || !text || isFixedStarNpc(author)) return []
    const person = chars.find((char) => char.name === author)
    const comments = Array.isArray(row.comments)
      ? row.comments.flatMap((entry, at) => {
          if (!entry || typeof entry !== 'object') return []
          const message = entry as { author?: unknown; text?: unknown; content?: unknown }
          const body = postText(message)
          const commentAuthor = typeof message.author === 'string' && message.author.trim() ? message.author.trim() : ''
          if (!body || !commentAuthor || isFixedStarNpc(commentAuthor)) return []
          return [{
            id: uid('cmt'),
            author: commentAuthor,
            text: body.slice(0, 80),
            at: now - index * 1_800_000 + at * 600_000,
          } satisfies FeedComment]
        })
      : []
    return [{
      id: uid('post'),
      author: row.mine ? player : author,
      handle: person?.signature?.slice(0, 14) || person?.name || author,
      text: text.slice(0, STAR_POST_MAX),
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
    temperature: 0.95,
    maxTokens,
  })
  return result.content.trim()
}

async function generatePosts(
  instruction: string,
  user: string,
  maxTokens: number,
  chars: StarPerson[],
  player: string,
  avoidAuthors: string[] = [],
): Promise<FeedPost[]> {
  let last: Error | null = null
  for (let attempt = 0; attempt < GENERATE_ATTEMPTS; attempt++) {
    try {
      const hint = attempt > 0
        ? '\n上次不合格：JSON 不对、author 重复、用了旧账号/固定路人、或每条长度太相似。务必全新昵称，且超短/中等/长篇混着写，只返回合法 JSON 数组。'
        : ''
      const avoid = avoidAuthors.length
        ? `\n禁止使用的已有作者：${avoidAuthors.slice(0, 40).join('、')}`
        : ''
      const raw = await starComplete(`${FEED_SYSTEM}\n${instruction}${avoid}${hint}`, user, maxTokens)
      const posts = parsePosts(readJsonArray(raw), chars, player)
      if (posts.length && postsValid(posts, avoidAuthors)) return posts
      last = new Error('没有写成帖子')
    } catch (reason) {
      last = reason instanceof Error ? reason : new Error('没有读出内容')
    }
  }
  throw last ?? new Error('没有写成帖子')
}

export async function seedStarFeedAi(
  namespace: string,
  player: string,
  chars: StarPerson[],
): Promise<void> {
  const saved = (await storage.getBag<FeedPost[]>(namespace, 'star_feed')) ?? []
  const done = await storage.getBag<boolean>(namespace, 'star_feed_ai_done')
  if (done && !needsAiStarSeed(saved)) return

  const mine = saved.filter((item) => item.mine)
  const avoidAuthors = saved.map((item) => item.author)
  let posts: FeedPost[]
  try {
    posts = await generatePosts(
      SEED_INSTRUCTION,
      buildAuthorBrief(chars),
      2000,
      chars,
      player,
      avoidAuthors,
    )
  } catch {
    posts = freshFallbackPosts(chars, 7, avoidAuthors).map((item) => ({
      ...item,
      at: Date.now(),
      comments: [] as FeedComment[],
    }))
  }
  const merged = [...posts, ...mine].sort((a, b) => b.at - a.at)
  await saveFeed(namespace, merged)
  await storage.setBag(namespace, 'star_feed_ai_done', true)
}

export async function refreshStarFeedAi(
  namespace: string,
  chars: StarPerson[],
): Promise<FeedPost[]> {
  const saved = (await storage.getBag<FeedPost[]>(namespace, 'star_feed')) ?? []
  const avoidAuthors = saved.map((item) => item.author)
  let extra: FeedPost[]
  try {
    extra = (await generatePosts(
      REFRESH_INSTRUCTION,
      buildAuthorBrief(chars),
      1600,
      chars,
      '',
      avoidAuthors,
    )).map((item) => ({ ...item, at: Date.now(), comments: [] as FeedComment[] }))
  } catch {
    extra = freshFallbackPosts(chars, 3, avoidAuthors)
  }
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
  const usedAuthors = new Set(saved.flatMap((item) => [item.author, ...item.comments.map((c) => c.author)]))
  const replies: FeedComment[] = []
  if (post.charId) {
    try {
      const line = await askLine(
        `${input.starVoice}\n你是${post.author}。用一句口语回复这条评论，不超过 30 字，不要加引号。`,
        `帖子：${post.text}\n评论：${mine.text}`,
        120,
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
      `${input.starVoice}\n只返回 JSON 数组，1 到 2 项。每项 {"author":"全新网友昵称","text":"一句评论"}。昵称必须新造，不要固定路人。不要解释。`,
      `帖子：${post.text}\n最新评论：${mine.text}\n已有账号：${[...usedAuthors].slice(0, 20).join('、')}`,
      240,
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
