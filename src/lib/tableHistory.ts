import { storage } from '../storage/StorageService.ts'
import { uid } from './id.ts'
import { readJson } from './ask.ts'

export type TableEntry = { id: string; at: number; kind: 'event' | 'player' | 'speech'; text: string; speaker?: string }
export type TableRecord = { id: string; game: string; names: string[]; startedAt: number; endedAt?: number; result?: string; entries: TableEntry[] }
export type TableSummary = Omit<TableRecord, 'entries'>
export const TABLE_HISTORY_INDEX = 'table_history_index'
const recordKey = (id: string) => 'table_history_record_' + id

/** Atomic append prevents a slow reply from overwriting newer moves. Never prune a saved match. */
export async function appendTableHistory(namespace: string, session: TableSummary, entries: TableEntry[], result?: string) {
  await storage.changeAppBags(namespace, [TABLE_HISTORY_INDEX, recordKey(session.id)], bags => {
    const previous = bags[recordKey(session.id)] as TableRecord | undefined
    const record: TableRecord = { ...session, ...previous, entries: [...(previous?.entries ?? []), ...entries.filter(entry => !previous?.entries.some(old => old.id === entry.id))] }
    if (result) { record.result = result; record.endedAt = Date.now() }
    else if (result === '') { delete record.result; delete record.endedAt }
    const { entries: _, ...summary } = record
    const index = (bags[TABLE_HISTORY_INDEX] as TableSummary[] | undefined) ?? []
    return { [recordKey(session.id)]: record, [TABLE_HISTORY_INDEX]: [summary, ...index.filter(item => item.id !== session.id)].sort((a, b) => b.startedAt - a.startedAt) }
  })
}
export async function listTableHistory(namespace: string) { return await storage.getBag<TableSummary[]>(namespace, TABLE_HISTORY_INDEX) ?? [] }
export function readTableHistory(namespace: string, id: string) { return storage.getBag<TableRecord>(namespace, recordKey(id)) }
export function tableEntry(kind: TableEntry['kind'], text: string, speaker?: string): TableEntry { return { id: uid('table_line'), at: Date.now(), kind, text, speaker } }

export function cleanTableSpeech(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/\*[^*]*\*/g, '')
    .replace(/（[^）]*）|\([^)]*\)|\[[^\]]*\]|【[^】]*】/g, '')
    .trim().replace(/^[“「"]|[”」"]$/g, '').trim()
}
/** Only display spoken text from named seats; never render model narration. */
export function parseTableSpeech(raw: string, names: string[]): Array<{ speaker: string; text: string }> {
  let parsed: unknown = null
  try { parsed = readJson(raw) } catch { /* Plain named dialogue fallback. */ }
  const rows = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' && 'messages' in parsed ? parsed.messages : null
  if (Array.isArray(rows)) return rows.flatMap(row => {
    if (!row || typeof row.speaker !== 'string' || !names.includes(row.speaker) || typeof row.text !== 'string') return []
    const text = cleanTableSpeech(row.text)
    return text ? [{ speaker: row.speaker, text }] : []
  }).slice(0, 4)
  return raw.split('\n').flatMap(line => {
    const speaker = names.find(name => line.trim().startsWith(name + '：') || line.trim().startsWith(name + ':'))
    if (!speaker) return []
    const content = line.trim().slice(speaker.length + 1)
    // Quoted dialogue can safely discard surrounding action prose.
    const quote = content.match(/[“「]([^”」]+)[”」]/)
    const text = cleanTableSpeech(quote?.[1] ?? content)
    return text ? [{ speaker, text }] : []
  }).slice(0, 4)
}
