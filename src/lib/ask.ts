import { AIAdapter } from '../engine/AIAdapter.ts'
import { storage } from '../storage/StorageService.ts'

export async function askLine(system: string, user: string, maxTokens = 180): Promise<string> {
  const adapter = await AIAdapter.fromStored(await storage.readApi(), await storage.readApiKey())
  const result = await adapter.complete({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.9,
    maxTokens,
  })
  return result.content.trim()
}

export function readJson(text: string): unknown {
  const objectAt = text.indexOf('{')
  const listAt = text.indexOf('[')
  const useList = listAt >= 0 && (objectAt < 0 || listAt < objectAt)
  const open = useList ? listAt : objectAt
  const end = text.lastIndexOf(useList ? ']' : '}')
  if (open < 0 || end <= open) throw new Error('没有读出内容')
  return JSON.parse(text.slice(open, end + 1)) as unknown
}
