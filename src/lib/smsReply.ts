import { capReplySegments, expandReplyParts, parseReplySegments, type ReplySegment } from './stickerReply.ts'

export const SMS_SPLIT = '<<<分>>>'

/** 按句意分组；没有分隔指令的长回复也会拆条，不截断或省略内容。 */
function splitText(text: string, min: number, max: number): string[] {
  if (max <= 1) return [text]
  const target = Math.min(max, Math.max(min, Math.ceil(text.length / 56)))
  if (target <= 1) return [text]
  const hasSegmenter = typeof Intl.Segmenter === 'function'
  let atoms = hasSegmenter
    ? [...new Intl.Segmenter('zh-CN', { granularity: 'sentence' }).segment(text)].map(item => item.segment)
    : text.match(/[^。！？!?]*[。！？!?]+|[^。！？!?]+$/gu) ?? [text]
  if (atoms.length < target && text.length > 110 && !/https?:\/\/|```/i.test(text)) {
    atoms = atoms.flatMap(atom => atom.match(/[^，；;,]*[，；;,]+|[^，；;,]+$/gu) ?? [atom])
  }
  // 无标点长文按词分组，避免把中文词、英文单词或 emoji 从中切开。
  if (hasSegmenter && atoms.length < target && text.length > 160 && !/https?:\/\/|```/i.test(text)) {
    atoms = [...new Intl.Segmenter('zh-CN', { granularity: 'word' }).segment(text)].map(item => item.segment)
  }
  const count = Math.min(target, atoms.length)
  const groups: string[] = []
  let buffer = ''
  let remaining = text.length
  for (let i = 0; i < atoms.length; i++) {
    buffer += atoms[i]
    const slots = count - groups.length
    if (slots > 1 && (buffer.length >= remaining / slots || atoms.length - i - 1 === slots - 1)) {
      groups.push(buffer.trim())
      remaining -= buffer.length
      buffer = ''
    }
  }
  if (buffer.trim()) groups.push(buffer.trim())
  return groups.filter(Boolean)
}

export function buildSmsReplySegments(content: string, range: { min: number; max: number }): ReplySegment[] {
  const min = Math.max(1, Math.min(10, Math.round(range.min) || 1))
  const max = Math.max(min, Math.min(10, Math.round(range.max) || 1))
  const parts = content.split(/<<<\s*分\s*>>>|\n\s*-{3,}\s*\n|\n\s*\n+/u).map(part => part.trim()).filter(Boolean)
  const segments = expandReplyParts(parts)
  const textCount = segments.filter(item => item.kind === 'text').length
  let available = Math.max(0, max - textCount)
  const expanded = segments.flatMap(segment => {
    if (segment.kind !== 'text') return [segment]
    const texts = splitText(segment.content, textCount === 1 ? min : 1, available + 1)
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
