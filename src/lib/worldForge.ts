import { characterFromDraft } from '../domain/importing.ts'
import { importCharacterRegex } from '../engine/story.ts'
import { askLine, readJson } from './ask.ts'
import { loreEntries, parseCharacterCard, type CardDraft } from './sillytavern.ts'
import { writeWorld, readWorld, type WorldEntry } from './worldbook.ts'
import { uid } from './id.ts'
import { storage } from '../storage/StorageService.ts'
import type { Character, Identity, LorebookEntry } from '../types/index.ts'

export interface ForgedCharacter {
  draft: CardDraft
  note: string
}

export interface ForgeResult {
  worldTitle: string
  worldSummary: string
  worldEntries: Array<{ title: string; keys: string; content: string }>
  characters: ForgedCharacter[]
  local?: boolean
}

const NPC_TAG_RE = /<(romanceable_npc|friendship_npc|friend_npc|town_npc)\s+name="([^"]+)"/i

function textOf(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function keysToString(keys?: string[]): string {
  return (keys ?? []).map((key) => key.trim()).filter(Boolean).join('，')
}

function entryTitle(entry: LorebookEntry): string {
  const comment = entry.comment?.trim()
  if (comment) return comment
  const name = entry.name?.trim()
  if (name) return name
  const keys = keysToString(entry.keys)
  if (keys) return keys.split('，')[0] ?? keys
  return entry.constant ? '常驻设定' : '设定'
}

function npcNameFromEntry(entry: LorebookEntry): string | null {
  const match = entry.content.match(NPC_TAG_RE)
  if (match?.[2]) return match[2].trim()
  return null
}

function extractPersonality(content: string): string {
  const match = content.match(/性格:\s*\|\s*\n\s*([\s\S]*?)(?:\n\s*\n|\n\s*说话风格:)/)
  return match?.[1]?.trim() ?? ''
}

function npcDraftFromEntry(
  entry: LorebookEntry,
  name: string,
  worldTitle: string,
  worldTag: string,
): CardDraft {
  const content = entry.content.trim()
  return {
    name,
    avatar: '',
    description: content,
    personality: extractPersonality(content),
    scenario: worldTitle,
    firstMes: '',
    mesExample: '',
    creatorNotes: `来自大世界卡「${worldTitle}」`,
    systemPrompt: '',
    postHistoryInstructions: '',
    alternateGreetings: [],
    tags: ['世界搭建', worldTag],
    creator: 'worldforge',
    characterVersion: '1.0.0',
    characterBook: { name, entries: [entry] },
    extensions: { worldforge: true, sourceWorld: worldTitle },
    rawCard: null,
  }
}

function worldHostDraft(draft: CardDraft, npcCount: number, worldCount: number, worldTag: string): CardDraft {
  return {
    ...draft,
    tags: Array.from(new Set([...draft.tags, '世界主控', '世界搭建', worldTag])),
    creatorNotes:
      draft.creatorNotes.trim() ||
      `大世界主卡。已拆出 ${npcCount} 位角色、${worldCount} 条世界设定。`,
    characterBook: null,
  }
}

/** 从 character_book 全量本地拆分，不截断、不限人数。 */
function localParseWorldCard(raw: unknown): ForgeResult | null {
  let draft: CardDraft
  try {
    draft = parseCharacterCard(raw)
  } catch {
    return null
  }
  const entries = loreEntries(draft.characterBook)
  if (entries.length === 0) return null

  const worldTitle = draft.name
  const worldTag = worldTitle.slice(0, 16)
  const worldEntries: ForgeResult['worldEntries'] = []
  const npcCharacters: ForgedCharacter[] = []

  for (const entry of entries) {
    const content = entry.content?.trim()
    if (!content) continue
    const npcName = npcNameFromEntry(entry)
    if (npcName) {
      npcCharacters.push({
        draft: npcDraftFromEntry(entry, npcName, worldTitle, worldTag),
        note: '世界书档案拆出',
      })
      continue
    }
    worldEntries.push({
      title: entryTitle(entry),
      keys: keysToString(entry.keys),
      content,
    })
  }

  const summaryParts = [draft.description, draft.scenario].map((part) => part.trim()).filter(Boolean)
  const worldSummary =
    summaryParts.join('\n\n') ||
    `来自「${worldTitle}」，含 ${worldEntries.length} 条世界设定、${npcCharacters.length} 位角色档案。`

  const characters: ForgedCharacter[] = [
    {
      draft: worldHostDraft(draft, npcCharacters.length, worldEntries.length, worldTag),
      note: '世界主卡（含开场与正则）',
    },
    ...npcCharacters,
  ]

  return { worldTitle, worldSummary, worldEntries, characters, local: true }
}

function parseAllCharacterCards(raw: unknown): CardDraft[] {
  if (Array.isArray(raw)) {
    if (raw.length === 0) throw new Error('文件里没有角色卡')
    return raw.map((item) => parseCharacterCard(item))
  }
  return [parseCharacterCard(raw)]
}

function readForgeResult(raw: unknown): ForgeResult | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const characters = Array.isArray(row.characters)
    ? row.characters.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const c = item as Record<string, unknown>
        const name = textOf(c.name)
        if (!name) return []
        const draft: CardDraft = {
          name,
          avatar: '',
          description: textOf(c.description),
          personality: textOf(c.personality),
          scenario: textOf(c.scenario),
          firstMes: textOf(c.firstMes),
          mesExample: textOf(c.mesExample),
          creatorNotes: textOf(c.creatorNotes) || textOf(c.note),
          systemPrompt: textOf(c.systemPrompt),
          postHistoryInstructions: textOf(c.postHistoryInstructions),
          alternateGreetings: [],
          tags: Array.isArray(c.tags) ? c.tags.filter((t): t is string => typeof t === 'string') : ['世界搭建'],
          creator: 'worldforge',
          characterVersion: '1.0.0',
          characterBook: null,
          extensions: { worldforge: true },
          rawCard: null,
        }
        return [{ draft, note: textOf(c.note) || '从大世界卡拆出' }]
      })
    : []
  const worldEntries = Array.isArray(row.worldEntries)
    ? row.worldEntries.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const e = item as Record<string, unknown>
        const content = textOf(e.content)
        if (!content) return []
        return [{ title: textOf(e.title) || '设定', keys: textOf(e.keys), content }]
      })
    : []
  if (characters.length === 0 && worldEntries.length === 0) return null
  return {
    worldTitle: textOf(row.worldTitle) || '未命名世界',
    worldSummary: textOf(row.worldSummary),
    worldEntries,
    characters,
  }
}

function cardToPrompt(raw: unknown): string {
  if (typeof raw === 'string') return raw
  return JSON.stringify(raw)
}

function localForge(raw: unknown): ForgeResult {
  const drafts = parseAllCharacterCards(raw)
  if (drafts.length > 1) {
    return {
      worldTitle: drafts[0]?.scenario.slice(0, 24) || drafts[0]?.name || '多角色世界',
      worldSummary: drafts[0]?.description || '',
      worldEntries: drafts[0]?.scenario
        ? [{ title: '世界观', keys: '世界,设定', content: drafts[0].scenario }]
        : [],
      characters: drafts.map((draft) => ({ draft, note: '卡包内自带多角色' })),
      local: true,
    }
  }
  const one = drafts[0]
  if (!one) throw new Error('不是有效的角色卡或世界卡')
  return {
    worldTitle: one.name,
    worldSummary: one.description || one.scenario,
    worldEntries: [
      ...(one.description ? [{ title: '总述', keys: one.name, content: one.description }] : []),
      ...(one.scenario ? [{ title: '情境', keys: '情境,世界', content: one.scenario }] : []),
    ],
    characters: [{ draft: one, note: '无 character_book，保留原卡' }],
    local: true,
  }
}

async function aiForge(raw: unknown): Promise<ForgeResult> {
  const source = cardToPrompt(raw)
  const text = await askLine(
    `你是大世界卡拆分器。输入可能是一张 SillyTavern 卡、或多角色世界观 JSON。
请拆成：
1) 世界总设定条目（有多少写多少，含时代、地理、势力、规则等，保留原文细节）
2) 可单独游玩的角色卡（有多少写多少），每人必须有完整 name、description、personality、scenario、firstMes、systemPrompt
不要解释、不要省略条目。只返回 JSON：
{"worldTitle":"","worldSummary":"","worldEntries":[{"title":"","keys":"","content":""}],"characters":[{"name":"","description":"","personality":"","scenario":"","firstMes":"","mesExample":"","systemPrompt":"","creatorNotes":"","tags":[""],"note":""}]}`,
    source,
    16_000,
  )
  const parsed = readForgeResult(readJson(text))
  if (!parsed || parsed.characters.length === 0) throw new Error('没拆出角色')
  return parsed
}

export async function forgeWorldFromCard(raw: unknown): Promise<ForgeResult> {
  const parsed = localParseWorldCard(raw)
  if (parsed) return parsed
  try {
    return await aiForge(raw)
  } catch {
    return localForge(raw)
  }
}

export async function applyForgeResult(identity: Identity, result: ForgeResult): Promise<{ world: WorldEntry[]; characters: Character[] }> {
  const prev = await readWorld(identity.namespace)
  const stamped = Date.now()
  const worldRows: WorldEntry[] = [...prev]

  if (result.worldSummary.trim()) {
    worldRows.push({
      id: uid('lore'),
      title: `${result.worldTitle} · 总述`,
      keys: result.worldTitle,
      content: result.worldSummary.trim(),
      enabled: true,
      updatedAt: stamped,
      cardImport: true,
    })
  }

  for (const entry of result.worldEntries) {
    worldRows.push({
      id: uid('lore'),
      title: entry.title,
      keys: entry.keys,
      content: entry.content,
      enabled: true,
      updatedAt: stamped,
      cardImport: true,
    })
  }
  await writeWorld(identity.namespace, worldRows)

  const characters: Character[] = []
  for (const item of result.characters) {
    const draft: CardDraft = {
      ...item.draft,
      tags: Array.from(new Set([...item.draft.tags, '世界搭建'])),
      scenario: item.draft.scenario || result.worldSummary || result.worldTitle,
    }
    const character = await characterFromDraft(identity.namespace, draft)
    await importCharacterRegex(identity.namespace, character)
    characters.push(character)
  }

  await storage.setBag(identity.namespace, 'worldforge_last', { result, at: stamped })
  return { world: worldRows, characters }
}
