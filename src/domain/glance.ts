import { eventBus } from '../engine/EventBus.ts'
import { storage } from '../storage/StorageService.ts'

export interface SearchHit {
  query: string
  at: number
}

export async function rememberSearch(namespace: string, identityId: string, query: string): Promise<void> {
  const text = query.trim()
  if (!text) return
  const prev = (await storage.getBag<SearchHit[]>(namespace, 'searches')) ?? []
  const next = [{ query: text, at: Date.now() }, ...prev.filter((item) => item.query !== text)].slice(0, 12)
  await storage.setBag(namespace, 'searches', next)
  eventBus.emit({ type: 'search', app: 'search', identityId, query: text })
}

export async function searchNoteFor(namespace: string, charId: string): Promise<string> {
  const glance = (await storage.getBag<Record<string, string[]>>(namespace, 'glance')) ?? {}
  if (!glance[charId]?.includes('search')) return ''
  const rows = (await storage.getBag<SearchHit[]>(namespace, 'searches')) ?? []
  if (rows.length === 0) return '你看得到对方的搜索栏，对方最近还没搜过。不必主动提起。'
  const recent = rows.slice(0, 3).map((item) => item.query).join('、')
  return `你看得到对方的搜索栏。最近搜过：${recent}。可以自然提起一句，也可以不提。不要每句话都提。`
}
