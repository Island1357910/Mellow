const REASONING_TAGS = 'think|thinking|thought|reasoning|analysis|reflection|reflect|internal|scratchpad|chain_of_thought|cot|brain_noise_block'

function keepLonger(parts: string[]): string {
  const out: string[] = []
  for (const part of parts.map((item) => item.trim()).filter(Boolean)) {
    const index = out.findIndex((item) => item.includes(part) || part.includes(item))
    if (index < 0) out.push(part)
    else if (part.length > out[index].length) out[index] = part
  }
  return out.join('\n\n')
}

/** 抽出明确的推理标记。正文规则与 stripReasoning 相同，不按语气猜测。 */
export function takeReasoning(text: string): { content: string; reasoning: string } {
  const bits: string[] = []
  const fence = /^[ \t]*(`{3,}|~{3,})[ \t]*(?:think(?:ing)?|thought|reasoning|analysis|思维链|思考过程|推理过程)[^\n]*\r?\n[\s\S]*?(?:^[ \t]*\1[ \t]*(?:\r?\n|$)|(?![\s\S]))/gim
  let out = text.replace(fence, (full) => {
    const body = full.replace(/^[^\n]*\r?\n/, '').replace(/\r?\n?[ \t]*(?:`{3,}|~{3,})[ \t]*$/, '')
    if (body.trim()) bits.push(body.trim())
    return ''
  })
  const tags = new RegExp(`<\\s*(/?)\\s*(${REASONING_TAGS})\\b[^>]*>`, 'gi')
  const stack: string[] = []
  let result = ''
  let cursor = 0
  for (const match of out.matchAll(tags)) {
    const slice = out.slice(cursor, match.index)
    if (stack.length === 0) result += slice
    else if (slice.trim()) bits.push(slice.trim())
    const tag = match[2].toLowerCase()
    if (match[1]) {
      const open = stack.lastIndexOf(tag)
      if (open >= 0) stack.length = open
      else if (stack.length === 0) {
        if (result.trim()) bits.push(result.trim())
        result = ''
      }
    } else if (!/\/\s*>$/.test(match[0])) {
      stack.push(tag)
    }
    cursor = match.index + match[0].length
  }
  if (stack.length === 0) result += out.slice(cursor)
  else if (out.slice(cursor).trim()) bits.push(out.slice(cursor).trim())
  out = result.replace(new RegExp(`<\\s*(?:${REASONING_TAGS})(?=\\s|$)[^>]*$`, 'gi'), '')

  const thinkingHeading = /^[ \t]*(?:#{1,6}[ \t]*)?(?:\*\*)?(?:【|\[)?(?:思维链|思考过程|推理过程|分析过程|thinking|reasoning|analysis)(?:】|\])?(?:\*\*)?[ \t]*(?:[:：][ \t]*(?:\*\*)?.*|$)/i
  const answerHeading = /^[ \t]*(?:#{1,6}[ \t]*)?(?:\*\*)?(?:【|\[)?(?:最终回答|最终答案|正式回答|回复正文|正文|final[ \t]+answer|final[ \t]+response|answer|response)(?:】|\])?(?:\*\*)?[ \t]*(?:[:：][ \t]*(?:\*\*)?[ \t]*|$)/i
  let thinking = false
  const lines: string[] = []
  for (const line of out.split(/\r?\n/)) {
    if (thinkingHeading.test(line)) { thinking = true; continue }
    if (thinking) {
      const answer = line.match(answerHeading)
      if (!answer) {
        if (line.trim()) bits.push(line.trim())
        continue
      }
      thinking = false
      const body = line.slice(answer[0].length)
      if (body) lines.push(body)
    } else lines.push(line)
  }
  return {
    content: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    reasoning: keepLonger(bits),
  }
}

/** 仅识别明确的模型推理标记，不按正文语气猜测，也不删除角色内心描写。 */
export function stripReasoning(text: string): string {
  return takeReasoning(text).content
}

export function mergeThought(...parts: Array<string | undefined>): string {
  return keepLonger(parts.filter((item): item is string => Boolean(item)))
}
