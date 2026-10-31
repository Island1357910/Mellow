import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright')
const appUrl = process.env.APP_URL || 'http://127.0.0.1:5180/'
const origin = new URL(appUrl).origin
const methods = [], requests = [], outbound = []
let empty = false
const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, MCP-Protocol-Version, Mcp-Session-Id')
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id')
  if (req.method === 'OPTIONS') { methods.push('OPTIONS'); res.writeHead(204).end(); return }
  let raw = ''; for await (const chunk of req) raw += chunk
  const message = JSON.parse(raw)
  requests.push({ method: message.method, origin: req.headers.origin, auth: req.headers.authorization, session: req.headers['mcp-session-id'] })
  if (message.id === undefined) { res.writeHead(202).end(); return }
  const result = message.method === 'initialize' ? { protocolVersion: '2025-11-25', capabilities: { tools: {} }, serverInfo: { name: 'test', version: '1' } }
    : message.method === 'tools/list' ? { tools: empty ? [] : [{ name: 'read_song', description: '测试歌曲查询', inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true } }] }
    : { content: [{ type: 'text', text: '浏览器直连查询成功' }] }
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Mcp-Session-Id', 'browser-test-session')
  res.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }))
})
await new Promise(resolve => server.listen(5191, '127.0.0.1', resolve))
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.on('request', request => { const url = new URL(request.url()); if (url.hostname !== '127.0.0.1') outbound.push(url.hostname) })
  await page.goto(appUrl)
  await page.waitForFunction(async () => (await import('/src/store/useMellow.ts')).useMellow.getState().ready)
  await page.waitForTimeout(500)
  await page.evaluate(async () => { const { useMellow } = await import('/src/store/useMellow.ts'); useMellow.getState().openApp('connections') })
  await page.getByRole('tab', { name: 'MCP 直连' }).waitFor()
  assert.equal(await page.getByRole('tab', { name: '网易云', exact: true }).getAttribute('aria-selected'), 'true')
  await page.getByRole('tab', { name: 'MCP 直连' }).click()
  await page.getByLabel('MCP 服务地址', { exact: true }).fill('http://127.0.0.1:5191/mcp')
  await page.getByLabel('MCP 令牌', { exact: true }).fill('test-memory-only')
  await page.screenshot({ path: 'artifacts/web-mcp-direct-form.png' })
  await page.getByRole('button', { name: '连接并发现工具', exact: true }).click()
  await page.getByText('已连接，1 个工具', { exact: true }).waitFor()
  await page.getByRole('button', { name: '执行工具', exact: true }).click()
  await page.getByText('工具已返回结果', { exact: true }).waitFor()
  assert.ok(await page.locator('pre').filter({ hasText: '浏览器直连查询成功' }).count())
  assert.ok(methods.includes('OPTIONS'), 'Browser CORS preflight must succeed')
  assert.ok(requests.some(r => r.method === 'tools/call' && r.auth === 'Bearer test-memory-only' && r.session === 'browser-test-session' && r.origin === origin))
  assert.ok(!outbound.some(host => host.endsWith('chatgpt.site')), 'Must not contact the built-in cloud')
  empty = true
  await page.getByRole('button', { name: '重新连接并发现工具', exact: true }).click()
  await page.getByText('已连接，0 个工具', { exact: true }).waitFor()
  await page.getByRole('button', { name: '断开连接', exact: true }).click()
  await page.getByText('未连接', { exact: true }).waitFor()
  console.log('Web MCP verified: separate account and MCP tabs, real browser CORS, Bearer auth, session header, tool call, empty-tool status, disconnect, no built-in cloud request')
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)) }
