/** 浏览器 MCP 客户端：Streamable HTTP 与旧版 HTTP+SSE。凭据仅驻留内存。 */
export type McpTransport = 'http' | 'sse'
export interface McpTool { name: string; description?: string; inputSchema?: Record<string, unknown>; annotations?: { readOnlyHint?: boolean } }
interface RpcMessage { id?: number; result?: unknown; error?: { message: string }; method?: string }
interface Pending { resolve: (value: unknown) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> }

export function mcpUrl(raw: string): URL {
  const url = new URL(raw)
  if (url.username || url.password) throw Error('服务地址不能包含帐号密码，请使用令牌栏')
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw Error('请使用 HTTPS MCP 地址，本机服务可用 HTTP')
  return url
}
async function readEvents(body: ReadableStream<Uint8Array>, onEvent: (event: string, data: string) => boolean | void): Promise<void> {
  const reader = body.getReader(), decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const chunk = await reader.read()
      buffer = (buffer + decoder.decode(chunk.value, { stream: !chunk.done })).replace(/\r\n/g, '\n')
      let at: number
      while ((at = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, at); buffer = buffer.slice(at + 2)
        let event = 'message'
        const data: string[] = []
        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim()
          if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
        }
        if (data.length && onEvent(event, data.join('\n')) === false) return
      }
      if (buffer.length > 8_000_000) throw Error('MCP 事件过大，请缩小查询范围')
      if (chunk.done) break
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
}
export class McpClient {
  private serial = 0
  private session = ''
  private version = '2025-11-25'
  private endpoint: string
  private token: string
  private transport: McpTransport
  private postEndpoint = ''
  private stream: AbortController | null = null
  private pending = new Map<number, Pending>()
  private endpointReject: ((reason: Error) => void) | null = null
  private closed = false
  constructor(endpoint: string, token = '', transport: McpTransport = 'http') {
    this.endpoint = mcpUrl(endpoint.trim()).href
    this.token = token.trim(); this.transport = transport
  }
  close(reason = 'MCP 已断开，请重新连接'): void {
    this.closed = true; this.stream?.abort(); this.stream = null; this.postEndpoint = ''
    const error = Error(reason)
    this.endpointReject?.(error); this.endpointReject = null
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error) }
    this.pending.clear()
  }
  private headers(): Record<string, string> {
    return { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(this.transport === 'http' ? { 'MCP-Protocol-Version': this.version } : {}), ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}), ...(this.session ? { 'Mcp-Session-Id': this.session } : {}) }
  }
  private value(message: RpcMessage): unknown { if (message.error) throw Error(message.error.message); return message.result }
  private receive(message: RpcMessage): void {
    if (message.id === undefined || message.method) return
    const pending = this.pending.get(message.id)
    if (!pending) return
    this.pending.delete(message.id); clearTimeout(pending.timer)
    try { pending.resolve(this.value(message)) } catch (e) { pending.reject(e instanceof Error ? e : Error(String(e))) }
  }
  private async openSse(): Promise<void> {
    this.stream = new AbortController()
    const controller = this.stream
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => this.close('SSE 连接超时：未收到 endpoint 事件，请检查地址、跨域配置与服务是否运行'), 15_000)
      this.endpointReject = error => { clearTimeout(timer); reject(error) }
      void (async () => {
        const response = await fetch(this.endpoint, { method: 'GET', credentials: 'omit', headers: { Accept: 'text/event-stream', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) }, signal: controller.signal, redirect: 'error' })
        if (!response.ok || !response.body || !(response.headers.get('content-type') ?? '').includes('text/event-stream')) throw Error(`SSE ${response.status}：地址应指向服务的 SSE 入口，通常以 /sse 结尾`)
        await readEvents(response.body, (event, data) => {
          if (event === 'endpoint') {
            if (this.postEndpoint) return
            const target = mcpUrl(new URL(data.trim(), this.endpoint).href)
            if (target.origin !== new URL(this.endpoint).origin) throw Error('SSE 返回了其他域名的消息地址，已停止连接')
            this.postEndpoint = target.href; clearTimeout(timer); this.endpointReject = null; resolve()
          } else if (event === 'message') this.receive(JSON.parse(data) as RpcMessage)
        })
        if (!controller.signal.aborted) this.close('SSE 服务已断开，请重新连接')
      })().catch(e => { if (!controller.signal.aborted) this.close(e instanceof Error ? e.message : String(e)) })
    })
  }
  private async rpc(method: string, params?: unknown, notification = false): Promise<unknown> {
    if (this.closed) throw Error('MCP 已断开，请重新连接')
    const id = ++this.serial
    let waiting: Promise<unknown> | undefined
    if (this.transport === 'sse' && !notification) {
      waiting = new Promise((resolve, reject) => {
        const timer = setTimeout(() => { this.pending.delete(id); reject(Error('MCP 工具响应超时，请检查服务运行状态')) }, 60_000)
        this.pending.set(id, { resolve, reject, timer })
      })
      void waiting.catch(() => {})
    }
    try {
      const response = await fetch(this.transport === 'sse' ? this.postEndpoint : this.endpoint, {
        method: 'POST', signal: AbortSignal.timeout(60_000), credentials: 'omit', redirect: 'error', headers: this.headers(),
        body: JSON.stringify({ jsonrpc: '2.0', ...(!notification ? { id } : {}), method, ...(params === undefined ? {} : { params }) }),
      })
      if (!response.ok) throw Error(`MCP ${response.status}：请检查连接类型、地址、授权及服务端跨域设置`)
      const session = response.headers.get('Mcp-Session-Id'); if (session) this.session = session
      if (notification) { await response.body?.cancel(); return null }
      if (response.status === 202) {
        await response.body?.cancel()
        if (waiting) return await waiting
        throw Error('MCP 接收了请求，但没有返回结果；请检查是否应选择旧版 SSE')
      }
      if (!(response.headers.get('content-type') ?? '').includes('text/event-stream')) {
        const message = await response.json() as RpcMessage
        if (message.id !== id) throw Error('MCP 返回的请求编号不匹配')
        if (waiting) { this.receive(message); return await waiting }
        return this.value(message)
      }
      if (!response.body) throw Error('MCP 没有返回内容')
      let found = false, result: unknown
      await readEvents(response.body, (_event, data) => {
        const message = JSON.parse(data) as RpcMessage
        if (message.id !== id) return
        if (waiting) this.receive(message)
        else result = this.value(message)
        found = true; return false
      })
      if (waiting) return await waiting
      if (!found) throw Error('MCP 流结束，未收到对应结果')
      return result
    } catch (e) {
      const pending = this.pending.get(id)
      if (pending) { clearTimeout(pending.timer); pending.reject(e instanceof Error ? e : Error(String(e))); this.pending.delete(id) }
      throw e
    }
  }
  async connect(): Promise<McpTool[]> {
    this.close(); this.closed = false; this.session = ''
    this.version = this.transport === 'sse' ? '2024-11-05' : '2025-11-25'
    try {
      if (this.transport === 'sse') await this.openSse()
      const info = await this.rpc('initialize', { protocolVersion: this.version, capabilities: {}, clientInfo: { name: 'mellow', version: '1.0.3' } }) as { protocolVersion?: string }
      if (info?.protocolVersion) this.version = info.protocolVersion
      await this.rpc('notifications/initialized', undefined, true)
      const all: McpTool[] = [], cursors = new Set<string>()
      let cursor: string | undefined
      do {
        const page = await this.rpc('tools/list', cursor ? { cursor } : {}) as { tools?: McpTool[]; nextCursor?: string }
        all.push(...(page.tools ?? []).filter(t => typeof t.name === 'string'))
        cursor = page.nextCursor
        if (cursor && cursors.has(cursor)) throw Error('MCP 工具列表分页重复，请检查服务')
        if (cursor) cursors.add(cursor)
      } while (cursor && all.length <= 500)
      return all
    } catch (e) { this.close(); throw e }
  }
  call(name: string, args: Record<string, unknown>): Promise<unknown> { return this.rpc('tools/call', { name, arguments: args }) }
}
