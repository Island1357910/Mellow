import { AIAdapter } from '../engine/AIAdapter.ts'
import { storage } from '../storage/StorageService.ts'

export async function askLine(
  system: string,
  user: string,
  maxTokens = 180,
  timeoutMs = 120_000,
  temperature = 0.9,
): Promise<string> {
  const adapter = await AIAdapter.fromStored(await storage.readApi(), await storage.readApiKey())
  const result = await adapter.complete({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature,
    maxTokens,
    timeoutMs,
  })
  return result.content.trim()
}

/** 结构化 JSON 输出：低温、较长超时，适合文档/卡包整理 */
export function askJson(system: string, user: string, maxTokens = 8192, timeoutMs = 180_000): Promise<string> {
  return askLine(system, user, maxTokens, timeoutMs, 0.2)
}

export async function ensureAiReady(): Promise<void> {
  await AIAdapter.fromStored(await storage.readApi(), await storage.readApiKey())
}

function normalizeJsonQuotes(text: string): string {
  return text
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
}

function tryParseJsonSlice(text: string): unknown | undefined {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  const candidates = new Set<string>([trimmed, normalizeJsonQuotes(trimmed)])
  const arrayMatch = trimmed.match(/\[[\s\S]*\]/)
  if (arrayMatch?.[0]) candidates.add(normalizeJsonQuotes(arrayMatch[0]))
  const objectMatch = trimmed.match(/\{[\s\S]*\}/)
  if (objectMatch?.[0]) candidates.add(normalizeJsonQuotes(objectMatch[0]))

  const objectAt = trimmed.indexOf('{')
  const listAt = trimmed.indexOf('[')
  const useList = listAt >= 0 && (objectAt < 0 || listAt < objectAt)
  const open = useList ? listAt : objectAt
  if (open >= 0) {
    const end = trimmed.lastIndexOf(useList ? ']' : '}')
    if (end > open) candidates.add(normalizeJsonQuotes(trimmed.slice(open, end + 1)))
  }

  for (const candidate of candidates) {
    for (const attempt of [candidate, candidate.replace(/,\s*([}\]])/g, '$1')]) {
      try {
        return JSON.parse(attempt) as unknown
      } catch {
        // next candidate
      }
    }
  }
  return undefined
}

export function readJson(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('没有读出内容')

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const bodies = [...new Set([fenced?.[1]?.trim(), trimmed].filter(Boolean) as string[])]

  for (const body of bodies) {
    const parsed = tryParseJsonSlice(body)
    if (parsed !== undefined) return parsed
  }
  throw new Error('没有读出内容')
}

export function readJsonArray(text: string): unknown[] {
  const parsed = readJson(text)
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === 'object') {
    for (const key of ['posts', 'items', 'data', 'results', 'feed', 'list', 'comments']) {
      const val = (parsed as Record<string, unknown>)[key]
      if (Array.isArray(val)) return val
    }
    const row = parsed as { author?: unknown; text?: unknown; content?: unknown }
    if (typeof row.text === 'string' || typeof row.content === 'string') return [parsed]
  }
  throw new Error('没有读出帖子列表')
}
