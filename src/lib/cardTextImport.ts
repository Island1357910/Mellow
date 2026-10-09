import { askLine, readJson } from './ask.ts'
import { readDocxFile } from './docxText.ts'
import { parsePngCharacterCard } from './sillytavern.ts'

const TEXT_NAME = /\.(txt|md|text|doc|docx)$/i

export function cardImportAccept(): string {
  return 'application/json,.json,image/png,.png,text/plain,.txt,.md,.text,.doc,.docx'
}

async function readDocText(file: File): Promise<string> {
  const raw = await file.text()
  const cleaned = raw.replace(/[^\u0020-\u007e\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim()
  if (cleaned.length > 80) return cleaned
  throw new Error('旧版 .doc 读不出来，请另存为 .txt 再导入')
}

export async function readDocumentText(file: File): Promise<string> {
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.docx')) return readDocxFile(file)
  if (lower.endsWith('.doc')) return readDocText(file)
  return file.text()
}

function isTextLike(file: File): boolean {
  const lower = file.name.toLowerCase()
  if (TEXT_NAME.test(lower)) return true
  if (file.type.startsWith('text/')) return true
  return false
}

function isJsonLike(file: File): boolean {
  const lower = file.name.toLowerCase()
  return lower.endsWith('.json') || file.type === 'application/json'
}

function isPngLike(file: File): boolean {
  const lower = file.name.toLowerCase()
  return lower.endsWith('.png') || file.type === 'image/png'
}

async function aiTextToCardJson(text: string, mode: 'auto' | 'character' | 'world', fileName: string): Promise<unknown> {
  const clip = text.length > 120_000 ? `${text.slice(0, 120_000)}\n…（后文已截）` : text
  const kindHint =
    mode === 'world'
      ? '这是大世界/世界观文档。请输出一张 SillyTavern V3 角色卡 JSON，用 character_book.entries 承载全部世界规则与 NPC 档案，保留原文细节。'
      : mode === 'character'
        ? '这是单张角色卡文档。请输出 SillyTavern V2/V3 角色卡 JSON，保留全部人设细节。'
        : '判断是单角色卡还是大世界卡：大世界则一张卡 + character_book 多条；单角色则标准角色卡。'
  const raw = await askLine(
    `你是角色卡整理器。把用户文档转成可导入的 SillyTavern 角色卡 JSON（可有 spec/data 或直接 data/name 字段）。
${kindHint}
必须保留原文全部设定，写入 description、personality、scenario、first_mes、character_book 等，不要空壳。
不要 creator_notes。只返回 JSON，不要解释。`,
    `文件名：${fileName}\n\n${clip}`,
    16_000,
  )
  return readJson(raw)
}

/** 读取 JSON / PNG / txt·doc·docx，文本类经 AI 整理成 SillyTavern JSON。 */
export async function resolveImportJson(
  file: File,
  mode: 'auto' | 'character' | 'world' = 'auto',
): Promise<unknown> {
  if (isPngLike(file)) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const draft = parsePngCharacterCard(bytes)
    return {
      spec: 'chara_card_v2',
      spec_version: '2.0',
      data: {
        name: draft.name,
        description: draft.description,
        personality: draft.personality,
        scenario: draft.scenario,
        first_mes: draft.firstMes,
        mes_example: draft.mesExample,
        creator_notes: '',
        system_prompt: draft.systemPrompt,
        post_history_instructions: draft.postHistoryInstructions,
        alternate_greetings: draft.alternateGreetings,
        tags: draft.tags,
        creator: draft.creator,
        character_version: draft.characterVersion,
        character_book: draft.characterBook,
        extensions: draft.extensions,
      },
    }
  }
  if (isJsonLike(file)) {
    return JSON.parse(await file.text()) as unknown
  }
  if (isTextLike(file)) {
    const text = await readDocumentText(file)
    if (!text.trim()) throw new Error('文件是空的')
    return aiTextToCardJson(text, mode, file.name)
  }
  try {
    return JSON.parse(await file.text()) as unknown
  } catch {
    const text = await readDocumentText(file)
    if (!text.trim()) throw new Error('认不出文件格式')
    return aiTextToCardJson(text, mode, file.name)
  }
}
