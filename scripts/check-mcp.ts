import assert from 'node:assert/strict'
import { McpClient } from '../src/lib/mcp.ts'
import { adaptMusic, adaptReading, parseMcpConfig, toolArgs } from '../src/lib/mcpConfig.ts'

assert.deepEqual(parseMcpConfig('{"mcpServers":{"music":{"url":"https://example.test/sse","headers":{"Authorization":"Bearer secret"}}}}'), { endpoint: 'https://example.test/sse', token: 'secret', transport: 'sse' })
assert.equal(parseMcpConfig('https://example.test/mcp').transport, 'http')
assert.throws(() => parseMcpConfig('{"mcpServers":{"a":{"command":"npx"}}}'), /STDIO/)
assert.throws(() => parseMcpConfig('{"mcpServers":{"a":{},"b":{}}}'), /一次导入一个/)
assert.throws(() => parseMcpConfig('https://user:pass@example.test/mcp'), /帐号密码/)
assert.throws(() => parseMcpConfig('{"url":"https://example.test/mcp","headers":{"Cookie":"secret"}}'), /自定义请求头/)
assert.throws(() => toolArgs('{}', { name: 'search', inputSchema: { required: ['query'] } }), /必填/)
assert.throws(() => toolArgs('{"count":1.5}', { name: 'search', inputSchema: { properties: { count: { type: 'integer' } } } }), /integer/)
assert.equal(adaptMusic({ lrc: { lyric: '[00:01]真实歌词' } }, '我的歌').lyrics, '[00:01]真实歌词')
assert.equal(adaptMusic({ track: { title: '歌曲', artists: [{ name: '甲' }], currentTime: 12, lyric: '歌词' } }).artist, '甲')
assert.throws(() => adaptMusic({ text: '[music:123:歌曲:歌手:https://example.test/cover.jpg]' }, '歌曲'), /卡片标记/)
assert.deepEqual(adaptReading({ data: { name: '第三章', content: '正文' } }), { title: '第三章', text: '正文' })

const originalFetch = globalThis.fetch, encoder = new TextEncoder()
let stream: ReadableStreamDefaultController<Uint8Array>
let mode: 'standard' | 'direct' | 'hold' | 'foreign' = 'standard'
const posted: string[] = []
globalThis.fetch = async (input, init) => {
  const url = String(input)
  if (init?.method === 'GET') {
    return new Response(new ReadableStream({
      start(controller) {
        stream = controller
        const endpoint = mode === 'foreign' ? 'https://other.test/messages' : '/messages?session=abc'
        // CRLF 跨分块，包含心跳注释。
        controller.enqueue(encoder.encode(': ping\r'))
        controller.enqueue(encoder.encode('\nevent: endpoint\r\ndata: ' + endpoint + '\r\n\r\n'))
        init.signal?.addEventListener('abort', () => { try { controller.close() } catch { /* already closed */ } }, { once: true })
      },
    }), { headers: { 'Content-Type': 'text/event-stream' } })
  }
  posted.push(url)
  assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer local-secret')
  assert.equal(new URL(url).origin, 'https://example.test')
  const body = JSON.parse(String(init?.body))
  if (body.method === 'notifications/initialized') return new Response(null, { status: 202 })
  const result = body.method === 'initialize' ? { protocolVersion: '2024-11-05' } : body.method === 'tools/list' ? { tools: [{ name: 'get_lyric', inputSchema: { type: 'object', properties: { song_id: { type: 'string' } } } }] } : { content: [{ type: 'text', text: body.params.arguments.song_id + '中文歌词' }] }
  const message = { jsonrpc: '2.0', id: body.id, ...(body.params?.arguments?.song_id === 'error' ? { error: { message: '查询失败' } } : { result }) }
  if (mode === 'direct') return new Response(JSON.stringify(message), { headers: { 'Content-Type': 'application/json' } })
  if (mode !== 'hold') {
    // 并发调用乱序返回，且 UTF-8 多字节字符被拆分。
    const frame = encoder.encode('event: message\ndata: ' + JSON.stringify(message) + '\n\n')
    const index = frame.findIndex(v => v > 127)
    setTimeout(() => {
      stream.enqueue(frame.slice(0, index >= 0 ? index + 1 : 7))
      stream.enqueue(frame.slice(index >= 0 ? index + 1 : 7))
    }, body.params?.arguments?.song_id === 'slow' ? 15 : 1)
  }
  return new Response(null, { status: 202 })
}
try {
  const client = new McpClient('https://example.test/sse', 'local-secret', 'sse')
  assert.equal((await client.connect())[0]?.name, 'get_lyric')
  const [slow, fast] = await Promise.all([client.call('get_lyric', { song_id: 'slow' }), client.call('get_lyric', { song_id: 'fast' })]) as Array<{ content: { text: string }[] }>
  assert.equal(slow.content[0].text, 'slow中文歌词'); assert.equal(fast.content[0].text, 'fast中文歌词')
  await assert.rejects(client.call('get_lyric', { song_id: 'error' }), /查询失败/)
  mode = 'hold'
  const waiting = client.call('get_lyric', { song_id: 'pending' })
  client.close()
  await assert.rejects(waiting, /断开/)
  mode = 'direct'
  const direct = new McpClient('https://example.test/sse', 'local-secret', 'sse')
  assert.equal((await direct.connect()).length, 1)
  assert.match(JSON.stringify(await direct.call('get_lyric', { song_id: 'direct' })), /direct中文歌词/)
  direct.close()
  mode = 'foreign'
  const foreign = new McpClient('https://example.test/sse', 'local-secret', 'sse')
  const before = posted.length
  await assert.rejects(foreign.connect(), /其他域名/)
  assert.equal(posted.length, before, '不能向其他域名发送令牌和请求')
} finally { globalThis.fetch = originalFetch }
console.log('MCP regression ok: legacy SSE lifecycle, concurrent/out-of-order UTF-8 responses, direct JSON compatibility, disconnect/errors, endpoint origin, config import and content adapters')
