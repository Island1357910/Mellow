import { AIError } from '../engine/AIAdapter.ts'
import { askJson, ensureAiReady, readJson } from './ask.ts'
import { collectDocBlocks, type DocBlock } from './structuredDocImport.ts'

const TEXT_LIMIT = 28_000
const CHUNK_SIZE = 3_000
const SINGLE_MAX_TOKENS = 2_048
const SKELETON_MAX_TOKENS = 1_200
const BLOCK_MAX_TOKENS = 1_200
const ENTRIES_MAX_TOKENS = 1_800
const SINGLE_TIMEOUT_MS = 90_000
const BATCH_TIMEOUT_MS = 60_000
const BLOCK_BATCH = 2
const BATCH_GAP_MS = 250

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

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

function nameFromFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/\(\d+\)$/, '').trim() || '未命名'
}

function readSkeleton(raw: unknown, fileName: string): CardSkeleton {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const data = row.data && typeof row.data === 'object' ? (row.data as Record<string, unknown>) : row
  const fallbackName = nameFromFileName(fileName)
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

function rowsFromBlocks(blocks: DocBlock[], charName: string): BookEntryRow[] {
  return blocks.map((block) => ({
    title: block.title,
    keys: [charName, block.title].filter(Boolean).join('，'),
    content: block.content,
  }))
}

function skeletonFromBlocks(blocks: DocBlock[], fileName: string): CardSkeleton {
  const charName = blocks.find((item) => item.subject)?.subject ?? nameFromFileName(fileName)
  const byTag = (tag: string) => blocks.find((item) => item.tag === tag)?.content ?? ''
  const traits = byTag('traits_sheet')
  const persona = byTag('persona_sheet')
  const appearance = byTag('appearance_notes')
  const world = byTag('world_entry')
  return {
    name: charName,
    description: [appearance, traits].filter(Boolean).join('\n\n').slice(0, 4000),
    personality: persona.slice(0, 1200) || traits.slice(0, 1200),
    scenario: world.slice(0, 2000) || byTag('setting_note').slice(0, 2000),
    first_mes: '',
    system_prompt: byTag('writing_style_guide').slice(0, 4000),
    post_history_instructions: byTag('chain_of_thought_guide').slice(0, 4000),
  }
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
必须保留原文全部设定。不要 creator_notes。只返回 JSON，不要解释。`,
    `文件名：${fileName}\n\n${text}`,
    SINGLE_MAX_TOKENS,
    SINGLE_TIMEOUT_MS,
  )
  return readJson(raw)
}

async function aiSkeleton(
  source: string,
  mode: 'auto' | 'character' | 'world',
  fileName: string,
): Promise<CardSkeleton> {
  const raw = await askJson(
    `你是角色卡整理器。阅读文档，提取角色卡主字段。
${modeHint(mode)}
保留原文细节。只返回 JSON：{"name":"","description":"","personality":"","scenario":"","first_mes":"","system_prompt":"","post_history_instructions":""}`,
    `文件名：${fileName}\n\n${source.slice(0, 4000)}`,
    SKELETON_MAX_TOKENS,
    BATCH_TIMEOUT_MS,
  )
  return readSkeleton(readJson(raw), fileName)
}

async function aiPolishBlocks(
  blocks: DocBlock[],
  charName: string,
  fileName: string,
  batchIndex: number,
  batchTotal: number,
): Promise<BookEntryRow[]> {
  const payload = blocks
    .map((block) => `【${block.title}】\n${block.content.slice(0, 2200)}`)
    .join('\n\n')
  const raw = await askJson(
    `你是角色卡整理器。把下列设定片段整理成 character_book 条目，保留全部原文细节，不要概括省略。
只返回 JSON：{"entries":[{"title":"","keys":"","content":""}]}`,
    `角色：${charName}\n文件：${fileName}\n批次：${batchIndex}/${batchTotal}\n\n${payload}`,
    BLOCK_MAX_TOKENS,
    BATCH_TIMEOUT_MS,
  )
  const rows = readEntryRows(readJson(raw))
  return rows.length > 0 ? rows : rowsFromBlocks(blocks, charName)
}

async function aiChunkEntries(
  chunk: string,
  fileName: string,
  charName: string,
  index: number,
  total: number,
): Promise<BookEntryRow[]> {
  const raw = await askJson(
    `从文档片段提取 character_book 条目，保留原文全部细节。
只返回 JSON：{"entries":[{"title":"","keys":"","content":""}]}`,
    `角色名：${charName}\n文件：${fileName}\n片段：${index}/${total}\n\n${chunk}`,
    ENTRIES_MAX_TOKENS,
    BATCH_TIMEOUT_MS,
  )
  return readEntryRows(readJson(raw))
}

/** 分段文档：每 1～2 个 XML 块一次 AI，请求大小接近聊天。 */
async function aiOrganizeFromBlocks(
  blocks: DocBlock[],
  mode: 'auto' | 'character' | 'world',
  fileName: string,
): Promise<unknown> {
  const charName = blocks.find((item) => item.subject)?.subject ?? nameFromFileName(fileName)
  const outline = blocks.map((block) => `- ${block.title}：${block.content.slice(0, 120)}`).join('\n')
  let skeleton: CardSkeleton
  try {
    skeleton = await aiSkeleton(outline, mode, fileName)
    if (!skeleton.name) skeleton.name = charName
  } catch {
    skeleton = skeletonFromBlocks(blocks, fileName)
  }

  const entries: BookEntryRow[] = []
  const batchTotal = Math.ceil(blocks.length / BLOCK_BATCH)
  for (let i = 0; i < blocks.length; i += BLOCK_BATCH) {
    if (i > 0) await pause(BATCH_GAP_MS)
    const batch = blocks.slice(i, i + BLOCK_BATCH)
    try {
      entries.push(...(await aiPolishBlocks(batch, skeleton.name, fileName, Math.floor(i / BLOCK_BATCH) + 1, batchTotal)))
    } catch {
      entries.push(...rowsFromBlocks(batch, skeleton.name))
    }
  }
  return buildCard(skeleton, entries)
}

/** AI 阅读文档并整理；结构化文档按段分批，长文按字符切片。 */
export async function aiOrganizeDocument(
  text: string,
  mode: 'auto' | 'character' | 'world',
  fileName: string,
  onProgress?: (message: string) => void,
): Promise<unknown> {
  await ensureAiReady()
  const clip = text.length > TEXT_LIMIT ? `${text.slice(0, TEXT_LIMIT)}\n…（后文已截）` : text
  let blocks: DocBlock[] = []
  try {
    blocks = collectDocBlocks(clip)
  } catch {
    blocks = []
  }

  if (blocks.length >= 2) {
    onProgress?.(`AI 整理中（${blocks.length} 段）…`)
    return aiOrganizeFromBlocks(blocks, mode, fileName)
  }

  const chunks = splitChunks(clip)
  if (chunks.length === 1 && clip.length <= 2_500) {
    onProgress?.('AI 整理中…')
    return aiSinglePass(chunks[0], mode, fileName)
  }

  onProgress?.(`AI 分批整理（${chunks.length} 段）…`)
  let skeleton: CardSkeleton
  try {
    skeleton = await aiSkeleton(chunks[0], mode, fileName)
  } catch {
    skeleton = { name: nameFromFileName(fileName), description: '', personality: '', scenario: '', first_mes: '', system_prompt: '', post_history_instructions: '' }
  }
  const entries: BookEntryRow[] = []
  for (let i = 0; i < chunks.length; i += 1) {
    if (i > 0) await pause(BATCH_GAP_MS)
    onProgress?.(`AI 整理第 ${i + 1}/${chunks.length} 段…`)
    try {
      entries.push(...(await aiChunkEntries(chunks[i], fileName, skeleton.name, i + 1, chunks.length)))
    } catch {
      entries.push({ title: `片段 ${i + 1}`, keys: skeleton.name, content: chunks[i] })
    }
  }
  if (entries.length === 0) throw new AIError('AI 没有整理出内容，请换模型后重试。', 'api')
  return buildCard(skeleton, entries)
}
