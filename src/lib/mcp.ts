/** MCP 2025 Streamable HTTP 客户端。令牌只驻留内存，JSON 与 SSE 响应均可读取。 */
export interface McpTool { name: string; description?: string; inputSchema?: Record<string, unknown> }
export class McpClient {
  private serial = 0
  private session = ''
  private version = '2025-11-25'
  private endpoint: string
  private token: string
  constructor(endpoint: string, token = '') {
    this.endpoint = endpoint
    this.token = token
    const url = new URL(endpoint)
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))) throw new Error('请使用 HTTPS MCP 地址，本机服务可用 HTTP')
  }
  private async rpc(method: string, params?: unknown, notification = false): Promise<unknown> {
    const id = ++this.serial
    const response = await fetch(this.endpoint, {
      method: 'POST', signal: AbortSignal.timeout(60_000), credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': this.version, ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}), ...(this.session ? { 'Mcp-Session-Id': this.session } : {}) },
      body: JSON.stringify({ jsonrpc: '2.0', ...(!notification ? { id } : {}), method, ...(params === undefined ? {} : { params }) }),
    })
    if (!response.ok) throw new Error(`MCP ${response.status}：请检查地址、授权及服务端 CORS 设置`)
    const session = response.headers.get('Mcp-Session-Id'); if (session) this.session = session
    if (notification || response.status === 202) { await response.body?.cancel(); return null }
    const check = (msg: { id?: number; error?: { message: string }; result?: unknown }) => { if(msg.error) throw new Error(msg.error.message);return msg.result }
    if (!(response.headers.get('content-type') ?? '').includes('text/event-stream')) return check(await response.json())
    const reader = response.body?.getReader(); if(!reader) throw new Error('MCP 没有返回内容')
    const decoder = new TextDecoder(); let buffer = ''
    try {
      while (true) {
        const { done, value } = await reader.read(); if(done) break
        buffer = (buffer + decoder.decode(value,{stream:true})).replace(/\r\n/g,'\n')
        let end: number
        while ((end=buffer.indexOf('\n\n')) >= 0) {
          const frame=buffer.slice(0,end);buffer=buffer.slice(end+2)
          const data=frame.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n')
          if(!data) continue
          const msg=JSON.parse(data);if(msg.id===id) return check(msg)
        }
      }
      throw new Error('MCP 流结束，未收到对应结果')
    } finally { await reader.cancel().catch(()=>{});reader.releaseLock() }
  }
  async connect(): Promise<McpTool[]> {
    const info = await this.rpc('initialize',{protocolVersion:this.version,capabilities:{},clientInfo:{name:'mellow',version:'0.2.0'}}) as { protocolVersion?: string }
    if(info?.protocolVersion) this.version=info.protocolVersion
    await this.rpc('notifications/initialized',undefined,true)
    const all: McpTool[]=[];let cursor: string|undefined
    do { const page=await this.rpc('tools/list',cursor?{cursor}:{}) as {tools:McpTool[];nextCursor?:string};all.push(...(page.tools??[]));cursor=page.nextCursor;if(all.length>500) break } while(cursor)
    return all
  }
  call(name: string, args: Record<string, unknown>): Promise<unknown> { return this.rpc('tools/call',{name,arguments:args}) }
}
