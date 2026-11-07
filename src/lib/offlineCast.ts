import { focusChars, type StorySave } from '../engine/story.ts'
import { moduleAi, readJson } from './ask.ts'
import type { Character } from '../types/index.ts'

const MARK = '谁此刻在现场'

export function castIdsFromModel(raw: string, allowed: string[]): string[] | null {
  try {
    const parsed = readJson(raw)
    const ids = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { ids?: unknown }).ids)
        ? (parsed as { ids: unknown[] }).ids
        : null
    if (!ids) return null
    const known = new Set(allowed)
    return [...new Set(ids.filter((id): id is string => typeof id === 'string' && known.has(id)))]
  } catch {
    return null
  }
}

function priorSave(save: StorySave): StorySave {
  const last = save.lines[save.lines.length - 1]
  if (last?.role === 'user' && last.participantIds === undefined) return { ...save, lines: save.lines.slice(0, -1) }
  return save
}

function plain(text: string): string {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500)
}

/** 用线下接口判断这一场谁在，卡名里的 2.0 只是版本，不要求正文把版本号写出来。认不出来时退回原来的姓名判断。 */
export async function offlineFocus(chars: Character[], save: StorySave, extra = ''): Promise<Character[]> {
  const fallback = () => focusChars(chars, save, extra)
  if (!chars.length) return []
  const prior = focusChars(chars, priorSave(save))
  const recent = [...save.lines.slice(-8).map((item) => `${item.role === 'user' ? '玩家' : '叙述'}：${plain(item.content)}`), extra.trim() ? `玩家这一句：${plain(extra)}` : '']
    .filter(Boolean)
    .join('\n')
  const roster = chars.map((person) => `${person.id} | ${person.name}${person.nickname?.trim() ? ` | 昵称 ${person.nickname.trim()}` : ''}`).join('\n')
  try {
    const raw = await moduleAi('offline').askJson(
      [
        `你只判断这场线下${MARK}。只输出 JSON：{"ids":["角色ID"]}`,
        '卡名末尾的 2.0、v2、版本号是角色卡版本，不是口头称呼。正文里写「林夏」时，卡名「林夏2.0」就是这个人。按人物是谁来选，不要因为正文没写出版本号就漏掉。',
        '上一场已经在场的人，这一句没有明确送走，就继续在场。提到、想起、聊天、发短信，不算入场。去找、见面、进来、场景转到某人身边，才算换人或加人。明确离开、走了、只剩某人，才把人移出。',
        'ids 只能用给定名单里的角色ID。',
      ].join('\n'),
      `上一场在场：${prior.map((person) => person.id).join('、') || '没有'}\n可选角色：\n${roster}\n最近正文：\n${recent || '还没有正文'}`,
      240,
    )
    const ids = castIdsFromModel(raw, chars.map((person) => person.id))
    if (!ids) return fallback()
    return ids.flatMap((id) => {
      const person = chars.find((item) => item.id === id)
      return person ? [person] : []
    })
  } catch {
    return fallback()
  }
}
