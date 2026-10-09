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
const AI_BATCH_SIZE = 5

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

function hasCharacterSettings(draft: CardDraft): boolean {
  return draft.description.trim().length > 40 || draft.personality.trim().length > 20
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
    creatorNotes: '',
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

/** 从 character_book 全量本地拆分结构，不导入世界主卡。 */
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
  const characters: ForgedCharacter[] = []

  for (const entry of entries) {
    const content = entry.content?.trim()
    if (!content) continue
    const npcName = npcNameFromEntry(entry)
    if (npcName) {
      characters.push({
        draft: npcDraftFromEntry(entry, npcName, worldTitle, worldTag),
        note: '待 AI 整理设定',
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
  const worldSummary = summaryParts.join('\n\n')

  return { worldTitle, worldSummary, worldEntries, characters, local: true }
}

function parseAllCharacterCards(raw: unknown): CardDraft[] {
  if (Array.isArray(raw)) {
    if (raw.length === 0) throw new Error('文件里没有角色卡')
    return raw.map((item) => parseCharacterCard(item))
  }
  return [parseCharacterCard(raw)]
}

function draftFromAiRow(c: Record<string, unknown>, worldTitle: string): CardDraft | null {
  const name = textOf(c.name)
  if (!name) return null
  return {
    name,
    avatar: '',
    description: textOf(c.description),
    personality: textOf(c.personality),
    scenario: textOf(c.scenario) || worldTitle,
    firstMes: textOf(c.firstMes),
    mesExample: textOf(c.mesExample),
    creatorNotes: '',
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
}

function readForgeResult(raw: unknown): ForgeResult | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const worldTitle = textOf(row.worldTitle) || '未命名世界'
  const characters = Array.isArray(row.characters)
    ? row.characters.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const draft = draftFromAiRow(item as Record<string, unknown>, worldTitle)
        if (!draft) return []
        return [{ draft, note: textOf((item as Record<string, unknown>).note) || '从大世界卡拆出' }]
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
    worldTitle,
    worldSummary: textOf(row.worldSummary),
    worldEntries,
    characters,
  }
}

function readAiCharacterBatch(raw: unknown, worldTitle: string): Map<string, CardDraft> {
  const map = new Map<string, CardDraft>()
  const parsed = readForgeResult(raw)
  if (parsed) {
    for (const item of parsed.characters) map.set(item.draft.name, item.draft)
    return map
  }
  if (!Array.isArray(raw)) return map
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const draft = draftFromAiRow(item as Record<string, unknown>, worldTitle)
    if (draft) map.set(draft.name, draft)
  }
  return map
}

function mergeNpcDraft(local: CardDraft, ai: CardDraft | undefined, worldTitle: string): CardDraft {
  if (!ai) return { ...local, creatorNotes: '' }
  return {
    ...local,
    description: ai.description || local.description,
    personality: ai.personality || local.personality,
    scenario: ai.scenario || local.scenario || worldTitle,
    firstMes: ai.firstMes || local.firstMes,
    mesExample: ai.mesExample || local.mesExample,
    systemPrompt: ai.systemPrompt || local.systemPrompt,
    postHistoryInstructions: ai.postHistoryInstructions || local.postHistoryInstructions,
    creatorNotes: '',
    tags: ai.tags.length ? Array.from(new Set([...ai.tags, ...local.tags])) : local.tags,
  }
}

async function aiEnrichCharacters(parsed: ForgeResult): Promise<ForgeResult> {
  if (parsed.characters.length === 0) return { ...parsed, local: false }

  const enriched: ForgedCharacter[] = []
  let usedFallback = false

  for (let i = 0; i < parsed.characters.length; i += AI_BATCH_SIZE) {
    const batch = parsed.characters.slice(i, i + AI_BATCH_SIZE)
    const payload = batch.map((item) => ({
      name: item.draft.name,
      rawContent: item.draft.description,
      keys: keysToString(loreEntries(item.draft.characterBook)[0]?.keys),
    }))

    let aiMap = new Map<string, CardDraft>()
    try {
      const text = await askLine(
        `你是角色卡整理器。根据 character_book 原文，为每位 NPC 输出完整、可单独聊天的角色字段。
要求：
- description 必须保留原文全部人设细节（身份、背景、说话风格、礼物偏好、剧情钩子等），不能省略或概括成空壳
- personality 写可扮演性格要点
- scenario 写该角色所在的世界观情境
- firstMes 写符合人设的一句开场白
- systemPrompt 写输出约束（不要替玩家发言等）
- 不要 creatorNotes，不要解释
只返回 JSON：
{"characters":[{"name":"","description":"","personality":"","scenario":"","firstMes":"","mesExample":"","systemPrompt":"","tags":[""]}]}`,
        `世界名：${parsed.worldTitle}\n\n${JSON.stringify(payload)}`,
        16_000,
      )
      aiMap = readAiCharacterBatch(readJson(text), parsed.worldTitle)
    } catch {
      usedFallback = true
    }

    for (const item of batch) {
      const merged = mergeNpcDraft(item.draft, aiMap.get(item.draft.name), parsed.worldTitle)
      const ok = hasCharacterSettings(merged)
      if (!ok) usedFallback = true
      enriched.push({
        draft: merged,
        note: ok ? 'AI 已整理设定' : '保留原文设定',
      })
    }
  }

  return { ...parsed, characters: enriched, local: usedFallback }
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
      characters: drafts.map((draft) => ({
        draft: { ...draft, creatorNotes: '' },
        note: '卡包内自带多角色',
      })),
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
    characters: [{ draft: { ...one, creatorNotes: '' }, note: '无 character_book，保留原卡' }],
    local: true,
  }
}

async function aiForge(raw: unknown): Promise<ForgeResult> {
  const source = cardToPrompt(raw)
  const text = await askLine(
    `你是大世界卡拆分器。输入可能是一张 SillyTavern 卡、或多角色世界观 JSON。
请拆成：
1) 世界总设定条目（有多少写多少，含时代、地理、势力、规则等，保留原文细节）
2) 可单独游玩的 NPC 角色卡（有多少写多少），每人必须有完整 name、description、personality、scenario、firstMes、systemPrompt
不要导入世界主卡本身为角色。不要 creatorNotes。不要解释、不要省略条目。只返回 JSON：
{"worldTitle":"","worldSummary":"","worldEntries":[{"title":"","keys":"","content":""}],"characters":[{"name":"","description":"","personality":"","scenario":"","firstMes":"","mesExample":"","systemPrompt":"","tags":[""],"note":""}]}`,
    source,
    16_000,
  )
  const parsed = readForgeResult(readJson(text))
  if (!parsed || parsed.characters.length === 0) throw new Error('没拆出角色')
  return {
    ...parsed,
    characters: parsed.characters.map((item) => ({
      ...item,
      draft: { ...item.draft, creatorNotes: '' },
    })),
  }
}

function dropWorldHostCharacter(result: ForgeResult): ForgeResult {
  const host = result.worldTitle.trim()
  if (!host) return result
  return {
    ...result,
    characters: result.characters.filter((item) => item.draft.name.trim() !== host),
  }
}

export async function forgeWorldFromCard(raw: unknown): Promise<ForgeResult> {
  const local = localParseWorldCard(raw)
  if (local) {
    try {
      return dropWorldHostCharacter(await aiEnrichCharacters(local))
    } catch {
      return dropWorldHostCharacter(local)
    }
  }
  try {
    return dropWorldHostCharacter(await aiForge(raw))
  } catch {
    return dropWorldHostCharacter(localForge(raw))
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
      creatorNotes: '',
      tags: Array.from(new Set([...item.draft.tags, '世界搭建'])),
      scenario: item.draft.scenario || result.worldTitle,
    }
    const character = await characterFromDraft(identity.namespace, draft)
    await importCharacterRegex(identity.namespace, character)
    characters.push(character)
  }

  await storage.setBag(identity.namespace, 'worldforge_last', { result, at: stamped })
  return { world: worldRows, characters }
}
