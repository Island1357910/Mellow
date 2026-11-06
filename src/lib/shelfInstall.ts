import { SHELF_CARDS, shelfCardUrl, type ShelfCard } from '../data/shelfCards.ts'
import { importCardFile } from '../domain/importing.ts'
import { storage } from '../storage/StorageService.ts'
import type { Identity } from '../types/index.ts'
import { importJiushiCardFile, isJiushiCharacter } from './jiushi.ts'

export function shelfCardById(id: string): ShelfCard | undefined {
  return SHELF_CARDS.find((card) => card.id === id)
}

export async function shelfNameTaken(card: ShelfCard, namespace: string): Promise<boolean> {
  const people = await storage.listCharacters(namespace)
  return people.some((person) => person.name === card.name && (card.era === 'ancient') === isJiushiCharacter(person))
}

export async function installShelfCard(card: ShelfCard, identity: Identity): Promise<'短信' | '旧世'> {
  const response = await fetch(shelfCardUrl(card))
  if (!response.ok) throw new Error('这张卡没有读出来')
  const blob = await response.blob()
  const png = card.file.endsWith('.png')
  const file = new File([blob], card.file, { type: png ? 'image/png' : 'application/json' })
  if (card.era === 'ancient') {
    const people = await importJiushiCardFile(file, identity)
    if (!people[0]) throw new Error('这张古风卡没有装进去')
    return '旧世'
  }
  const { characters } = await importCardFile(file, identity)
  if (!characters[0]) throw new Error('这张卡没有装进去')
  return '短信'
}
