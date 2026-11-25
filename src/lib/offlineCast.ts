import { spokenName, type StorySave } from '../engine/story.ts'
import { readJson } from './ask.ts'
import type { Character } from '../types/index.ts'

export function sceneCastInstruction(chars: Character[]): string {
  return `正文与状态栏完成后，在本次回复末尾额外写一条应用标记：<mellow-scene>{"ids":["角色ID"]}</mellow-scene>。这条标记只用于记录本轮结束时谁在现场，不属于状态栏。只填正在与玩家同场说话、行动或相处的人；被想起、提起或在短信电话中的人不算。离场的人移出，没有人物在场时 ids 为空数组。不要另起一次回复。可选角色：\n${chars.map(rosterLine).join('\n')}`
}

export function readSceneReply(content: string, chars: Character[]): { content: string; ids: string[] | null } {
  const marker = /<mellow-scene>\s*([\s\S]*?)\s*<\/mellow-scene>/g
  let ids: string[] | null = null
  const text = content.replace(marker, (_match, json: string) => {
    ids = castIdsFromModel(json, chars)
    return ''
  }).replace(/<mellow-scene>[\s\S]*$/, '').trim()
  return { content: text, ids }
}

function resolveToken(token: string, chars: Character[]): string | null {
  const exactId = chars.find((person) => person.id === token)
  if (exactId) return exactId.id
  const spoken = spokenName(token)
  const matches = chars.filter((person) => [person.name, person.nickname, person.remark].some((name) => {
    const clean = name?.trim()
    if (!clean) return false
    return clean === token || spokenName(clean) === token || clean === spoken || spokenName(clean) === spoken
  }))
  if (matches.length === 1) return matches[0]!.id
  const exact = matches.filter((person) => person.name.trim() === token || person.nickname?.trim() === token)
  return exact.length === 1 ? exact[0]!.id : null
}

export function castIdsFromModel(raw: string, chars: Character[]): string[] | null {
  try {
    const parsed = readJson(raw)
    const ids = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { ids?: unknown }).ids)
        ? (parsed as { ids: unknown[] }).ids
        : null
    if (!ids) return null
    const tokens = ids.filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
    const resolved = [...new Set(tokens.flatMap((token) => {
      const id = resolveToken(token.trim(), chars)
      return id ? [id] : []
    }))]
    if (tokens.length && !resolved.length) return null
    return resolved
  } catch {
    return null
  }
}

function clipScene(text: string, limit: number): string {
  const plain = text
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (plain.length <= limit) return plain || '……'
  const head = Math.min(160, Math.floor(limit / 3))
  return `${plain.slice(0, head)} …… ${plain.slice(-(limit - head))}`
}

/** 最近几幕的正文。长段保留结尾，在场的人通常出现在这一幕的末尾。 */
export function castTranscript(save: StorySave, extra = ''): string {
  const lines = save.lines.slice(-8)
  const rows = lines.map((item, index) => {
    const latest = index >= lines.length - 2
    return `${item.role === 'user' ? '玩家' : '叙述'}：${clipScene(item.content, latest ? 900 : 420)}`
  })
  if (extra.trim()) rows.push(`玩家这一句：${clipScene(extra, 900)}`)
  return rows.filter(Boolean).join('\n')
}

function rosterLine(person: Character): string {
  const spoken = spokenName(person.name)
  const nick = person.nickname?.trim()
  const bits = [person.id, person.name]
  if (spoken && spoken !== person.name.trim()) bits.push(`口头叫 ${spoken}`)
  if (nick) bits.push(`昵称 ${nick}`)
  return bits.join(' | ')
}
