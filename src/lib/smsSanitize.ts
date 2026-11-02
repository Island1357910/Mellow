import { stripReasoning } from './reasoning.ts'

const THINKING_BLOCKS: RegExp[] = [
  /<status>[\s\S]*?<\/status>/gi,
  /<status_text_block>[\s\S]*?<\/status_text_block>/gi,
]

/** 去掉模型可能附带的思维链 / 推理过程，只保留要发出的短信正文。 */
export function stripThinkingFromSms(text: string): string {
  let out = stripReasoning(text)
  for (const re of THINKING_BLOCKS) {
    re.lastIndex = 0
    out = out.replace(re, '')
  }
  return out.replace(/\n{3,}/g, '\n\n').trim()
}
