import type { SearchHit } from '../domain/glance.ts'
import { storage } from '../storage/StorageService.ts'
import type { Character } from '../types/index.ts'

function bag(charId: string) {
  return `char_searches_${charId}`
}

export async function loadCharSearches(namespace: string, person: Character): Promise<SearchHit[]> {
  return (await storage.getBag<SearchHit[]>(namespace, bag(person.id))) ?? []
}
