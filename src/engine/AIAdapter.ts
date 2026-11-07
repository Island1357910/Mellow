import type { AIMessage, AIRequest, AIResponse, ApiConfig, GenerationSettings } from '../types/index.ts'
import { mergeThought, takeReasoning } from '../lib/reasoning.ts'
import { apiErrorText } from '../lib/apiErrorText.ts'

/** 未指定 maxTokens 时的默认值，避免部分接口因缺参返回空内容 */
const DEFAULT_MAX_TOKENS = 8192
const COMPLETE_ATTEMPTS = 3

export class AIError extends Error {
  code: 'config' | 'network' | 'api' | 'unsupported'
  retryable: boolean
  diagnostic?: string

  constructor(message: string, code: AIError['code'] = 'api', retryable = false, diagnostic?: string) {
    super(message)
    this.name = 'AIError'
    this.code = code
    this.retryable = retryable
    this.diagnostic = diagnostic
  }
}

interface ReadyConfig {
  endpoint: string
  model: string
  key: string
  generation?: GenerationSettings
}

interface CompletionResult extends AIResponse { reasoningOnly?: boolean }

function apiReasoning(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const root = data as Record<string, unknown>
  const choice = (root.choices as Array<Record<string, unknown>> | undefined)?.[0]
  const message = choice?.message as Record<string, unknown> | undefined
  const bits: string[] = []
  const push = (value: unknown) => {
    const text = reasoningText(value)
    if (text) bits.push(text)
  }
  push(message?.reasoning_content)
  push(message?.reasoning)
  push(choice?.reasoning)
  const walk = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const part of value) walk(part)
      return
    }
    if (!isReasoningPart(value) || !value || typeof value !== 'object') return
    const row = value as Record<string, unknown>
    push(row.text)
    push(row.content)
    push(row.summary)
  }
  walk(message?.content)
  walk(root.content)
  walk(root.output)
  return mergeThought(...bits)
}

function reasoningText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return mergeThought(...value.map(reasoningText))
  if (!value || typeof value !== 'object') return ''
  const row = value as Record<string, unknown>
  return mergeThought(
    typeof row.text === 'string' ? row.text : '',
    typeof row.content === 'string' ? row.content : '',
    reasoningText(row.summary),
  )
}

function joinContinuation(head: string, tail: string): string {
  if (tail.startsWith(head)) return tail
  if (head.endsWith(tail)) return head
  for (let size = Math.min(head.length, tail.length); size >= 12; size--) {
    if (head.slice(-size) === tail.slice(0, size)) return head + tail.slice(size)
  }
  return head + tail
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
  return /参数无效|参数错误|参数有误|参数校验|invalid parameter|invalidparameter|invalid_request|unsupported parameter|max_tokens|max_completion_tokens/i.test(message)
}

function explainParam(message: string): string {
  if (/请求参数校验失败|invalidparameter|参数校验失败/i.test(message)) {
    return '接口拒绝了这次请求的参数。多半是输出额度超过该模型上限，或这个模型不接受温度、采样和惩罚。可在「设置 → 连接」把输出额度调小，或换一个模型后再试。'
  }
  return message
}

/** 把模型写成两个字符的 \\n 还原成真正换行。已经有换行时不动。 */
function restoreBreaks(text: string): string {
  if (!text.includes('\\n') || text.includes('\n')) return text
  return text.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n')
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
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    const parts = value.map(partText)
    const texts = parts.map((part) => part.trim()).filter(Boolean)
    if (texts.length >= 2 && texts.every((part) => part.length >= 12) && parts.every((part) => !part.includes('\n'))) return texts.join('\n')
    return parts.join('')
  }
  if (typeof value === 'object') {
    return partText(value).trim()
  }
  return ''
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value
  }
  return ''
}

/** 兼容多种 OpenAI 兼容接口的返回格式 */
function extractContent(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const root = data as Record<string, unknown>
  const choice = (root.choices as Array<Record<string, unknown>> | undefined)?.[0]
  let text = ''
  if (choice) {
    const message = choice.message as Record<string, unknown> | undefined
    if (message) {
      const main = messageContent(message.content)
      if (main.trim()) text = main
      else text = pickString(message.output, message.text)
    }
    if (!text) text = pickString(choice.text, choice.content, messageContent(choice.message))
  }
  if (!text) text = pickString(messageContent(root.content), messageContent(root.output), root.output_text, root.response)
  return restoreBreaks(text)
}

/** 部分接口只允许开头一条 system，且 user / assistant 必须交替。失败后再用这套结构重试。 */
function strictMessages(messages: AIMessage[]): AIMessage[] {
  const systems: string[] = []
  const dialog: AIMessage[] = []
  for (const item of messages) {
    const content = item.content.trim()
    if (!content) continue
    if (item.role === 'system') {
      if (dialog.length === 0) systems.push(content)
      else {
        const last = dialog[dialog.length - 1]
        if (last?.role === 'user') last.content = `${last.content}\n\n${content}`
        else dialog.push({ role: 'user', content })
      }
      continue
    }
    const role = item.role === 'assistant' ? 'assistant' : 'user'
    const last = dialog[dialog.length - 1]
    if (last?.role === role) last.content = `${last.content}\n\n${content}`
    else dialog.push({ role, content })
  }
  const rows: AIMessage[] = []
  if (systems.length) rows.push({ role: 'system', content: systems.join('\n\n') })
  rows.push(...dialog)
  if (rows[rows.length - 1]?.role !== 'user') rows.push({ role: 'user', content: '请根据以上设定和对话继续，只输出正文。' })
  return rows
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

  static async fromStored(config: ApiConfig | undefined, key: string, generation?: GenerationSettings): Promise<AIAdapter> {
    if (!config?.endpoint) throw new AIError('还没有可用的接口。到设置里新建一张卡片。', 'config')
    if (!config.ready || !config.model) throw new AIError('先拉取模型，选一个，保存之后才能用。', 'config')
    if (!key.trim()) throw new AIError('这张卡片还没有密钥。', 'config')
    return new AIAdapter({ endpoint: config.endpoint, model: config.model, key, generation })
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

    const enabled = request.antiTruncation ?? this.config.generation?.antiTruncation ?? true
    const budget = enabled ? Math.max(request.maxTokens ?? 0, this.config.generation?.maxOutputTokens ?? DEFAULT_MAX_TOKENS) : request.maxTokens ?? DEFAULT_MAX_TOKENS
    const original: AIRequest = { ...request, maxTokens: budget, timeoutMs: Math.max(request.timeoutMs ?? 0, (this.config.generation?.timeoutSeconds ?? 180) * 1000) }
    let result = await this.completeWithRetry(original)
    let content = result.content
    let reasoning = result.reasoning?.trim() ?? ''
    let recovered = false
    if (enabled) {
      // At most two additional model generations. Never send hidden reasoning back to the provider.
      for (let round = 0; round < 2 && (!content || result.reasoningOnly || result.truncated); round++) {
        recovered = true
        const task = content
          ? '（应用的防截断续写任务，不是玩家新发言。）紧接上一条正文最后一个字符续写，只补未完成部分，不要重复开头、解释或重新输出全文。保持原有格式；JSON、HTML和代码应接着补全，直到完整结束。只输出正文，不输出思考过程。'
          : '（应用的正文恢复任务，不是玩家新发言。）上一轮没有返回可显示的正文。请遵守原任务和原输出格式，直接给出完整正文，简短完成，不输出思考过程或解释，不替玩家发言。'
        try {
          result = await this.openai({ ...original,
            maxTokens: Math.min(32768, budget * (round + 2)),
            messages: [...request.messages, ...(content ? [{ role: 'assistant' as const, content }] : []), { role: 'user', content: task }],
          }, Boolean(content))
        } catch (error) {
          if (content) return { content, reasoning, model: this.config.model, provider: 'openai', truncated: true, recovered: true }
          throw error
        }
        if (!reasoning && result.reasoning?.trim()) reasoning = result.reasoning.trim()
        const previous = content
        if (result.content) content = content ? joinContinuation(content, result.content) : result.content
        if (previous && content === previous) result.truncated = true
        // Empty continuation is not evidence that the previous partial answer is complete.
        if (!result.content && content) result.truncated = true
      }
    }
    if (!content) throw new AIError(result.reasoningOnly
      ? '接口只返回了思考内容，没有可显示的正文。请在 API 设置中增加输出额度，或使用能返回正文的模型。'
      : '接口返回了空正文，未能恢复。请检查接口或更换模型后重试。', 'api')
    return { content, reasoning, model: this.config.model, provider: 'openai', truncated: Boolean(result.truncated || result.reasoningOnly), recovered }
  }

  private async completeWithRetry(request: AIRequest): Promise<CompletionResult> {
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
      stream: false,
    }
    if (typeof request.topP === 'number' && request.topP > 0 && request.topP < 1) normal.top_p = request.topP
    if (request.frequencyPenalty) normal.frequency_penalty = request.frequencyPenalty
    if (request.presencePenalty) normal.presence_penalty = request.presencePenalty
    const budget = normal.max_tokens
    const rows: Array<Record<string, unknown>> = [
      normal,
      {
        model: this.config.model,
        messages,
        max_tokens: budget,
      },
      {
        model: this.config.model,
        messages,
        max_completion_tokens: budget,
      },
      {
        model: this.config.model,
        messages,
      },
    ]
    if (typeof budget === 'number') {
      for (const cap of [4096, 2048, 1024]) {
        if (budget > cap) rows.push({ model: this.config.model, messages, max_tokens: cap })
      }
    }
    const strict = strictMessages(messages)
    const same = strict.length === messages.length && strict.every((item, index) => item.role === messages[index]?.role && item.content === messages[index]?.content)
    if (!same) {
      rows.push({ model: this.config.model, messages: strict, max_tokens: typeof budget === 'number' ? Math.min(budget, 4096) : 4096 })
      rows.push({ model: this.config.model, messages: strict })
    }
    return rows
  }

  private async openai(request: AIRequest, continuation = false): Promise<CompletionResult> {
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
        if (apiErrorText(last) !== last) throw new AIError(apiErrorText(last), 'api', false, last)
        const retryable = response.status === 429 || response.status >= 500
        if (retryable) throw new AIError(last, 'network', retryable)
        if (response.status === 400 && invalidParam(last) && index < payloads.length - 1) continue
        const friendly = explainParam(last)
        throw new AIError(friendly, 'api', false, friendly === last ? undefined : last)
      }

      let data: unknown
      try { data = await response.json() } catch { throw new AIError('接口返回的数据不完整或不是 JSON，请重试或检查接口地址。', 'api') }
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        const detail = errorDetail(data.error) || '接口返回了错误，未生成正文。'
        throw new AIError(apiErrorText(detail), 'api', false, detail)
      }
      const feedback = data as { promptFeedback?: { blockReason?: string }; choices?: Array<{ finish_reason?: string }> } | null
      const blocked = feedback?.promptFeedback?.blockReason
      if ((blocked && blocked !== 'BLOCK_REASON_UNSPECIFIED') || feedback?.choices?.[0]?.finish_reason === 'content_filter') {
        const detail = `content_filter${blocked ? `: ${blocked}` : ''}`
        throw new AIError(apiErrorText(detail), 'api', false, detail)
      }
      const rawContent = extractContent(data)
      const split = takeReasoning(rawContent)
      const content = split.content
      const reasoning = mergeThought(apiReasoning(data), split.reasoning)
      const meta = data as { choices?: Array<{ finish_reason?: string }>; status?: string; incomplete_details?: { reason?: string }; stop_reason?: string } | null
      const reason = meta?.choices?.[0]?.finish_reason ?? meta?.incomplete_details?.reason ?? meta?.stop_reason
      const truncated = reason === 'length' || reason === 'max_tokens' || reason === 'max_output_tokens' || meta?.status === 'incomplete'
      if (reason === 'content_filter') throw new AIError('接口未生成正文，请查看所选模型的内容限制。', 'api')
      if (content) return {
        content: (continuation ? rawContent.match(/^\s*/)?.[0] ?? '' : '') + content + (truncated ? rawContent.match(/\s*$/)?.[0] ?? '' : ''),
        reasoning,
        model: this.config.model, provider: 'openai', truncated,
      }
      const root = data as { choices?: Array<{ message?: { reasoning_content?: unknown; reasoning?: unknown; content?: unknown } }>; content?: unknown; output?: unknown }
      const message = root?.choices?.[0]?.message
      const reasoningParts = [message?.content, root?.content, root?.output].some(value =>
        Array.isArray(value) ? value.some(isReasoningPart) : isReasoningPart(value))
      if (rawContent || message?.reasoning_content || message?.reasoning || reasoningParts || reasoning) {
        return { content: '', reasoning, model: this.config.model, provider: 'openai', reasoningOnly: true, truncated }
      }
      return { content: '', reasoning, model: this.config.model, provider: 'openai', truncated }
    }
    const friendly = explainParam(last)
    throw new AIError(friendly, 'api', false, friendly === last ? undefined : last)
  }
}
