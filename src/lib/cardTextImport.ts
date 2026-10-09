import { aiOrganizeDocument } from './aiCardImport.ts'
import { readDocxFile } from './docxText.ts'
import { parsePngCharacterCard } from './sillytavern.ts'
import { plainTextCardJson, tryParseStructuredDoc } from './structuredDocImport.ts'

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

function localFallbackCard(text: string, fileName: string, reason?: string): unknown {
  const card = tryParseStructuredDoc(text) ?? plainTextCardJson(text, fileName)
  if (!card || typeof card !== 'object') return card
  const row = card as { data?: Record<string, unknown> }
  if (row.data) {
    row.data.extensions = {
      ...(typeof row.data.extensions === 'object' ? (row.data.extensions as object) : {}),
      importFallback: reason ?? 'local',
    }
  }
  return card
}

async function textToCardJson(
  text: string,
  mode: 'auto' | 'character' | 'world',
  fileName: string,
  onProgress?: (message: string) => void,
): Promise<{ card: unknown; via: 'ai' | 'local' }> {
  try {
    const card = await aiOrganizeDocument(text, mode, fileName, onProgress)
    return { card, via: 'ai' }
  } catch (error) {
    onProgress?.('AI 不可用，改用本地解析…')
    return { card: localFallbackCard(text, fileName, error instanceof Error ? error.message : 'ai-failed'), via: 'local' }
  }
}

/** 读取 JSON / PNG / txt·doc·docx；文本类由 AI 阅读整理，失败时尝试本地结构化解析。 */
export async function resolveImportJson(
  file: File,
  mode: 'auto' | 'character' | 'world' = 'auto',
  onProgress?: (message: string) => void,
): Promise<{ card: unknown; via: 'ai' | 'local' | 'raw' }> {
  if (isPngLike(file)) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const draft = parsePngCharacterCard(bytes)
    return {
      card: {
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
    },
      via: 'raw',
    }
  }
  if (isJsonLike(file)) {
    return { card: JSON.parse(await file.text()) as unknown, via: 'raw' }
  }
  if (isTextLike(file)) {
    const text = await readDocumentText(file)
    if (!text.trim()) throw new Error('文件是空的')
    return textToCardJson(text, mode, file.name, onProgress)
  }
  try {
    return { card: JSON.parse(await file.text()) as unknown, via: 'raw' }
  } catch {
    const text = await readDocumentText(file)
    if (!text.trim()) throw new Error('认不出文件格式')
    return textToCardJson(text, mode, file.name, onProgress)
  }
}
