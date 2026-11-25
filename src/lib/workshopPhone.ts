import type { Character, ChatMessage } from '../types/index.ts'
import { storage } from '../storage/StorageService.ts'
import { workshop, type PublicWork } from './workshop.ts'

export type WorkshopPhoneChannel = 'sms' | 'offline' | 'side'
const appliedWorksKey = 'workshop_applied_works'
type Line = { role: string; content: string; hidden?: boolean; workshopReply?: ChatMessage['workshopReply'] }
type Turn = { role: 'user'; content: string } | { role: 'assistant'; content: string; receipt: string }

export function workshopWorkOf(character?: Character) {
  const value = character?.extensions?.workshopWorkId
  return typeof value === 'string' && value ? value : undefined
}

export async function readAppliedWorkshopWorks(namespace: string): Promise<string[]> {
  return await storage.getBag<string[]>(namespace, appliedWorksKey) ?? []
}

export async function setWorkshopWorkApplied(namespace: string, workId: string, applied: boolean) {
  const result = await storage.changeAppBags(namespace, [appliedWorksKey], bags => {
    const ids = new Set(bags[appliedWorksKey] as string[] | null)
    if (applied) ids.add(workId)
    else ids.delete(workId)
    return { [appliedWorksKey]: Array.from(ids) }
  })
  return result[appliedWorksKey] as string[]
}

export async function playInWorkshopPhone(input: {
  namespace: string; workId: string; channel: WorkshopPhoneChannel; history: Line[]; action?: string; cast?: string[]; signal?: AbortSignal
}) {
  const { workId, channel, history, action, cast, signal } = input
  const messages = history.filter(row => !row.hidden && row.content.trim()).flatMap<Turn>(row => {
    if (row.role === 'user') return [{ role: 'user', content: row.content.slice(0, 8000) }]
    if (row.role === 'assistant' && row.workshopReply?.workId === workId && row.content.length <= 8000) {
      return [{ role: 'assistant', content: row.content, receipt: row.workshopReply.receipt }]
    }
    return []
  }).slice(-22)
  if (action?.trim() || messages.at(-1)?.role !== 'user') {
    messages.push({ role: 'user', content: action?.trim().slice(0, 8000) || '请继续当前情节。' })
  }
  while (JSON.stringify(messages).length > 45_000) messages.shift()
  const [library, applied] = await Promise.all([
    workshop<PublicWork[]>('/library', 'GET', undefined, signal),
    readAppliedWorkshopWorks(input.namespace),
  ])
  const work = library.find(item => item.id === workId && item.type === 'character')
  if (!work) throw new Error('此作品已下架或已从书架移除。')
  const dlc = library.filter(item => item.type === 'dlc' && item.enabled && !item.display.app && applied.includes(item.id)).slice(0, 4).map(item => item.id)
  const result = await workshop<{ reply: string; receipt: string }>(
    '/play/' + encodeURIComponent(workId) + '/protected', 'POST', { channel, messages, dlc, cast }, signal,
  )
  return { text: result.reply, workshopReply: { workId, receipt: result.receipt } }
}
