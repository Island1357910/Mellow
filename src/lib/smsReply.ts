import { capReplySegments, expandReplyParts, parseReplySegments, type ReplySegment } from './stickerReply.ts'

export const SMS_SPLIT = '<<<分>>>'

export function stripVoicePrefix(text: string): string {
  return text.replace(/^(?:\s*(?:[（(]语音(?:消息)?[）)]|\[语音(?:消息)?\]|【语音(?:消息)?】)\s*[:：]?\s*)+/u, '').trim()
}

const SENTENCE_END = new Set(['。', '！', '？', '!', '?'])

/** 只在句末断开。逗号、省略号、引号和括号里的标点都不算新的一条。 */
function sentences(text: string): string[] {
  const chars = [...text]
  const parts: string[] = []
  let buf = ''
  let quote = 0
  let corner = 0
  let paren = 0
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i] ?? ''
    buf += ch
    if (ch === '“') quote += 1
    else if (ch === '”') quote = Math.max(0, quote - 1)
    else if (ch === '「') corner += 1
    else if (ch === '」') corner = Math.max(0, corner - 1)
    else if (ch === '（' || ch === '(') paren += 1
    else if (ch === '）' || ch === ')') paren = Math.max(0, paren - 1)
    if (quote || corner || paren || !SENTENCE_END.has(ch)) continue
    while (i + 1 < chars.length && (SENTENCE_END.has(chars[i + 1] ?? '') || '”」』'.includes(chars[i + 1] ?? ''))) {
      i += 1
      buf += chars[i]
    }
    if (/^[。！？!?\s]+$/u.test(buf)) continue
    parts.push(buf)
    buf = ''
  }
  if (buf) parts.push(buf)
  return parts.filter((part) => part.trim())
}

function packSentences(parts: string[], max: number): string[] {
  const groups = [...parts]
  while (groups.length > max) {
    let index = 0
    let best = Number.POSITIVE_INFINITY
    for (let i = 0; i < groups.length - 1; i += 1) {
      const size = (groups[i]?.length ?? 0) + (groups[i + 1]?.length ?? 0)
      if (size < best) {
        best = size
        index = i
      }
    }
    const head = groups[index] ?? ''
    const tail = groups[index + 1] ?? ''
    groups.splice(index, 2, head + tail)
  }
  return groups
}

/** 按完整句子分组。句子不够时不从逗号或词中间硬切开。 */
function splitText(text: string, max: number): string[] {
  if (max <= 1 || /https?:\/\/|```/i.test(text)) return [text]
  const parts = sentences(text)
  if (parts.length <= 1) return [text]
  return packSentences(parts, max)
}

/** 上一行还没说完时，换行不另起一条。 */
function joins(prev: string, next: string): boolean {
  if (/^\d{1,2}\.$/.test(prev)) return true
  if (/^[，、）)”」』]/.test(next)) return true
  if (/[。！？!?…~～」』”"]$/u.test(prev)) return false
  if (/[，、：:；;（(“「『]$/u.test(prev)) return true
  return /^(而且|并且|但是|然后|所以|因为|如果|不过|还是|或者|就是|没有那么|并不是)/.test(next)
}

export function buildSmsReplySegments(content: string, range: { min: number; max: number }): ReplySegment[] {
  const min = Math.max(1, Math.min(10, Math.round(range.min) || 1))
  const max = Math.max(min, Math.min(10, Math.round(range.max) || 1))
  const normalized = content.includes('\\n') && !content.includes('\n') ? content.replace(/\\n/g, '\n') : content
  const parts = normalized.split(/<<<\s*分\s*>>>/u).flatMap((block) => {
    const lines = block.split(/\n+/u).map((line) => line.trim()).filter(Boolean)
    const grouped: string[] = []
    for (const line of lines) {
      const prev = grouped[grouped.length - 1]
      if (prev && joins(prev, line)) grouped[grouped.length - 1] = prev + line
      else grouped.push(line)
    }
    return grouped
  }).map(stripVoicePrefix).filter(Boolean)
  const segments = expandReplyParts(parts)
  const textCount = segments.filter(item => item.kind === 'text').length
  let available = Math.max(0, max - textCount)
  const expanded = segments.flatMap(segment => {
    if (segment.kind !== 'text') return [segment]
    const texts = splitText(segment.content, available + 1)
    available -= texts.length - 1
    return texts.map(text => ({ kind: 'text' as const, content: text }))
  })
  return capReplySegments(expanded, max)
}

/** 自动语音只选择可直接说出口的短正文；任何动作、指令、富媒体标记均回退文字。 */
export function isSpeakableSms(text: string): boolean {
  const clean = text.trim()
  return Boolean(clean) && clean.length <= 160 && !/[（()）\[\]【】<>*]|表情包|https?:\/\//i.test(clean)
}

/** 兼容旧语音：播放时排除表情与动作说明，不改动原存档。 */
export function spokenSmsText(text: string): string {
  return parseReplySegments(text).filter(item => item.kind === 'text').map(item => item.content).join('\n')
    .replace(/[（(][^（）()]*[）)]|【[^【】]*】|\[[^\[\]]*\]|\*[^*\n]+\*/g, '').trim()
}
