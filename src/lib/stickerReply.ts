import { ALL_SMS_STICKERS } from '../data/stickers.ts'

export interface ReplySegment {
  kind: 'text' | 'sticker'
  content: string
}

const STICKER_INLINE = /[\[【](?:sticker|表情包?)\s*[:：]\s*([^\]】\n]+)[\]】]/gi
const STICKER_BLOCK = /\[(?:sticker|表情包?)\]([\s\S]*?)\[\/(?:sticker|表情包?)\]/gi
const STICKER_NARRATIVE = /[（(]\s*(?:(?:发送了?|发[来出了送]?)(?:一个|一张|个|张)?\s*)?(?:表情包?|sticker)\s*[:：]\s*([^（）()\n]{1,160})[）)]/gi

export function resolveSticker(raw: string): string | null {
  const query = raw.trim()
  if (!query) return null
  if (/^https?:\/\//i.test(query) || query.startsWith('/stickers/')) {
    return ALL_SMS_STICKERS.find((item) => item.url === query)?.url ?? null
  }
  const exact = ALL_SMS_STICKERS.find((item) => item.label === query)
  if (exact) return exact.url
  const loose = ALL_SMS_STICKERS.find((item) => item.label.includes(query) || query.includes(item.label))
  return loose?.url ?? null
}

function pushText(segments: ReplySegment[], text: string) {
  const content = text.trim()
  if (!content) return
  segments.push({ kind: 'text', content })
}

function pushSticker(segments: ReplySegment[], raw: string) {
  const url = resolveSticker(raw)
  if (url) segments.push({ kind: 'sticker', content: url })
  else pushText(segments, `（表情包：${raw}）`)
}

/** 把 AI 回复里的 [表情:标签] 拆成「文字一条、表情一条」。 */
export function parseReplySegments(text: string): ReplySegment[] {
  const segments: ReplySegment[] = []
  let cursor = 0
  const matches: Array<{ start: number; end: number; label: string }> = []

  for (const re of [STICKER_INLINE, STICKER_BLOCK, STICKER_NARRATIVE]) {
    re.lastIndex = 0
    let match = re.exec(text)
    while (match) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        label: (match[1] ?? '').trim(),
      })
      match = re.exec(text)
    }
  }

  matches.sort((a, b) => a.start - b.start)
  const merged: typeof matches = []
  for (const item of matches) {
    const prev = merged[merged.length - 1]
    if (prev && item.start < prev.end) continue
    merged.push(item)
  }

  for (const item of merged) {
    pushText(segments, text.slice(cursor, item.start))
    pushSticker(segments, item.label)
    cursor = item.end
  }
  pushText(segments, text.slice(cursor))

  if (!segments.length && text.trim()) segments.push({ kind: 'text', content: text.trim() })
  return segments
}

export function expandReplyParts(parts: string[]): ReplySegment[] {
  return parts.flatMap((part) => parseReplySegments(part)).filter((item) => item.content.trim())
}

/** 合并相邻文字以控制条数，绝不截掉正文或跨越表情包重排消息。 */
export function capReplySegments(segments: ReplySegment[], textMax: number): ReplySegment[] {
  const out = segments.map(item => ({ ...item }))
  let texts = out.filter(item => item.kind === 'text').length
  while (texts > Math.max(1, textMax)) {
    let index = -1
    let shortest = Infinity
    for (let i = 0; i < out.length - 1; i++) {
      if (out[i].kind !== 'text' || out[i + 1].kind !== 'text') continue
      const size = out[i].content.length + out[i + 1].content.length
      if (size < shortest) { index = i; shortest = size }
    }
    if (index < 0) break
    out.splice(index, 2, { kind: 'text', content: `${out[index].content}\n${out[index + 1].content}` })
    texts--
  }
  return out
}

export function stickerCatalogForPrompt(limit = 72): string {
  const labels = ALL_SMS_STICKERS.map((item) => item.label)
  const shown = labels.slice(0, limit)
  const tail = labels.length > limit ? `……等共 ${labels.length} 个` : ''
  return [
    '像真人一样常用表情包：大约每 2～4 轮回复就至少发 1 次；撒娇、无语、开心、委屈、敷衍、犯贱时尤其爱发。',
    '每个 [表情:标签] 必须单独占一条消息，不要和文字挤在同一条里。',
    '不要用“（发了一个表情包：……）”等动作描述代替表情指令，语音内容也不包含表情或动作说明。',
    '写法：先写文字，用 <<<分>>> 换行，再写 [表情:标签]；或者整条只发 [表情:标签]。',
    '示例：嗯嗯知道了<<<分>>>[表情:收到]　或单独：[表情:思考]',
    '一条回复里最多 2 个表情，每个都要 <<<分>>> 分开。',
    `可选标签：${shown.join('、')}${tail}`,
  ].join('\n')
}
