const THINK_TAG = 'think'

const THINKING_BLOCKS: RegExp[] = [
  /<thinking>[\s\S]*?<\/thinking>/gi,
  /<thought>[\s\S]*?<\/thought>/gi,
  /<reasoning>[\s\S]*?<\/reasoning>/gi,
  /<analysis>[\s\S]*?<\/analysis>/gi,
  /<reflect>[\s\S]*?<\/reflect>/gi,
  /<internal>[\s\S]*?<\/internal>/gi,
  /<scratchpad>[\s\S]*?<\/scratchpad>/gi,
  /<status>[\s\S]*?<\/status>/gi,
  /<status_text_block>[\s\S]*?<\/status_text_block>/gi,
  /<brain_noise_block>[\s\S]*?<\/brain_noise_block>/gi,
  new RegExp(`<${THINK_TAG}>[\\s\\S]*?</${THINK_TAG}>`, 'gi'),
  new RegExp('<think>[\\s\\S]*?</think>', 'gi'),
  /```(?:thinking|thought|reasoning|analysis)[\s\S]*?```/gi,
]

const THINKING_LINE = /^(?:【思维链】|【思考过程】|【推理过程】|【内心独白】|Thinking:|Reasoning:|Analysis:)[^\n]*/gim

/** 去掉模型可能附带的思维链 / 推理过程，只保留要发出的短信正文。 */
export function stripThinkingFromSms(text: string): string {
  let out = text
  for (const re of THINKING_BLOCKS) {
    re.lastIndex = 0
    out = out.replace(re, '')
  }
  out = out.replace(THINKING_LINE, '')
  return out.replace(/\n{3,}/g, '\n\n').trim()
}
