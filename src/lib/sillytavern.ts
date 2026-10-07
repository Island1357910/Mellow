import type { Character, Lorebook, LorebookEntry } from '../types/index.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function str(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  return typeof value === 'string' ? value : ''
}

function strList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

export function loreEntries(book: Lorebook | null): LorebookEntry[] {
  if (!book) return []
  if (Array.isArray(book.entries)) return book.entries
  return Object.values(book.entries)
}

function readBook(value: unknown): Lorebook | null {
  if (!isRecord(value)) return null
  const entries = value.entries
  if (!Array.isArray(entries) && !isRecord(entries)) return null
  return {
    name: str(value, 'name') || undefined,
    entries: entries as Lorebook['entries'],
  }
}

export interface CardDraft {
  name: string
  avatar: string
  description: string
  personality: string
  scenario: string
  firstMes: string
  mesExample: string
  creatorNotes: string
  systemPrompt: string
  postHistoryInstructions: string
  alternateGreetings: string[]
  tags: string[]
  creator: string
  characterVersion: string
  characterBook: Lorebook | null
  extensions: Record<string, unknown>
  rawCard: unknown
}

function fromData(data: Record<string, unknown>, rawCard: unknown): CardDraft {
  const name = str(data, 'name').trim()
  if (!name) throw new Error('这张卡没有名字')
  const extensions: Record<string, unknown> = isRecord(data.extensions) ? { ...data.extensions } : {}
  const scripts = extensions.regex_scripts ?? data.regex_scripts
  if (Array.isArray(scripts) && scripts.length > 0) extensions.regex_scripts = scripts
  return {
    name,
    avatar: '',
    description: str(data, 'description'),
    personality: str(data, 'personality'),
    scenario: str(data, 'scenario'),
    firstMes: str(data, 'first_mes'),
    mesExample: str(data, 'mes_example'),
    creatorNotes: str(data, 'creator_notes'),
    systemPrompt: str(data, 'system_prompt'),
    postHistoryInstructions: str(data, 'post_history_instructions'),
    alternateGreetings: strList(data.alternate_greetings),
    tags: strList(data.tags),
    creator: str(data, 'creator'),
    characterVersion: str(data, 'character_version'),
    characterBook: readBook(data.character_book),
    extensions,
    rawCard,
  }
}

/** 兼容 SillyTavern V2，以及只有顶层字段的 V1 卡。 */
export function parseCharacterCard(raw: unknown): CardDraft {
  if (!isRecord(raw)) throw new Error('角色卡不是 JSON 对象')
  if (isRecord(raw.data) && (typeof raw.data.name === 'string' || typeof raw.spec === 'string')) {
    return fromData(raw.data, raw)
  }
  if (typeof raw.name === 'string') return fromData(raw, raw)
  throw new Error('认不出这是角色卡')
}

export function parseCharacterCards(raw: unknown): CardDraft[] {
  if (Array.isArray(raw)) {
    if (raw.length === 0) throw new Error('文件里没有角色卡')
    return raw.slice(0, 20).map((item) => parseCharacterCard(item))
  }
  return [parseCharacterCard(raw)]
}

export function toSillyTavernV2(character: Character): Record<string, unknown> {
  const raw = isRecord(character.rawCard) ? character.rawCard : {}
  const rawData = isRecord(raw.data) ? raw.data : {}
  return {
    ...raw,
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      ...rawData,
      name: character.name,
      description: character.description,
      personality: character.personality,
      scenario: character.scenario,
      first_mes: character.firstMes,
      mes_example: character.mesExample,
      creator_notes: character.creatorNotes,
      system_prompt: character.systemPrompt,
      post_history_instructions: character.postHistoryInstructions,
      alternate_greetings: character.alternateGreetings,
      character_book: character.characterBook,
      tags: character.tags,
      creator: character.creator,
      character_version: character.characterVersion,
      extensions: character.extensions,
    },
  }
}

function readPngTexts(bytes: Uint8Array): Record<string, string> {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[i] !== signature[i]) throw new Error('这不是 PNG 角色卡')
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const texts: Record<string, string> = {}
  let offset = 8
  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset)
    const type = String.fromCharCode(
      bytes[offset + 4] ?? 0,
      bytes[offset + 5] ?? 0,
      bytes[offset + 6] ?? 0,
      bytes[offset + 7] ?? 0,
    )
    const start = offset + 8
    const end = start + length
    if (end > bytes.length) break
    const data = bytes.slice(start, end)
    if (type === 'tEXt') {
      const zero = data.indexOf(0)
      if (zero > 0) {
        const key = new TextDecoder().decode(data.slice(0, zero))
        const value = new TextDecoder('latin1').decode(data.slice(zero + 1))
        texts[key] = value
      }
    } else if (type === 'iTXt') {
      const parsed = readItxt(data)
      if (parsed) texts[parsed.key] = parsed.text
    }
    offset = end + 4
    if (type === 'IEND') break
  }
  return texts
}

function readItxt(data: Uint8Array): { key: string; text: string } | null {
  let cursor = 0
  const readNull = () => {
    const start = cursor
    while (cursor < data.length && data[cursor] !== 0) cursor += 1
    const text = new TextDecoder().decode(data.slice(start, cursor))
    cursor += 1
    return text
  }
  const key = readNull()
  const compression = data[cursor] ?? 1
  cursor += 2
  readNull()
  readNull()
  if (compression !== 0) return null
  return { key, text: new TextDecoder().decode(data.slice(cursor)) }
}

function decodeCardPayload(payload: string): unknown {
  const cleaned = payload.replace(/\s/g, '')
  const binary = atob(cleaned)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  const text = new TextDecoder().decode(bytes)
  try {
    return JSON.parse(text)
  } catch {
    const legacy = decodeURIComponent(escape(binary))
    return JSON.parse(legacy)
  }
}

export function parsePngCharacterCard(bytes: Uint8Array): CardDraft {
  const texts = readPngTexts(bytes)
  const payload = texts.ccv3 || texts.chara
  if (!payload) throw new Error('PNG 里没有 chara 数据')
  return parseCharacterCard(decodeCardPayload(payload))
}

export function looksLikeCharacter(raw: unknown): boolean {
  if (!isRecord(raw)) return false
  if (typeof raw.spec === 'string' && raw.spec.includes('chara')) return true
  if (Array.isArray(raw.prompts)) return false
  if (isRecord(raw.data) && Array.isArray(raw.data.prompts)) return false
  if (isRecord(raw.data) && typeof raw.data.name === 'string') return true
  return typeof raw.name === 'string' && ('personality' in raw || 'first_mes' in raw || 'description' in raw)
}
