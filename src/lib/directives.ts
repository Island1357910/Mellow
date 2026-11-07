import { DIRECTIVES, type Directive } from '../data/directives.ts'
import { storage } from '../storage/StorageService.ts'

const KEY = 'directive_picks_v1'
const ALL_KEY = 'directive_all_v1'
const ACCOUNT = 'mellow_account_rewards'
const MAX_CHARS = 9600

export interface DirectivePicks {
  global: string[]
  byChar: Record<string, string[]>
}

const EMPTY: DirectivePicks = { global: [], byChar: {} }

function known(ids: unknown): string[] {
  if (!Array.isArray(ids)) return []
  const allowed = new Set(DIRECTIVES.map((item) => item.id))
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    if (typeof id !== 'string' || !allowed.has(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

function asPicks(raw: unknown): DirectivePicks {
  if (!raw || typeof raw !== 'object') return { ...EMPTY, byChar: {} }
  const row = raw as { global?: unknown; byChar?: unknown }
  const byChar: Record<string, string[]> = {}
  if (row.byChar && typeof row.byChar === 'object') {
    for (const [id, value] of Object.entries(row.byChar)) {
      const next = known(value)
      if (next.length) byChar[id] = next
    }
  }
  return { global: known(row.global), byChar }
}

export async function loadDirectivePicks(namespace: string): Promise<DirectivePicks> {
  return asPicks(await storage.getBag(namespace, KEY))
}

export async function loadAllIdentityDirectives(): Promise<string[]> {
  return known(await storage.getBag(ACCOUNT, ALL_KEY))
}

export async function saveDirectivePicks(namespace: string, picks: DirectivePicks): Promise<void> {
  await storage.setBag(namespace, KEY, asPicks(picks))
}

export async function saveAllIdentityDirectives(ids: string[]): Promise<void> {
  await storage.setBag(ACCOUNT, ALL_KEY, known(ids))
}

function lookup(ids: string[]): Directive[] {
  const wanted = new Set(ids)
  return DIRECTIVES.filter((item) => wanted.has(item.id))
}

function cotOf(rows: Directive[]): Directive | null {
  if (rows.some((item) => item.cot === 'off')) return null
  const on = rows.filter((item) => item.cot === 'on')
  return on.length ? on[on.length - 1] : null
}

export function resolveDirectives(charIds: string[], picks: DirectivePicks, everyone: string[]): { text: string; cot: string } {
  const seen = new Set<string>()
  const ordered: Directive[] = []
  const push = (ids: string[]) => {
    for (const item of lookup(ids)) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      ordered.push(item)
    }
  }
  for (const id of charIds) push(picks.byChar[id] ?? [])
  push(picks.global)
  push(everyone)
  const lines: string[] = []
  let used = 0
  for (const item of ordered) {
    const line = `【${item.category}·${item.title}】${item.text}`
    if (used + line.length > MAX_CHARS) break
    lines.push(line)
    used += line.length
  }
  const scopes = [charIds.flatMap((id) => lookup(picks.byChar[id] ?? [])), lookup(picks.global), lookup(everyone)]
  let cot: Directive | null = null
  let decided = false
  for (const rows of scopes) {
    if (!rows.some((item) => item.cot)) continue
    cot = cotOf(rows)
    decided = true
    break
  }
  const text = lines.length
    ? `已选用的写作指令。照着写，不要向对方复述这些指令。若和别的写法冲突，以这些指令为准。\n${lines.join('\n')}`
    : ''
  const cotText = decided && cot
    ? `这一轮先写思维链，放在 <thinking> 和 </thinking> 之间，写在正文之前。${cot.text}思维链不出现在对方看见的正文里，也不替对方做决定。思维链结束后另起一行，只写正文。`
    : ''
  return { text, cot: cotText }
}

export async function directivePrompt(namespace: string, charIds: string[]): Promise<{ text: string; cot: string }> {
  const [picks, everyone] = await Promise.all([loadDirectivePicks(namespace), loadAllIdentityDirectives()])
  return resolveDirectives(charIds, picks, everyone)
}
