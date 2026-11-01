// Alibaba Cloud FC 3.0 / Node.js 20 event handler. No request or credential logging.
import { webcrypto } from 'node:crypto'
import { AccountError, accountAction, sessionFromHeaders } from './netease.mjs'
globalThis.crypto ??= webcrypto
const allowedOrigins = new Set(['https://mymellow.top', 'https://www.mymellow.top'])
const actions = new Set(['qr_start', 'qr_check', 'profile', 'playlists', 'playlist', 'song', 'search'])
const counters = new Map()
function rateLimit(ip) {
  const now = Date.now(), old = counters.get(ip)
  if (old && old.until > now) {
    if (old.count >= 80) throw new AccountError('请求过于频繁，请稍后再试', 429)
    old.count++; return
  }
  if (counters.size >= 2000) for (const [key, value] of counters) if (value.until <= now) counters.delete(key)
  if (counters.size >= 2000) throw new AccountError('服务繁忙，请稍后再试', 429)
  counters.set(ip, { count: 1, until: now + 60_000 })
}
export async function handler(event) {
  let headers = new Headers(), origin = ''
  const response = (statusCode, data) => ({ statusCode, isBase64Encoded: false, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, private', Pragma: 'no-cache', Vary: 'Origin',
    ...(allowedOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '600' } : {}),
  }, body: statusCode === 204 ? '' : JSON.stringify(data) })
  try {
    const rawEvent = Buffer.isBuffer(event) || typeof event === 'string' ? String(event) : null
    if (rawEvent && Buffer.byteLength(rawEvent) > 32_768) throw new AccountError('请求过大', 413)
    const request = rawEvent === null ? event : JSON.parse(rawEvent)
    if (!request || typeof request !== 'object') throw new AccountError('需要 HTTP 触发器请求', 400)
    headers = new Headers(request.headers ?? {}); origin = headers.get('origin') ?? ''
    const method = request.requestContext?.http?.method?.toUpperCase()
    const path = request.rawPath ?? request.requestContext?.http?.path ?? '/'
    if (method === 'GET' && path === '/health') return response(200, { ok: true, service: 'mellow-netease' })
    if (!['/', '/api/account'].includes(path)) return response(404, { error: '接口路径不存在' })
    if (!allowedOrigins.has(origin)) return response(403, { error: '请从半糖 HTTPS 网页连接账号' })
    if (method === 'OPTIONS') return response(204, null)
    if (method !== 'POST') return response(405, { error: '此接口需要 POST 请求' })
    rateLimit(String(request.requestContext?.http?.sourceIp ?? 'shared'))
    if (!(headers.get('content-type') ?? '').includes('application/json')) throw new AccountError('需要 JSON 请求', 415)
    if (typeof request.body !== 'string' || request.body.length > 8192) throw new AccountError('请求体无效或过大', 413)
    const body = request.isBase64Encoded ? Buffer.from(request.body, 'base64').toString('utf8') : request.body
    if (Buffer.byteLength(body) > 4096) throw new AccountError('请求过大', 413)
    const input = JSON.parse(body)
    if (!input || typeof input !== 'object' || !actions.has(input.action)) throw new AccountError('操作不受支持', 400)
    const cookie = ['qr_start', 'qr_check'].includes(input.action) ? '' : sessionFromHeaders(headers)
    return response(200, await accountAction(input.action, input, cookie))
  } catch (error) {
    return response(error instanceof AccountError ? error.status : error instanceof SyntaxError ? 400 : 502,
      { error: error instanceof AccountError ? error.message : error instanceof SyntaxError ? '请求格式不正确' : '账号接口暂时不可用，请稍后重试' })
  }
}
