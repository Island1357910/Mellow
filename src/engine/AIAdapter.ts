import type { AIMessage, AIRequest, AIResponse, ApiConfig } from '../types/index.ts'
import { stripReasoning } from '../lib/reasoning.ts'

/** 未指定 maxTokens 时的默认值，避免部分接口因缺参返回空内容 */
const DEFAULT_MAX_TOKENS = 8192
const COMPLETE_ATTEMPTS = 3

export class AIError extends Error {
  code: 'config' | 'network' | 'api' | 'unsupported'
  retryable: boolean

  constructor(message: string, code: AIError['code'] = 'api', retryable = false) {
    super(message)
    this.name = 'AIError'
    this.code = code
    this.retryable = retryable
  }
}

interface ReadyConfig {
  endpoint: string
  model: string
  key: string
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function joinUrl(endpoint: string, suffix: string): string {
  const base = trimSlash(endpoint)
  if (base.endsWith(suffix)) return base
  return `${base}${suffix}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function invalidParam(message: string): boolean {
  return /参数无效|参数错误|参数有误|invalid parameter|invalid_request|max_tokens|max_completion_tokens/i.test(message)
}

function errorDetail(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (!value || typeof value !== 'object') return ''
  const row = value as { message?: string; code?: string; param?: string; type?: string }
  const message = typeof row.message === 'string' ? row.message.trim() : ''
  const extra = [row.param, row.code, row.type].filter((item) => typeof item === 'string' && item.trim() && item !== message)
  if (!message) return extra.join(' · ')
  return extra.length ? `${message}（${extra.join(' · ')}）` : message
}

async function readError(response: Response): Promise<string> {
  const text = await response.text()
  if (!text) return `接口返回了 ${response.status}`
  try {
    const data = JSON.parse(text) as { error?: unknown; message?: string; code?: string; param?: string }
    const fromError = errorDetail(data.error)
    if (fromError) return fromError.slice(0, 240)
    const own = errorDetail(data)
    if (own) return own.slice(0, 240)
  } catch {
    return text.slice(0, 240)
  }
  return text.slice(0, 240)
}

function cleanText(text: string): string {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim()
}

/** 模型请求控制提示，不是玩家发言，也不落库。保留完整历史和末尾系统约束。 */
function withUserEnding(messages: AIMessage[]): AIMessage[] {
  const rows = messages.map(item => ({ ...item }))
  const last = rows[rows.length - 1]
  if (last?.role === 'user' && last.content.trim()) return rows
  const content = '（应用生成的请求控制提示，不是玩家的新发言。）请根据以上设定、真实对话和本次任务生成下一条角色回复。不要替玩家说话或做决定，不要把这段控制提示写进正文或当作共同经历。'
  if (last?.role === 'user') last.content = content
  else rows.push({ role: 'user', content })
  return rows
}

function squashRoles(messages: AIMessage[]): AIMessage[] {
  const rows: AIMessage[] = []
  for (const item of messages) {
    const prev = rows[rows.length - 1]
    if (prev && prev.role === item.role) prev.content = `${prev.content}\n${item.content}`
    else rows.push({ role: item.role, content: item.content })
  }
  return rows
}

/** 收成多数接口都接受的形状：角色交替、以 user 结尾，必要时不使用 system。 */
function normalizeMessages(messages: AIMessage[], maxChars: number, foldSystem: boolean): AIMessage[] {
  const systemCap = Math.min(700, Math.floor(maxChars * 0.6))
  const systemRaw = cleanText(messages.filter((item) => item.role === 'system').map((item) => item.content).join('\n'))
  const system = systemRaw.length <= systemCap ? systemRaw : systemRaw.slice(-systemCap)
  const rest = messages.filter((item) => item.role !== 'system')
  const kept: AIMessage[] = []
  let used = foldSystem ? Math.min(system.length, systemCap) : system.length
  for (let index = rest.length - 1; index >= 0; index -= 1) {
    const item = rest[index]
    if (!item) continue
    const content = cleanText(item.content).slice(0, 400)
    if (!content) continue
    if (used + content.length > maxChars && kept.length > 0) break
    kept.push({ role: item.role === 'assistant' ? 'assistant' : 'user', content })
    used += content.length
  }
  kept.reverse()
  let rows: AIMessage[] = foldSystem || !system ? kept : [{ role: 'system', content: system }, ...kept]
  if (foldSystem && system) {
    if (rows[0]?.role === 'user') rows[0] = { role: 'user', content: `${system}\n\n${rows[0].content}` }
    else rows = [{ role: 'user', content: system }, ...rows]
  }
  rows = squashRoles(rows)
  while (rows[0]?.role === 'assistant') rows.shift()
  if (!rows.some((item) => item.role === 'user')) rows.push({ role: 'user', content: '请继续。' })
  if (rows[rows.length - 1]?.role !== 'user') rows.push({ role: 'user', content: '请继续。' })
  return rows.length > 0 ? rows : [{ role: 'user', content: '请继续。' }]
}

function isReasoningPart(part: unknown): boolean {
  return Boolean(part && typeof part === 'object' && 'type' in part && typeof part.type === 'string'
    && /^(?:reasoning|thinking|analysis|redacted_thinking|reasoning_text|summary_text)$/i.test(part.type))
}

function partText(part: unknown): string {
  if (typeof part === 'string') return part
  if (typeof part !== 'object' || !part) return ''
  const row = part as Record<string, unknown>
  if (isReasoningPart(part)) return ''
  if (row.type === 'message') return messageContent(row.content)
  if (typeof row.text === 'string') return row.text
  if (typeof row.content === 'string') return row.content
  if (row.type === 'text' && typeof row.text === 'string') return row.text
  return ''
}

function messageContent(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.map(partText).join('').trim()
  if (typeof value === 'object') {
    return partText(value).trim()
  }
  return ''
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

/** 兼容多种 OpenAI 兼容接口的返回格式 */
function extractContent(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const root = data as Record<string, unknown>
  const choice = (root.choices as Array<Record<string, unknown>> | undefined)?.[0]
  if (choice) {
    const message = choice.message as Record<string, unknown> | undefined
    if (message) {
      const main = messageContent(message.content)
      if (main) return main
      const fallback = pickString(message.output, message.text)
      if (fallback) return fallback
    }
    const direct = pickString(choice.text, choice.content, messageContent(choice.message))
    if (direct) return direct
  }
  return pickString(messageContent(root.content), messageContent(root.output), root.output_text, root.response)
}

/**
 * 所有对话都走 OpenAI 兼容接口。
 * 必须先拉取模型、选中并保存，才会真正发请求。
 */
export class AIAdapter {
  private readonly config: ReadyConfig

  constructor(config: ReadyConfig) {
    this.config = config
  }

  static async fromStored(config: ApiConfig | undefined, key: string): Promise<AIAdapter> {
    if (!config?.endpoint) throw new AIError('还没有可用的接口。到设置里新建一张卡片。', 'config')
    if (!config.ready || !config.model) throw new AIError('先拉取模型，选一个，保存之后才能用。', 'config')
    if (!key.trim()) throw new AIError('这张卡片还没有密钥。', 'config')
    return new AIAdapter({ endpoint: config.endpoint, model: config.model, key })
  }

  static async listModels(endpoint: string, key: string): Promise<string[]> {
    if (!endpoint.trim()) throw new AIError('先写接口地址。', 'config')
    if (!key.trim()) throw new AIError('先写密钥，才能拉取模型。', 'config')
    let response: Response
    try {
      response = await fetch(joinUrl(endpoint, '/models'), {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(30_000),
      })
    } catch (error) {
      if (error instanceof TypeError) throw new AIError('拉不到模型列表。多半是地址或跨域。', 'network')
      throw new AIError(error instanceof Error ? error.message : '拉取失败', 'network')
    }
    if (!response.ok) throw new AIError(await readError(response))
    const data = (await response.json()) as { data?: Array<{ id?: string }>; models?: Array<{ id?: string } | string> }
    const rows = data.data ?? data.models ?? []
    const ids = rows
      .map((row) => (typeof row === 'string' ? row : row.id))
      .filter((id): id is string => Boolean(id))
    if (ids.length === 0) throw new AIError('接口没有返回可选模型。')
    return ids
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    if (!this.config.model.trim()) throw new AIError('还没选择模型。', 'config')
    if (!this.config.endpoint.trim()) throw new AIError('还没写接口地址。', 'config')
    if (!this.config.key.trim()) throw new AIError('还没保存 API Key。', 'config')

    let last: AIError | null = null
    for (let attempt = 0; attempt < COMPLETE_ATTEMPTS; attempt++) {
      if (attempt > 0) await sleep(700 * attempt)
      try {
        return await this.openai(request)
      } catch (error) {
        const aiError = error instanceof AIError ? error : AIAdapter.asNetworkError(error)
        last = aiError
        if (!AIAdapter.shouldRetry(aiError, attempt)) throw aiError
      }
    }
    throw last ?? new AIError('请求失败了')
  }

  static shouldRetry(error: AIError, attempt: number): boolean {
    if (attempt >= COMPLETE_ATTEMPTS - 1) return false
    if (error.code === 'config') return false
    return error.code === 'network' || error.retryable
  }

  static asNetworkError(error: unknown): AIError {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return new AIError('等了太久，接口没有回来。', 'network', true)
    }
    const raw = error instanceof Error ? error.message : ''
    const msg = raw.toLowerCase()
    if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network request failed')) {
      return new AIError(
        '请求中途断开（Failed to fetch）。若聊天正常，多半是整理/导入请求更大更慢，被网关限时切断；可改用 txt/json 或换更快的模型。',
        'network',
        true,
      )
    }
    if (error instanceof TypeError) {
      return new AIError('连不上接口。浏览器直接请求时，多半是跨域或地址不可达。', 'network', true)
    }
    if (error instanceof Error) {
      if (msg.includes('timed out') || msg.includes('timeout') || msg.includes('abort') || msg.includes('signal')) {
        return new AIError('等了太久，接口没有回来。', 'network', true)
      }
    }
    return new AIError(raw || '请求失败了', 'api')
  }

  private payloads(request: AIRequest): Array<Record<string, unknown>> {
    const messages = withUserEnding(request.messages)
    const temperature = typeof request.temperature === 'number' && request.temperature > 0 && request.temperature <= 1
      ? request.temperature
      : 0.8
    const normal: Record<string, unknown> = {
      model: this.config.model,
      messages,
      temperature,
      max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
    }
    if (typeof request.topP === 'number' && request.topP > 0 && request.topP < 1) normal.top_p = request.topP
    if (request.frequencyPenalty) normal.frequency_penalty = request.frequencyPenalty
    if (request.presencePenalty) normal.presence_penalty = request.presencePenalty
    return [
      normal,
      {
        model: this.config.model,
        messages: normalizeMessages(messages, 1400, false),
        temperature: 0.8,
        max_tokens: 512,
      },
      {
        model: this.config.model,
        messages: normalizeMessages(messages, 700, true),
        max_tokens: 256,
      },
      {
        model: this.config.model,
        messages: normalizeMessages(messages, 500, true),
      },
    ]
  }

  private async openai(request: AIRequest): Promise<AIResponse> {
    const timeoutMs = request.timeoutMs ?? 120_000
    const payloads = this.payloads(request)
    let last = '请求失败了'
    for (let index = 0; index < payloads.length; index += 1) {
      let response: Response
      try {
        response = await fetch(joinUrl(this.config.endpoint, '/chat/completions'), {
          method: 'POST',
          signal: AbortSignal.timeout(timeoutMs),
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.key ? { Authorization: `Bearer ${this.config.key}` } : {}),
          },
          body: JSON.stringify(payloads[index]),
        })
      } catch (error) {
        throw AIAdapter.asNetworkError(error)
      }

      if (!response.ok) {
        last = await readError(response)
        const retryable = response.status === 429 || response.status >= 500
        if (retryable) throw new AIError(last, 'network', retryable)
        if (response.status === 400 && invalidParam(last) && index < payloads.length - 1) continue
        throw new AIError(last, 'api')
      }

      const data = (await response.json()) as unknown
      const rawContent = extractContent(data)
      const content = stripReasoning(rawContent)
      if (content) return { content, model: this.config.model, provider: 'openai' }
      const root = data as { choices?: Array<{ message?: { reasoning_content?: unknown; reasoning?: unknown; content?: unknown } }>; content?: unknown; output?: unknown }
      const message = root?.choices?.[0]?.message
      const reasoningParts = [message?.content, root?.content, root?.output].some(value =>
        Array.isArray(value) ? value.some(isReasoningPart) : isReasoningPart(value))
      if (rawContent || message?.reasoning_content || message?.reasoning || reasoningParts) {
        throw new AIError('接口只返回了思考内容，没有可显示的正文。请重试或增加输出长度。', 'api')
      }
      last = '接口回来了，但没有文字。'
      if (index === payloads.length - 1) throw new AIError(last, 'api', true)
    }
    throw new AIError(last, 'api')
  }
}
