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

const TOWN = [
  { author: '巷口灯', handle: '还没关' },
  { author: '晚班店员', handle: '便利店' },
  { author: '楼对面', handle: '窗帘' },
  { author: '末班车', handle: '靠窗' },
  { author: '花店', handle: '今天的花' },
  { author: '楼下', handle: '快递架' },
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
]

function crowd(at: number, index: number, except: string): FeedComment[] {
  const people = TOWN.filter((item) => item.author !== except)
  const first = people[index % people.length]
  const second = people[(index + 2) % people.length]
  if (!first || !second) return []
  return [
    { id: uid('cmt'), author: first.author, text: REPLIES[index % REPLIES.length] ?? '看见了。', at: at + 600_000 },
    { id: uid('cmt'), author: second.author, text: REPLIES[(index + 3) % REPLIES.length] ?? '哈哈。', at: at + 1_400_000 },
  ]
}

export function passerby(except: string): FeedComment[] {
  return crowd(Date.now(), Date.now() % 8, except)
}

export const STAR_PRESET_LINES = [
  '风把招牌吹得一晃一晃。',
  '热的东西捧久了，手心会红。',
  '今天的云很低，像要坐下。',
  '把没写完的句子折进口袋。',
  '路灯比我先到家。',
  '买了一支便宜的花，插在杯子里。',
  '雨停了，地上还是亮的。',
  '夜班的第三杯水。',
  '把窗帘拉开一条缝。',
  '晚饭只热了一半。',
]

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

export function townPosts(chars: Array<{ id: string; name: string }>, count: number): FeedPost[] {
  const now = Date.now()
  const rows: FeedPost[] = []
  for (let index = 0; index < count; index += 1) {
    const person = chars.length && index % 2 === 0 ? chars[index % chars.length] : null
    const town = TOWN[index % TOWN.length]
    if (!town) continue
    rows.push(post({
      author: person?.name ?? town.author,
      handle: person ? person.name : town.handle,
      text: STAR_PRESET_LINES[(index + chars.length) % STAR_PRESET_LINES.length] ?? '今天就到这里。',
      at: now - index * 1_800_000,
      likes: (index * 3) % 11,
      charId: person?.id,
    }))
  }
  return rows
}

export function isPresetStarText(text: string): boolean {
  return STAR_PRESET_LINES.includes(text.trim())
}

/** 全是内置句子、或空列表 → 需要 AI 重新生成 */
export function needsAiStarSeed(posts: FeedPost[]): boolean {
  if (!posts.length) return true
  const others = posts.filter((item) => !item.mine)
  if (!others.length) return false
  return others.every((item) => isPresetStarText(item.text))
}

export async function loadFeed(namespace: string, player: string, _chars: Array<{ id: string; name: string }>): Promise<FeedPost[]> {
  const saved = await storage.getBag<FeedPost[]>(namespace, 'star_feed')
  if (saved?.length) {
    let dirty = false
    const filled = saved.map((item, index) => {
      if (item.mine || item.comments.length > 0) return item
      dirty = true
      return { ...item, comments: crowd(item.at, index, item.author) }
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
