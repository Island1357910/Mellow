import { AIError } from '../engine/AIAdapter.ts'
import { askJson, ensureAiReady, readJson } from './ask.ts'

const TEXT_LIMIT = 28_000
const CHUNK_SIZE = 5_500
const SINGLE_MAX_TOKENS = 4_096
const SKELETON_MAX_TOKENS = 1_800
const ENTRIES_MAX_TOKENS = 2_800
const SINGLE_TIMEOUT_MS = 120_000
const BATCH_TIMEOUT_MS = 90_000

interface CardSkeleton {
  name: string
  description: string
  personality: string
  scenario: string
  first_mes: string
  system_prompt: string
  post_history_instructions: string
}

interface BookEntryRow {
  title: string
  keys: string
  content: string
}

function splitChunks(text: string): string[] {
  if (text.length <= CHUNK_SIZE) return [text]
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    chunks.push(text.slice(i, i + CHUNK_SIZE))
  }
  return chunks
}

function textField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readSkeleton(raw: unknown, fileName: string): CardSkeleton {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const data = row.data && typeof row.data === 'object' ? (row.data as Record<string, unknown>) : row
  const fallbackName = fileName.replace(/\.[^.]+$/, '').replace(/\(\d+\)$/, '').trim()
  return {
    name: textField(data.name) || fallbackName || '未命名',
    description: textField(data.description),
    personality: textField(data.personality),
    scenario: textField(data.scenario),
    first_mes: textField(data.first_mes) || textField(data.firstMes),
    system_prompt: textField(data.system_prompt) || textField(data.systemPrompt),
    post_history_instructions: textField(data.post_history_instructions) || textField(data.postHistoryInstructions),
  }
}

function readEntryRows(raw: unknown): BookEntryRow[] {
  const root = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const list = Array.isArray(root.entries)
    ? root.entries
    : Array.isArray(root.character_book)
      ? root.character_book
      : root.data && typeof root.data === 'object' && Array.isArray((root.data as Record<string, unknown>).entries)
        ? ((root.data as Record<string, unknown>).entries as unknown[])
        : []
  return list
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const content = textField(row.content)
      if (!content) return null
      const keys = Array.isArray(row.keys)
        ? row.keys.filter((k): k is string => typeof k === 'string').join('，')
        : textField(row.keys)
      return {
        title: textField(row.title) || textField(row.comment) || textField(row.name) || keys.split('，')[0] || '设定',
        keys: keys || textField(row.title),
        content,
      }
    })
    .filter((item): item is BookEntryRow => Boolean(item))
}

function modeHint(mode: 'auto' | 'character' | 'world'): string {
  if (mode === 'world') {
    return '这是大世界/世界观文档。用 character_book.entries 承载全部世界规则与 NPC 档案，保留原文细节。'
  }
  if (mode === 'character') {
    return '这是单张角色卡文档。输出标准 SillyTavern 角色卡，保留全部人设细节。'
  }
  return '判断是单角色卡还是大世界卡：大世界则一张卡 + character_book 多条；单角色则标准角色卡。'
}

function buildCard(skeleton: CardSkeleton, entries: BookEntryRow[]): unknown {
  const bookEntries = entries.map((item, index) => ({
    id: index + 1,
    keys: item.keys ? item.keys.split(/[，,]/).map((k) => k.trim()).filter(Boolean) : [skeleton.name, item.title].filter(Boolean),
    content: item.content,
    comment: item.title,
    name: item.title,
    constant: index === 0,
    selective: true,
    order: index,
    enabled: true,
  }))
  return {
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: {
      name: skeleton.name,
      description: skeleton.description,
      personality: skeleton.personality,
      scenario: skeleton.scenario,
      first_mes: skeleton.first_mes,
      mes_example: '',
      creator_notes: '',
      system_prompt: skeleton.system_prompt,
      post_history_instructions: skeleton.post_history_instructions,
      tags: ['AI 整理'],
      character_book: bookEntries.length ? { name: skeleton.name, entries: bookEntries } : undefined,
      extensions: { aiCardImport: true },
    },
  }
}

async function aiSinglePass(text: string, mode: 'auto' | 'character' | 'world', fileName: string): Promise<unknown> {
  const raw = await askJson(
    `你是角色卡整理器。阅读用户文档，整理成可导入的 SillyTavern 角色卡 JSON（可有 spec/data 或直接 data/name）。
${modeHint(mode)}
必须保留原文全部设定，写入 description、personality、scenario、first_mes、character_book.entries 等，不要空壳、不要概括掉细节。
不要 creator_notes。只返回 JSON，不要解释。`,
    `文件名：${fileName}\n\n${text}`,
    SINGLE_MAX_TOKENS,
    SINGLE_TIMEOUT_MS,
  )
  return readJson(raw)
}

async function aiSkeleton(firstChunk: string, mode: 'auto' | 'character' | 'world', fileName: string): Promise<CardSkeleton> {
  const raw = await askJson(
    `你是角色卡整理器。阅读文档开头，提取角色卡主字段。
${modeHint(mode)}
保留原文细节，不要空壳。不要 creator_notes。
只返回 JSON：{"name":"","description":"","personality":"","scenario":"","first_mes":"","system_prompt":"","post_history_instructions":""}`,
    `文件名：${fileName}\n\n${firstChunk}`,
    SKELETON_MAX_TOKENS,
    BATCH_TIMEOUT_MS,
  )
  return readSkeleton(readJson(raw), fileName)
}

async function aiChunkEntries(
  chunk: string,
  fileName: string,
  charName: string,
  index: number,
  total: number,
): Promise<BookEntryRow[]> {
  const raw = await askJson(
    `你是角色卡整理器。从文档片段提取 world book / character_book 条目，保留原文全部细节，不要概括成空壳。
每条 entry 对应文档里的一段设定（世界观、外貌、性格、互动规则等）。
只返回 JSON：{"entries":[{"title":"","keys":"","content":""}]}`,
    `角色名：${charName}\n文件：${fileName}\n片段：${index}/${total}\n\n${chunk}`,
    ENTRIES_MAX_TOKENS,
    BATCH_TIMEOUT_MS,
  )
  return readEntryRows(readJson(raw))
}

/** AI 阅读文档并整理成 SillyTavern JSON；长文自动分批，降低 Failed to fetch 概率。 */
export async function aiOrganizeDocument(
  text: string,
  mode: 'auto' | 'character' | 'world',
  fileName: string,
): Promise<unknown> {
  await ensureAiReady()
  const clip = text.length > TEXT_LIMIT ? `${text.slice(0, TEXT_LIMIT)}\n…（后文已截）` : text
  const chunks = splitChunks(clip)

  if (chunks.length === 1) {
    try {
      return await aiSinglePass(chunks[0], mode, fileName)
    } catch (error) {
      if (!(error instanceof AIError) || error.code !== 'network') throw error
    }
  }

  const skeleton = await aiSkeleton(chunks[0], mode, fileName)
  const entries: BookEntryRow[] = []
  for (let i = 0; i < chunks.length; i += 1) {
    const rows = await aiChunkEntries(chunks[i], fileName, skeleton.name, i + 1, chunks.length)
    entries.push(...rows)
  }
  if (entries.length === 0) throw new AIError('AI 没有整理出世界书条目，请换模型或缩短文档后重试。', 'api')
  return buildCard(skeleton, entries)
}
