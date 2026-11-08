import { AIAdapter } from '../engine/AIAdapter.ts'
import { storage } from '../storage/StorageService.ts'
import type { ApiProfile } from '../types/index.ts'
import type { ApiModuleId } from './apiModules.ts'

export async function moduleAdapter(moduleId?: ApiModuleId, expected?: Pick<ApiProfile, 'id' | 'model' | 'endpoint'>): Promise<AIAdapter> {
  const profile = moduleId ? await storage.readModuleApi(moduleId) : await storage.readApi()
  if (expected && (profile?.id !== expected.id || profile.model !== expected.model || profile.endpoint !== expected.endpoint)) {
    throw new Error('接口或模型设置已更改，请重新打开应用。')
  }
  const settings = await storage.getSettings()
  const adapter = await AIAdapter.fromStored(profile, profile ? await storage.readApiKey(profile.id) : '', settings.generation)
  const complete = adapter.complete.bind(adapter)
  adapter.complete = async request => {
    const response = await complete(request)
    if (response.truncated) {
      try {
        const { useMellow } = await import('../store/useMellow.ts')
        await useMellow.getState().pushNotice({ kind: 'toast', title: '回复尚未完整', body: '已保留收到的正文，自动补全未完成。可以继续生成，或到 API 设置增加输出额度。', appId: moduleId ?? 'settings', identityId: settings.activeIdentityId, priority: 3 })
      } catch { /* A notification failure must not discard the preserved answer. */ }
    }
    return response
  }
  return adapter
}

/** 在调用入口明确归属，不依赖当前屏幕，后台及并发请求也使用自己的配置。 */
export function moduleAi(moduleId: ApiModuleId) {
  return {
    askLine: (system: string, user: string, maxTokens = 180, timeoutMs = 120_000, temperature = 0.9) =>
      askLine(system, user, maxTokens, timeoutMs, temperature, moduleId),
    askJson: (system: string, user: string, maxTokens = 8192, timeoutMs = 180_000) =>
      askLine(system, user, maxTokens, timeoutMs, 0.2, moduleId),
    ensureAiReady: async () => { await moduleAdapter(moduleId) },
  }
}

export async function askLine(
  system: string,
  user: string,
  maxTokens = 180,
  timeoutMs = 120_000,
  temperature = 0.9,
  moduleId?: ApiModuleId,
): Promise<string> {
  const adapter = await moduleAdapter(moduleId)
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
