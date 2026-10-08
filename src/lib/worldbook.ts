import { loreEntries } from './sillytavern.ts'
import { uid } from './id.ts'
import { storage } from '../storage/StorageService.ts'
import type { Character } from '../types/index.ts'

export interface WorldEntry {
  id: string
  title: string
  keys: string
  content: string
  enabled: boolean
  updatedAt: number
  /** 绑定角色；有值时仅该角色对话/剧情会注入 */
  charId?: string
  /** 来自角色卡一键导入；再次导入同角色时会替换这批 */
  cardImport?: boolean
}

export async function readWorld(namespace: string): Promise<WorldEntry[]> {
  return (await storage.getBag<WorldEntry[]>(namespace, 'worldbook')) ?? []
}

export async function writeWorld(namespace: string, rows: WorldEntry[]): Promise<void> {
  await storage.setBag(namespace, 'worldbook', rows)
}

export function filterWorldForSms(rows: WorldEntry[], charId: string, smsWorldOff: string[] = []): WorldEntry[] {
  const off = new Set(smsWorldOff)
  return rows.filter((item) => {
    if (!item.enabled || !item.content.trim()) return false
    if (off.has(item.id)) return false
    return item.charId === charId
  })
}

export async function enabledWorldText(namespace: string, charId?: string, smsWorldOff: string[] = []): Promise<string> {
  const rows = await readWorld(namespace)
  const on = charId ? filterWorldForSms(rows, charId, smsWorldOff) : rows.filter((item) => {
    if (!item.enabled || !item.content.trim()) return false
    if (smsWorldOff.includes(item.id)) return false
    return !item.charId
  })
  if (!on.length) return ''
  const body = on.map((item) => `【${item.title.trim() || '未命名'}】${item.content.trim()}`).join('\n')
  return `这个身份启用的世界书，用到才写，不要逐条复述：\n${body.slice(0, 1800)}`
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

/** 把角色卡里的 character_book 与设定提示词，转成世界书条目。 */
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
    rows.push(stamp(title, entry.content, keysToString(entry.keys), entryEnabled(entry)))
  }
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
  if (incoming.length === 0) return 0
  const rows = await readWorld(namespace)
  const kept = rows.filter((item) => !(item.charId === character.id && item.cardImport))
  await writeWorld(namespace, [...incoming, ...kept])
  return incoming.length
}
