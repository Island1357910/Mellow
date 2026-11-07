import { focusChars, spokenName, type StorySave } from '../engine/story.ts'
import { moduleAi, readJson } from './ask.ts'
import type { Character } from '../types/index.ts'

const MARK = '谁此刻在现场'

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

function priorSave(save: StorySave): StorySave {
  const last = save.lines[save.lines.length - 1]
  if (last?.role === 'user' && last.participantIds === undefined) return { ...save, lines: save.lines.slice(0, -1) }
  return save
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

function peopleByIds(chars: Character[], ids: string[]): Character[] {
  return ids.flatMap((id) => {
    const person = chars.find((item) => item.id === id)
    return person ? [person] : []
  })
}

/** 在场人物以这一次 AI 确认为准。只有接口失败或没返回能用的名单时，才退回姓名判断。 */
export async function offlineFocus(chars: Character[], save: StorySave, extra = ''): Promise<Character[]> {
  const fallback = () => focusChars(chars, save, extra)
  if (!chars.length) return []
  const prior = focusChars(chars, priorSave(save))
  const recent = castTranscript(save, extra)
  const roster = chars.map(rosterLine).join('\n')
  try {
    const raw = await moduleAi('offline').askJson(
      [
        `你只判断这场线下${MARK}。只输出 JSON：{"ids":["角色ID"]}`,
        '卡名末尾的 2.0、v2、（2）、版本号是角色卡版本，不是口头称呼。正文写「林夏」时，名单里的「林夏2.0」就是这个人。几个卡的口头名字相同时，优先已经在场的那张；正文写了版本号就用带版本号的那张。',
        '按最近这一幕的场面判断，要灵敏：这个人正在说话、做事、和玩家待在一起、被玩家看见或被当面叫到，就算在场。伸手、坐下、回头、把东西递过来、推门、跟着走，都算，不必出现「去找」「见面」「进来」。',
        '只是被提起、被想起、被聊天讨论、出现在短信、电话或回忆里，不算在场。',
        '玩家这一句已经转到另一个人身边，或写了只剩某人，场面就换成现在身边的人。上一场的人，这一幕没有离开、也没有被换掉，就还在。明确走了、离开、回去了，才移出。继续、续写不换人。',
        'ids 用角色ID，也可以写角色名。不要编名单以外的人。拿得准的都写上，不要因为犹豫把在场的人漏掉。',
      ].join('\n'),
      `上一场在场：${prior.map((person) => person.id).join('、') || '没有'}\n可选角色：\n${roster}\n最近场面（结尾才是现在）：\n${recent || '还没有正文'}`,
      360,
    )
    const ids = castIdsFromModel(raw, chars)
    if (!ids) return fallback()
    return peopleByIds(chars, ids)
  } catch {
    return fallback()
  }
}
