import type { SearchHit } from '../domain/glance.ts'
import { storage } from '../storage/StorageService.ts'
import type { Character } from '../types/index.ts'

function bag(charId: string) {
  return `char_searches_${charId}`
}

function seed(person: Character): SearchHit[] {
  const now = Date.now()
  const trait = person.personality.trim().slice(0, 10) || '今天'
  return [
    { query: `${trait} 怎么形容`, at: now - 3_600_000 },
    { query: '附近还开着的店', at: now - 86_400_000 },
    { query: '怎么回消息显得不那么冷', at: now - 172_800_000 },
    { query: '失眠怎么办', at: now - 259_200_000 },
  ]
}

export async function loadCharSearches(namespace: string, person: Character): Promise<SearchHit[]> {
  const saved = await storage.getBag<SearchHit[]>(namespace, bag(person.id))
  if (saved?.length) return saved
  const rows = seed(person)
  await storage.setBag(namespace, bag(person.id), rows)
  return rows
}
