import type { AIRequest, AIResponse, ApiConfig } from '../types/index.ts'

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

async function readError(response: Response): Promise<string> {
  const text = await response.text()
  if (!text) return `接口返回了 ${response.status}`
  try {
    const data = JSON.parse(text) as { error?: { message?: string } | string; message?: string }
    if (typeof data.error === 'string' && data.error) return data.error
    if (typeof data.error === 'object' && data.error?.message) return data.error.message
    if (data.message) return data.message
  } catch {
    return text.slice(0, 240)
  }
  return text.slice(0, 240)
}

function partText(part: unknown): string {
  if (typeof part === 'string') return part
  if (typeof part !== 'object' || !part) return ''
  const row = part as Record<string, unknown>
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
    const row = value as Record<string, unknown>
    if (typeof row.text === 'string') return row.text.trim()
    if (typeof row.content === 'string') return row.content.trim()
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
      const fallback = pickString(message.reasoning_content, message.output, message.text)
      if (fallback) return fallback
    }
    const direct = pickString(choice.text, choice.content, messageContent(choice.message))
    if (direct) return direct
  }
  return pickString(root.content, root.output, root.output_text, root.response)
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
    if (error instanceof TypeError) {
      return new AIError('连不上接口。浏览器直接请求时，多半是跨域。', 'network', true)
    }
    if (error instanceof Error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('timed out') || msg.includes('timeout') || msg.includes('abort') || msg.includes('signal')) {
        return new AIError('等了太久，接口没有回来。', 'network', true)
      }
    }
    return new AIError(error instanceof Error ? error.message : '请求失败了', 'api')
  }

  private async openai(request: AIRequest): Promise<AIResponse> {
    let response: Response
    try {
      response = await fetch(joinUrl(this.config.endpoint, '/chat/completions'), {
        method: 'POST',
        signal: AbortSignal.timeout(120_000),
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.key ? { Authorization: `Bearer ${this.config.key}` } : {}),
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: request.messages,
          temperature: request.temperature,
          top_p: request.topP,
          ...(request.frequencyPenalty ? { frequency_penalty: request.frequencyPenalty } : {}),
          ...(request.presencePenalty ? { presence_penalty: request.presencePenalty } : {}),
          max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
        }),
      })
    } catch (error) {
      throw AIAdapter.asNetworkError(error)
    }

    if (!response.ok) {
      const message = await readError(response)
      const retryable = response.status === 429 || response.status >= 500
      throw new AIError(message, retryable ? 'network' : 'api', retryable)
    }

    const data = (await response.json()) as unknown
    const content = extractContent(data)
    if (!content) throw new AIError('接口回来了，但没有文字。', 'api', true)
    return { content, model: this.config.model, provider: 'openai' }
  }
}
