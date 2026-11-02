const REASONING_TAGS = 'think|thinking|thought|reasoning|analysis|reflection|reflect|internal|scratchpad|chain_of_thought|cot|brain_noise_block'

/** 仅识别明确的模型推理标记，不按正文语气猜测，也不删除角色内心描写。 */
export function stripReasoning(text: string): string {
  // 先处理推理代码块，包含因 token 耗尽而没有闭合的代码围栏。
  let out = text.replace(/^[ \t]*(`{3,}|~{3,})[ \t]*(?:think(?:ing)?|thought|reasoning|analysis|思维链|思考过程|推理过程)[^\n]*\r?\n[\s\S]*?(?:^[ \t]*\1[ \t]*(?:\r?\n|$)|(?![\s\S]))/gim, '')
  const tags = new RegExp(`<\\s*(/?)\\s*(${REASONING_TAGS})\\b[^>]*>`, 'gi')
  const stack: string[] = []
  let result = ''
  let cursor = 0
  for (const match of out.matchAll(tags)) {
    if (stack.length === 0) result += out.slice(cursor, match.index)
    const tag = match[2].toLowerCase()
    if (match[1]) {
      const open = stack.lastIndexOf(tag)
      if (open >= 0) stack.length = open
      else if (stack.length === 0) result = '' // 部分接口只回传思考尾部及闭合标签。
    } else if (!/\/\s*>$/.test(match[0])) {
      stack.push(tag)
    }
    cursor = match.index + match[0].length
  }
  if (stack.length === 0) result += out.slice(cursor)
  // 不完整的起始标签同样不应把后面的推理片段暴露出来。
  out = result.replace(new RegExp(`<\\s*(?:${REASONING_TAGS})(?=\\s|$)[^>]*$`, 'gi'), '')

  const thinkingHeading = /^[ \t]*(?:#{1,6}[ \t]*)?(?:\*\*)?(?:【|\[)?(?:思维链|思考过程|推理过程|分析过程|thinking|reasoning|analysis)(?:】|\])?(?:\*\*)?[ \t]*(?:[:：][ \t]*(?:\*\*)?.*|$)/i
  const answerHeading = /^[ \t]*(?:#{1,6}[ \t]*)?(?:\*\*)?(?:【|\[)?(?:最终回答|最终答案|正式回答|回复正文|正文|final[ \t]+answer|final[ \t]+response|answer|response)(?:】|\])?(?:\*\*)?[ \t]*(?:[:：][ \t]*(?:\*\*)?[ \t]*|$)/i
  let thinking = false
  const lines: string[] = []
  for (const line of out.split(/\r?\n/)) {
    if (thinkingHeading.test(line)) { thinking = true; continue }
    if (thinking) {
      const answer = line.match(answerHeading)
      if (!answer) continue
      thinking = false
      const body = line.slice(answer[0].length)
      if (body) lines.push(body)
    } else lines.push(line)
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
