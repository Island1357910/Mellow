import { characterFromDraft } from '../domain/importing.ts'
import { importCharacterRegex } from '../engine/story.ts'
import { askLine, readJson } from './ask.ts'
import { parseCharacterCards, type CardDraft } from './sillytavern.ts'
import { writeWorld, readWorld, type WorldEntry } from './worldbook.ts'
import { uid } from './id.ts'
import { storage } from '../storage/StorageService.ts'
import type { Character, Identity } from '../types/index.ts'

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

function textOf(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function cardToPrompt(raw: unknown): string {
  if (typeof raw === 'string') return raw.slice(0, 12_000)
  return JSON.stringify(raw).slice(0, 12_000)
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
          tags: Array.isArray(c.tags) ? c.tags.filter((t): t is string => typeof t === 'string').slice(0, 8) : ['世界搭建'],
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

export async function forgeWorldFromCard(raw: unknown): Promise<ForgeResult> {
  const source = cardToPrompt(raw)
  try {
    const text = await askLine(
      `你是大世界卡拆分器。输入可能是一张 SillyTavern 卡、或多角色世界观 JSON。
请拆成：
1) 世界总设定条目（3～8 条，含时代、地理、势力、规则等）
2) 可单独游玩的角色卡（2～6 人），每人必须有完整 name、description、personality、scenario、firstMes、systemPrompt
不要解释。只返回 JSON：
{"worldTitle":"","worldSummary":"","worldEntries":[{"title":"","keys":"","content":""}],"characters":[{"name":"","description":"","personality":"","scenario":"","firstMes":"","mesExample":"","systemPrompt":"","creatorNotes":"","tags":[""],"note":""}]}`,
      source,
      2800,
    )
    const parsed = readForgeResult(readJson(text))
    if (!parsed || parsed.characters.length === 0) throw new Error('没拆出角色')
    return parsed
  } catch {
    return localForge(raw)
  }
}

function localForge(raw: unknown): ForgeResult {
  const drafts = parseCharacterCards(raw)
  if (drafts.length > 1) {
    return {
      worldTitle: drafts[0]?.scenario.slice(0, 24) || '多角色世界',
      worldSummary: drafts[0]?.description.slice(0, 120) || '',
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
    worldSummary: one.description.slice(0, 160),
    worldEntries: [
      { title: '总述', keys: one.name, content: one.description || one.scenario },
      ...(one.scenario ? [{ title: '情境', keys: '情境,世界', content: one.scenario }] : []),
    ],
    characters: [{ draft: one, note: '未能接 AI，仅保留原卡' }],
    local: true,
  }
}

export async function applyForgeResult(identity: Identity, result: ForgeResult): Promise<{ world: WorldEntry[]; characters: Character[] }> {
  const prev = await readWorld(identity.namespace)
  const stamped = Date.now()
  const worldRows: WorldEntry[] = [
    ...prev,
    {
      id: uid('lore'),
      title: result.worldTitle,
      keys: '世界,设定,背景',
      content: [result.worldSummary, ...result.worldEntries.map((e) => `【${e.title}】${e.content}`)].filter(Boolean).join('\n'),
      enabled: true,
      updatedAt: stamped,
      cardImport: true,
    },
    ...result.worldEntries.map((entry) => ({
      id: uid('lore'),
      title: entry.title,
      keys: entry.keys,
      content: entry.content,
      enabled: true,
      updatedAt: stamped,
      cardImport: true,
    })),
  ]
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
