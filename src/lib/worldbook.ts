import { loreEntries } from './sillytavern.ts'
import { uid } from './id.ts'
import { storage } from '../storage/StorageService.ts'
import { jiushiWorldNs } from './jiushiPhone.ts'
import { fillCharacterPrompt } from './presetPrompt.ts'
import type { Character } from '../types/index.ts'

export interface WorldEntry {
  id: string
  title: string
  keys: string
  content: string
  enabled: boolean
  updatedAt: number
  constant?: boolean
  /** 绑定角色；有值时仅该角色对话/剧情会注入 */
  charId?: string
  /** 来自角色卡一键导入；再次导入同角色时会替换这批 */
  cardImport?: boolean
  /** 世界搭建导入的世界名；同世界再次导入时会替换 */
  worldForge?: string
}

export const CHARACTER_PROFILE_FIELDS = [
  ['description', '简介'],
  ['personality', '性格'],
  ['scenario', '情境'],
] as const
export type CharacterProfile = Pick<Character, typeof CHARACTER_PROFILE_FIELDS[number][0]>

export function isGlobalWorldEntry(item: WorldEntry): boolean {
  return !item.charId
}

export async function readWorld(namespace: string): Promise<WorldEntry[]> {
  return (await storage.getBag<WorldEntry[]>(namespace, 'worldbook')) ?? []
}

export async function writeWorld(namespace: string, rows: WorldEntry[]): Promise<void> {
  await storage.setBag(namespace, 'worldbook', rows)
}

export async function updateWorld(namespace: string, change: (rows: WorldEntry[]) => WorldEntry[]): Promise<WorldEntry[]> {
  const next = await storage.changeAppBags(namespace, ['worldbook'], (bags) => ({
    worldbook: change((bags.worldbook as WorldEntry[] | null) ?? []),
  }))
  return next.worldbook as WorldEntry[]
}

export async function saveCharacterProfile(namespace: string, charId: string, profile: CharacterProfile, worldNamespace = namespace) {
  const updatedAt = Date.now()
  const syncRows = (rows: WorldEntry[], character: Character) =>
    rows.flatMap((row) => {
      if (row.charId !== charId || !row.cardImport || row.keys !== character.name) return [row]
      const field = CHARACTER_PROFILE_FIELDS.find(([key, title]) => row.title === title && row.content === character[key].trim())
      if (!field || profile[field[0]] === character[field[0]]) return [row]
      const content = profile[field[0]].trim()
      return content ? [{ ...row, content, updatedAt }] : []
    })
  let previous: Character | undefined
  const saved = await storage.changeCharacterWithBag<WorldEntry[]>(namespace, charId, 'worldbook', (character, rows) => {
    previous = character
    return { character: { ...character, ...profile, updatedAt }, value: syncRows(rows ?? [], character) }
  })
  if (worldNamespace === namespace || !previous) return saved
  const original = previous
  return { character: saved.character, value: await updateWorld(worldNamespace, rows => syncRows(rows, original)) }
}

export function filterWorldForSms(rows: WorldEntry[], charId: string, smsWorldOff: string[] = []): WorldEntry[] {
  const off = new Set(smsWorldOff)
  return rows.filter((item) => {
    if (!item.enabled || !item.content.trim()) return false
    if (off.has(item.id)) return false
    return !item.charId || item.charId === charId
  })
}

/** 早期旧世导卡曾把绑定条目写入现代世界书。只补入还未迁移的旧世角色。 */
export async function migrateJiushiCardWorld(phoneNamespace: string, charIds: string[]): Promise<void> {
  if (!charIds.length) return
  const namespace = jiushiWorldNs(phoneNamespace)
  const migrationKey = 'jiushi_card_world_migrated'
  const done = await storage.getBag<string[]>(namespace, migrationKey) ?? []
  const pending = new Set(charIds.filter(id => !done.includes(id)))
  if (!pending.size) return
  const legacy = (await readWorld(phoneNamespace)).filter(entry => entry.cardImport && entry.charId && pending.has(entry.charId))
  await storage.changeAppBags(namespace, ['worldbook', migrationKey], bags => {
    const current = (bags.worldbook as WorldEntry[] | null) ?? []
    const migrated = new Set((bags[migrationKey] as string[] | null) ?? [])
    const synced = new Set(current.filter(entry => entry.cardImport).map(entry => entry.charId))
    const additions = legacy.filter(entry => !migrated.has(entry.charId!) && !synced.has(entry.charId))
    return {
      worldbook: [...current, ...additions],
      [migrationKey]: [...new Set([...migrated, ...pending])],
    }
  })
}

export async function storyWorldText(namespace: string, people: Character[], recent: string, options: {
  off?: string[]
  userName?: string
} = {}): Promise<string> {
  const owners = new Map(people.map(person => [person.id, person]))
  const off = new Set(options.off)
  const context = `${recent}\n${people.map(person => `${person.name} ${person.nickname ?? ''}`).join('\n')}`.toLowerCase()
  const stored = await readWorld(namespace)
  const imported = new Set(stored.filter(entry => entry.cardImport).map(entry => entry.charId))
  const originalLore = people.flatMap(person => loreEntries(person.characterBook).map(entry => ({
    charId: person.id,
    title: entryTitle(entry),
    content: entry.content,
    keys: keysToString(entry.keys),
    enabled: entryEnabled(entry),
    constant: entry.constant === true,
  })))
  const always = new Set(originalLore.filter(entry => entry.constant).map(entry => JSON.stringify([entry.charId, entry.title, entry.keys])))
  return [...stored, ...originalLore.filter(entry => !imported.has(entry.charId))].filter(entry => {
    if (!entry.enabled || !entry.content.trim() || (entry.charId && !owners.has(entry.charId))) return false
    if ('id' in entry && off.has(entry.id)) return false
    const keys = (entry.keys ?? '').split(/[,，、;；|\n]+/).map(key => key.trim().toLowerCase()).filter(Boolean)
    return (entry.constant ?? ('cardImport' in entry && entry.cardImport && always.has(JSON.stringify([entry.charId, entry.title, entry.keys]))))
      || !keys.length || keys.some(key => context.includes(key))
  }).map(entry => {
    const owner = entry.charId ? owners.get(entry.charId) : undefined
    const body = options.userName ? fillCharacterPrompt(entry.content.trim(), options.userName, owner ?? people[0]) : entry.content.trim()
    return `【${owner?.name ?? '公共世界'} · ${entry.title || '设定'}】${body}`
  }).join('\n')
}

export function blankEntry(charId = ''): WorldEntry {
  return { id: uid('lore'), title: '', keys: '', content: '', enabled: true, updatedAt: Date.now(), charId: charId || undefined }
}

function keysToString(keys?: string[]): string {
  return (keys ?? []).map((key) => key.trim()).filter(Boolean).join('，')
}

function entryTitle(entry: { name?: string; comment?: string; keys?: string[]; constant?: boolean }): string {
  const comment = entry.comment?.trim()
  if (comment) return comment
  const name = entry.name?.trim()
  if (name) return name
  const keys = keysToString(entry.keys)
  if (keys) return keys.split('，')[0] ?? keys
  return entry.constant ? '常驻设定' : '设定'
}

function entryEnabled(entry: { enabled?: boolean; disable?: boolean }): boolean {
  if (entry.disable === true) return false
  return entry.enabled !== false
}

/** 把角色卡全文（人设、开场、世界书、提示词）转成世界书条目，不截断。 */
export function worldEntriesFromCharacter(character: Character): WorldEntry[] {
  const now = Date.now()
  const charId = character.id
  const stamp = (title: string, content: string, keys = '', enabled = true): WorldEntry => ({
    id: uid('lore'),
    title,
    keys,
    content: content.trim(),
    enabled,
    updatedAt: now,
    charId,
    cardImport: true,
  })
  const rows: WorldEntry[] = []
  const book = character.characterBook
  for (const entry of loreEntries(book)) {
    if (!entry.content.trim()) continue
    const title = entryTitle(entry)
    rows.push({ ...stamp(title, entry.content, keysToString(entry.keys), entryEnabled(entry)), constant: entry.constant === true })
  }
  for (const [key, title] of CHARACTER_PROFILE_FIELDS) {
    if (character[key].trim()) rows.push(stamp(title, character[key], character.name))
  }
  if (character.firstMes.trim()) rows.push(stamp('开场白', character.firstMes, character.name))
  if (character.mesExample.trim()) rows.push(stamp('对话样例', character.mesExample, character.name))
  const greetings = character.alternateGreetings.map((item) => item.trim()).filter(Boolean)
  if (greetings.length) rows.push(stamp('其他开场', greetings.join('\n\n'), character.name))
  if (character.systemPrompt.trim()) {
    rows.push(stamp('系统提示', character.systemPrompt))
  }
  if (character.postHistoryInstructions.trim()) {
    rows.push(stamp('历史后指令', character.postHistoryInstructions))
  }
  if (character.creatorNotes.trim()) {
    rows.push(stamp('创作者备注', character.creatorNotes, '', false))
  }
  return rows
}

/** 导入角色时，把卡内世界书与提示词写入身份世界书（绑定该角色）。 */
export async function importCharacterWorld(namespace: string, character: Character): Promise<number> {
  const incoming = worldEntriesFromCharacter(character)
  await updateWorld(namespace, (rows) => [...incoming, ...rows.filter((item) => !(item.charId === character.id && item.cardImport))])
  return incoming.length
}
