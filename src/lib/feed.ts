import { uid } from './id.ts'
import { storage } from '../storage/StorageService.ts'

export interface FeedComment {
  id: string
  author: string
  text: string
  at: number
}

export interface FeedPost {
  id: string
  author: string
  handle: string
  text: string
  at: number
  likes: number
  liked: boolean
  comments: FeedComment[]
  mine?: boolean
  charId?: string
}

export type StarPerson = {
  id: string
  name: string
  personality?: string
  signature?: string
  description?: string
}

/** 历史内置路人（禁止再出现在 AI / 兜底生成里） */
const LEGACY_NPC_NAMES = new Set([
  '巷口灯', '晚班店员', '楼对面', '花店', '花店阿青', '末班车', '楼下',
  '考研搭子', '厨房翻车', '奶茶测评', '周末徒步', '二手市集', '地铁见闻',
  '追星小号', '租房日记', '健身打卡', '摸鱼达人',
])

/** 单条动态字数上限 */
export const STAR_POST_MAX = 280

const SHORT_LINES = [
  '累。',
  '不想干了。',
  '还行。',
  '无语。',
  '笑死。',
  '懂了。',
  '今天也。',
  '随便记一笔。',
  '先这样吧。',
  '谁懂。',
  '已破防。',
  '算了。',
]

const MID_LINES = [
  '风把招牌吹得一晃一晃。',
  '热的东西捧久了，手心会红。',
  '今天的云很低，像要坐下。',
  '路灯比我先到家。',
  '雨停了，地上还是亮的。',
  '晚饭只热了一半。',
  '突然想发一条，没有原因。',
  '今天运气一般，但天空好看。',
  '刚被猫踩醒，它一脸无辜。',
  '地铁里闻到一股很好闻的洗发水味。',
  '计划表上的事项，划掉一半也算赢。',
  '外卖备注写「多放快乐」，老板回了一个问号。',
]

const LONG_LINES = [
  '本来只想吐槽一句，结果越写越多。大概就是：人为什么不能把「已经尽力了」和「其实还可以更好」同时放在心里？白天装作没事，晚上刷手机刷到眼睛酸，还要假装是在放松。算了，发都发了，就当我今晚的电子日记吧。',
  '今天被一件很小的事整破防了，说出来可能显得矫情，但那种「明明没做错什么却要自己消化」的感觉真的很难受。希望明天能睡个好觉。',
  '突然很感慨：长大好像不是学会更多答案，而是学会在不确定里继续过日子。工作、关系、未来，没有一样是完全可控的，但日子还是一天一天过下来了。记录一下此刻，给以后的自己看。',
  '我最近总在想，是不是大家都把情绪调成了静音模式。朋友圈很热闹，私聊却很短；想说的话打了又删，最后只剩一句「哈哈哈」。',
  '记录一下今天的牢骚：事情堆在一起，脑子像开了太多标签页，关哪个都不对。可还是一件件做完了，虽然不完美。想对今天说：辛苦了，明天可以稍微对自己好一点。',
  '有些日子就是用来浪费的，我知道。可浪费完还是会焦虑，像欠了谁一个交代。',
]

const TOPIC_LINES = [...SHORT_LINES, ...MID_LINES, ...LONG_LINES]

export type StarPostLength = 'short' | 'mid' | 'long'

export function randomTopicLine(kind: StarPostLength): string {
  if (kind === 'short') return pick(SHORT_LINES)
  if (kind === 'long') return pick(LONG_LINES)
  return pick(MID_LINES)
}

const LENGTH_CYCLE: StarPostLength[] = ['short', 'long', 'mid', 'short', 'mid', 'long', 'mid']

const NICK_LEFT = [
  '今天', '半夜', '刚下班', '不想', '楼下', '隔壁', '随缘', '悄悄', '临时', '过期',
  '野生', '匿名', '迷路', '摸鱼', '周末', '周一', '下雨', '晒太阳', '加班', '逃课',
]
const NICK_RIGHT = [
  '选手', '观众', '日记', '居民', '网友', '群众', '小号', '乘客', '客人', '观察员',
  '打工人', '幸存者', '练习生', '路过', '研究员', '体验官', '试吃员', '潜水员',
]

const REPLIES = [
  '这也太真实了。',
  '我刚刚也看见了。',
  '细说。',
  '哈哈，同款。',
  '路过蹲一个后续。',
  '这合理吗。',
  '前排。',
  '我朋友也这样。',
  '笑死，世另我。',
  '懂了，下次试试。',
  '附议。',
  '这谁啊这么会写。',
]

const CHAR_FALLBACK = [
  '今天心情不错，发一条。',
  '刚发生一件小事，记一下。',
  '突然想分享。',
  '路过，留个字。',
  '不想聊天，但想被看见。',
]

export function isFixedStarNpc(name: string): boolean {
  return LEGACY_NPC_NAMES.has(name.trim())
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

function hash(text: string): number {
  let sum = 0
  for (let index = 0; index < text.length; index += 1) sum = (sum + text.charCodeAt(index) * (index + 1)) % 9973
  return sum
}

/** 现场起一个未用过的网友昵称 */
export function randomStarNick(used: Set<string>, avoid: Set<string> = new Set()): string {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const num = Math.random() < 0.45 ? String(Math.floor(Math.random() * 900) + 100) : ''
    const name = `${pick(NICK_LEFT)}${pick(NICK_RIGHT)}${num}`
    if (!used.has(name) && !avoid.has(name) && !isFixedStarNpc(name)) {
      used.add(name)
      return name
    }
  }
  const fallback = `网友${uid('u').slice(-6)}`
  used.add(fallback)
  return fallback
}

function charPostLine(person: StarPerson, kind: StarPostLength): string {
  const hint = (person.personality || person.description || person.signature || '').trim()
  if (hint) {
    if (kind === 'short') {
      const bite = hint.split(/[。\n!！?？；;]/).map((item) => item.trim()).find((item) => item.length >= 2)
      if (bite) return bite.slice(0, 18)
    }
    if (kind === 'long') {
      const parts = hint.split(/[。\n!！?？；;]/).map((item) => item.trim()).filter((item) => item.length >= 4)
      if (parts.length >= 2) return parts.slice(0, 3).join('。').slice(0, STAR_POST_MAX)
      if (parts[0]) return `${parts[0]}。${pick(LONG_LINES).slice(0, 120)}`.slice(0, STAR_POST_MAX)
    }
    const line = hint.split(/[。\n!！?？；;]/).map((item) => item.trim()).find((item) => item.length >= 6)
    if (line) return line.slice(0, 80)
  }
  if (kind === 'short') return pick(SHORT_LINES)
  if (kind === 'long') return pick(LONG_LINES)
  return CHAR_FALLBACK[hash(person.name) % CHAR_FALLBACK.length] ?? '今天。'
}

function post(input: { author: string; handle: string; text: string; at: number; likes: number; charId?: string; mine?: boolean }): FeedPost {
  return {
    id: uid('post'),
    author: input.author,
    handle: input.handle,
    text: input.text,
    at: input.at,
    likes: input.likes,
    liked: false,
    comments: [],
    mine: input.mine,
    charId: input.charId,
  }
}

/** 本地兜底：每次随机新昵称 + 随机话题（不用固定路人） */
export function freshFallbackPosts(chars: StarPerson[], count: number, avoidAuthors: string[] = []): FeedPost[] {
  const now = Date.now()
  const used = new Set<string>(avoidAuthors)
  const picked: FeedPost[] = []

  for (const person of chars) {
    if (picked.length >= count) break
    if (used.has(person.name)) continue
    used.add(person.name)
    const kind = LENGTH_CYCLE[picked.length % LENGTH_CYCLE.length] ?? 'mid'
    picked.push(post({
      author: person.name,
      handle: (person.signature || person.name).slice(0, 14),
      text: charPostLine(person, kind),
      at: now - picked.length * 900_000,
      likes: (picked.length * 5 + hash(person.name)) % 17,
      charId: person.id,
    }))
  }

  const avoid = new Set(avoidAuthors)
  while (picked.length < count) {
    const author = randomStarNick(used, avoid)
    const kind = LENGTH_CYCLE[picked.length % LENGTH_CYCLE.length] ?? 'mid'
    picked.push(post({
      author,
      handle: author.slice(0, 14),
      text: randomTopicLine(kind),
      at: now - picked.length * 900_000,
      likes: (picked.length * 7 + hash(author)) % 19,
    }))
  }
  return picked
}

export function randomCommenters(except: string, count = 2): FeedComment[] {
  const used = new Set<string>([except])
  const at = Date.now()
  const rows: FeedComment[] = []
  for (let index = 0; index < count; index += 1) {
    rows.push({
      id: uid('cmt'),
      author: randomStarNick(used),
      text: REPLIES[(index + hash(except)) % REPLIES.length] ?? '看见了。',
      at: at + (index + 1) * 600_000,
    })
  }
  return rows
}

export function passerby(except: string): FeedComment[] {
  return randomCommenters(except, 2)
}

export const STAR_PRESET_LINES: string[] = [...TOPIC_LINES]

export function isPresetStarText(text: string): boolean {
  return STAR_PRESET_LINES.includes(text.trim())
}

/** 全是内置句子、或空列表 → 需要 AI 重新生成 */
export function needsAiStarSeed(posts: FeedPost[]): boolean {
  if (!posts.length) return true
  const others = posts.filter((item) => !item.mine)
  if (!others.length) return false
  const legacyNpc = others.some((item) => isFixedStarNpc(item.author))
  const allPresetText = others.every((item) => isPresetStarText(item.text))
  return legacyNpc || allPresetText
}

export async function loadFeed(namespace: string, player: string, _chars: StarPerson[]): Promise<FeedPost[]> {
  const saved = await storage.getBag<FeedPost[]>(namespace, 'star_feed')
  if (saved?.length) {
    let dirty = false
    const filled = saved.map((item) => {
      if (item.mine || item.comments.length > 0) return item
      dirty = true
      return { ...item, comments: randomCommenters(item.author, 2) }
    })
    if (dirty) await storage.setBag(namespace, 'star_feed', filled)
    return filled
  }
  const legacy = await storage.getBag<Array<{ id: string; text: string; at: number }>>(namespace, 'star')
  const mine = (legacy ?? []).filter((item) => item.text.trim()).map((item) => post({
    author: player,
    handle: '我',
    text: item.text,
    at: item.at,
    likes: 0,
    mine: true,
  }))
  if (mine.length) {
    await storage.setBag(namespace, 'star_feed', mine)
    return mine
  }
  return []
}

export async function saveFeed(namespace: string, posts: FeedPost[]): Promise<void> {
  await storage.setBag(namespace, 'star_feed', posts.slice(0, 40))
}
