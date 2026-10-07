import { AIAdapter } from '../engine/AIAdapter.ts'
import { uid } from './id.ts'
import { storage } from '../storage/StorageService.ts'

export interface SocialMoment {
  id: string
  author: string
  text: string
  at: number
  mine?: boolean
  image?: string
}

export interface SocialNearPerson {
  name: string
  gender: string
  age: string
  city: string
  signature: string
  bio: string
  tags: string[]
}

async function ask(prompt: string, maxTokens = 900): Promise<string> {
  const adapter = await AIAdapter.fromStored(await storage.readApi(), await storage.readApiKey())
  const result = await adapter.complete({
    messages: [
      { role: 'system', content: '只返回 JSON，不要写解释，不要用代码块。' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.9,
    maxTokens,
  })
  return result.content
}

function readJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('没有读出内容')
  return JSON.parse(text.slice(start, end + 1)) as unknown
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export async function generateMomentsFeed(namespace: string, names: string): Promise<SocialMoment[]> {
  const raw = await ask(`为一部手机里的朋友圈写 10 条别人发的动态。已有的人可以出现：${names}。其余用新的名字。每条像随手记下的日常，15 到 40 个字，彼此不像。只返回 {"posts":[{"author":"","text":"","minutesAgo":30}]}`)
  const data = readJson(raw) as { posts?: Array<Record<string, unknown>> }
  const posts = (data.posts ?? []).slice(0, 12).flatMap((item) => {
    const author = asText(item.author)
    const body = asText(item.text)
    if (!author || !body) return []
    const minutes = Number(item.minutesAgo)
    const at = Date.now() - (Number.isFinite(minutes) ? minutes : 40) * 60_000
    return [{ id: uid(), author, text: body, at, mine: false }]
  })
  if (posts.length === 0) throw new Error('朋友圈是空的')
  await storage.setBag(namespace, 'circle-feed', { at: Date.now(), posts })
  return posts
}

export async function generateNearbyPeople(namespace: string, visit: number): Promise<SocialNearPerson[]> {
  const raw = await ask('生成 7 个彼此不同的附近的人。名字两个或三个字，不要重复。资料短，像卡片，不要写成故事。只返回 {"people":[{"name":"","gender":"","age":"","city":"","signature":"","bio":"","tags":["",""]}]}', 1100)
  const data = readJson(raw) as { people?: Array<Record<string, unknown>> }
  const next = (data.people ?? []).slice(0, 8).flatMap((item) => {
    const name = asText(item.name)
    if (!name) return []
    const tags = Array.isArray(item.tags) ? item.tags.map(asText).filter(Boolean).slice(0, 3) : []
    return [{ name, gender: asText(item.gender) || '保密', age: asText(item.age), city: asText(item.city), signature: asText(item.signature), bio: asText(item.bio), tags }]
  })
  if (next.length < 6) throw new Error('人不够，再试一次')
  await storage.setBag(namespace, 'nearby_people', { visit, people: next, at: Date.now() })
  return next
}
