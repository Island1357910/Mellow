import { ALL_SMS_STICKERS } from '../data/stickers.ts'

export interface ReplySegment {
  kind: 'text' | 'sticker'
  content: string
}

const STICKER_INLINE = /\[(?:sticker|表情):([^\]\n]+)\]/gi
const STICKER_BLOCK = /\[(?:sticker|表情)\]([\s\S]*?)\[\/(?:sticker|表情)\]/gi

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
  else pushText(segments, raw)
}

/** 把 AI 回复里的 [表情:标签] 拆成「文字一条、表情一条」。 */
export function parseReplySegments(text: string): ReplySegment[] {
  const segments: ReplySegment[] = []
  let cursor = 0
  const matches: Array<{ start: number; end: number; label: string }> = []

  for (const re of [STICKER_INLINE, STICKER_BLOCK]) {
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

/** 文字条数受 max 限制；表情包每条单独算一条消息，不占文字额度。 */
export function capReplySegments(segments: ReplySegment[], textMax: number): ReplySegment[] {
  const out: ReplySegment[] = []
  let texts = 0
  for (const seg of segments) {
    if (seg.kind === 'sticker') {
      out.push(seg)
      continue
    }
    if (texts >= textMax) continue
    out.push(seg)
    texts += 1
  }
  return out.length ? out : segments.slice(0, 1)
}

export function stickerCatalogForPrompt(limit = 72): string {
  const labels = ALL_SMS_STICKERS.map((item) => item.label)
  const shown = labels.slice(0, limit)
  const tail = labels.length > limit ? `……等共 ${labels.length} 个` : ''
  return [
    '像真人一样常用表情包：大约每 2～4 轮回复就至少发 1 次；撒娇、无语、开心、委屈、敷衍、犯贱时尤其爱发。',
    '每个 [表情:标签] 必须单独占一条消息，不要和文字挤在同一条里。',
    '写法：先写文字，用 <<<分>>> 换行，再写 [表情:标签]；或者整条只发 [表情:标签]。',
    '示例：嗯嗯知道了<<<分>>>[表情:收到]　或单独：[表情:思考]',
    '一条回复里最多 2 个表情，每个都要 <<<分>>> 分开。',
    `可选标签：${shown.join('、')}${tail}`,
  ].join('\n')
}
