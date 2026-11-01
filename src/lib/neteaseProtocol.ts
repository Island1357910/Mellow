// Web API interoperability, based on the publicly documented weapi format.
// Reference: NeteaseCloudMusicApiEnhanced/api-enhanced (MIT, Binaryify).
type Row = Record<string, any>
const ORIGIN = 'https://music.163.com'
const SPKI = 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvaklV8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44oncaTWz7OBGLbCiK45wIDAQAB'
const bytes = (s: string) => new TextEncoder().encode(s)
const b64 = (data: Uint8Array) => btoa(String.fromCharCode(...data))
let modulus: Promise<bigint> | undefined
async function aes(text: string, key: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', bytes(key), 'AES-CBC', false, ['encrypt'])
  return b64(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: bytes('0102030405060708') }, k, bytes(text))))
}
export async function weapi(data: Row): Promise<URLSearchParams> {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const random = crypto.getRandomValues(new Uint8Array(16))
  const key = [...random].map(n => alphabet[n % alphabet.length]).join('')
  modulus ??= crypto.subtle.importKey('spki', Uint8Array.from(atob(SPKI), c => c.charCodeAt(0)), { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt']).then(k => crypto.subtle.exportKey('jwk', k)).then(jwk => {
    const raw = atob(jwk.n!.replace(/-/g, '+').replace(/_/g, '/'))
    return BigInt('0x' + [...raw].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(''))
  })
  const n = await modulus
  let base = BigInt('0x' + [...key].reverse().map(c => c.charCodeAt(0).toString(16)).join('')), exponent = 65537n, encrypted = 1n
  while (exponent) { if (exponent & 1n) encrypted = encrypted * base % n; base = base * base % n; exponent >>= 1n }
  return new URLSearchParams({ params: await aes(await aes(JSON.stringify(data), '0CoJUm6Qyw8W8jud'), key), encSecKey: encrypted.toString(16).padStart(256, '0') })
}
export class AccountError extends Error {
  status: number
  constructor(message: string, status = 400) { super(message); this.status = status }
}
export function cleanCookie(raw: string): string {
  if (raw.length > 16_000 || /[\r\n]/.test(raw)) throw new AccountError('登录凭据格式不正确', 401)
  const allowed = new Set(['MUSIC_U', '__csrf', 'NMTID'])
  return raw.split(';').map(pair => pair.trim()).filter(pair => {
    const at = pair.indexOf('=')
    return at > 0 && allowed.has(pair.slice(0, at)) && /^[\x21-\x7E]+$/.test(pair.slice(at + 1)) && !/[",\\]/.test(pair.slice(at + 1))
  }).join('; ')
}
export function sessionFromHeaders(headers: Headers): string {
  const auth = headers.get('authorization') ?? ''
  try { return cleanCookie(atob(auth.replace(/^Bearer\s+/i, ''))) } catch { throw new AccountError('登录已失效，请重新授权', 401) }
}
function cookiesFrom(response: Response): string {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  const lines = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? '']
  const pairs: string[] = []
  for (const line of lines) for (const match of line.matchAll(/(?:^|,\s*)(MUSIC_U|__csrf|NMTID)=([^;,\r\n]+)/g)) pairs.push(match[1] + '=' + match[2])
  return cleanCookie(pairs.join('; '))
}
export async function accountRequest(path: string, data: Row, cookie = ''): Promise<{ data: Row; cookie: string }> {
  if (!path.startsWith('/api/') || path.includes('?')) throw new AccountError('接口路径不正确')
  const csrf = cookie.match(/(?:^|;\s*)__csrf=([^;]+)/)?.[1] ?? ''
  const response = await fetch(ORIGIN + path.replace(/^\/api\//, '/weapi/'), {
    method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(15_000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: ORIGIN + '/', 'User-Agent': 'Mozilla/5.0', Cookie: 'os=pc; appver=3.1.17; ' + cookie },
    body: await weapi({ ...data, csrf_token: csrf }),
  })
  if (!response.ok) throw new AccountError('网易云暂时无法连接，请稍后重试', 502)
  const body = await response.json() as Row
  return { data: body, cookie: cookiesFrom(response) }
}
function numeric(value: unknown): string {
  if (!/^\d{1,20}$/.test(String(value ?? ''))) throw new AccountError('编号格式不正确')
  return String(value)
}
async function profile(cookie: string, request = accountRequest): Promise<Row> {
  if (!/(?:^|;\s*)MUSIC_U=/.test(cookie)) throw new AccountError('请先登录网易云', 401)
  const { data } = await request('/api/w/nuser/account/get', {}, cookie)
  if (data.code !== 200 || !data.profile?.userId) throw new AccountError('登录已失效，请重新授权', 401)
  return { id: String(data.profile.userId), name: String(data.profile.nickname ?? '网易云用户') }
}
export async function accountAction(action: string, input: Row, cookie: string, request = accountRequest): Promise<Row> {
  if (action === 'qr_start') {
    const result = await request('/api/login/qrcode/unikey', { type: 3 })
    const key = result.data.unikey
    if (result.data.code !== 200 || typeof key !== 'string' || !/^[\w-]{8,256}$/.test(key)) throw new AccountError('网易云未能生成登录码，请稍后重试', 502)
    return { key, url: ORIGIN + '/login?codekey=' + encodeURIComponent(key), expiresIn: 120 }
  }
  if (action === 'qr_check') {
    if (typeof input.key !== 'string' || !/^[\w-]{8,256}$/.test(input.key)) throw new AccountError('登录码格式不正确')
    const result = await request('/api/login/qrcode/client/login', { key: input.key, type: 3 })
    const code = Number(result.data.code)
    if (code === 803) {
      const user = await profile(result.cookie, request)
      return { state: 'authorized', user, session: btoa(result.cookie) }
    }
    if (code === 800) return { state: 'expired' }
    if (code === 801) return { state: 'waiting' }
    if (code === 802) return { state: 'confirm' }
    throw new AccountError('网易云未能确认授权，请刷新登录码重试', 502)
  }
  const user = await profile(cookie, request)
  if (action === 'profile') return { user }
  if (action === 'playlists') {
    const offset = Math.max(0, Math.min(5000, Number(input.offset) || 0))
    const { data } = await request('/api/user/playlist', { uid: user.id, limit: 30, offset, includeVideo: false }, cookie)
    if (data.code !== 200 || !Array.isArray(data.playlist)) throw new AccountError('暂时无法读取歌单', 502)
    return { user, more: Boolean(data.more), playlists: data.playlist.map((p: Row) => ({ id: String(p.id), name: String(p.name), count: Number(p.trackCount) || 0, mine: String(p.creator?.userId) === user.id })) }
  }
  if (action === 'search') {
    const keywords = typeof input.keywords === 'string' ? input.keywords.trim().slice(0, 100) : ''
    if (!keywords) throw new AccountError('请输入歌名或歌手')
    const offset = Math.max(0, Math.min(10000, Math.floor(Number(input.offset) || 0)))
    const { data } = await request('/api/cloudsearch/pc', { s: keywords, type: 1, limit: 30, offset, total: true }, cookie)
    if (data.code !== 200 || !data.result) throw new AccountError('搜索暂时不可用，请稍后重试', 502)
    return { total: Number(data.result.songCount) || 0, songs: (data.result.songs ?? []).map((s: Row) => ({ id: String(s.id), name: String(s.name), artist: (s.ar ?? s.artists ?? []).map((a: Row) => String(a.name)).join(' / ') })) }
  }
  if (action === 'playlist') {
    const id = numeric(input.id), offset = Math.max(0, Math.min(10000, Number(input.offset) || 0))
    const { data } = await request('/api/v6/playlist/detail', { id, n: 1000, s: 0 }, cookie)
    if (data.code !== 200 || !data.playlist) throw new AccountError('无法读取此歌单，请检查账号权限', 403)
    const ids = (data.playlist.trackIds ?? []).slice(offset, offset + 30).map((t: Row) => numeric(t.id))
    let songs = (data.playlist.tracks ?? []).filter((t: Row) => ids.includes(String(t.id)))
    if (songs.length !== ids.length && ids.length) {
      const details = await request('/api/v3/song/detail', { c: JSON.stringify(ids.map((id: string) => ({ id }))), ids: JSON.stringify(ids) }, cookie)
      songs = details.data.songs ?? []
    }
    return { title: String(data.playlist.name), total: Number(data.playlist.trackCount) || 0, songs: songs.map((s: Row) => ({ id: String(s.id), name: String(s.name), artist: (s.ar ?? s.artists ?? []).map((a: Row) => String(a.name)).join(' / ') })) }
  }
  if (action === 'song') {
    const id = numeric(input.id)
    const [audio, lyric] = await Promise.all([
      request('/api/song/enhance/player/url', { ids: JSON.stringify([id]), br: 128000 }, cookie),
      request('/api/song/lyric', { id, lv: 1, kv: 1, tv: -1 }, cookie).catch(() => ({ data: {} as Row, cookie: '' })),
    ])
    const item = audio.data.data?.[0]
    if (audio.data.code !== 200 || item?.code !== 200 || typeof item.url !== 'string') throw new AccountError('此账号暂时没有这首歌的可用音频，请换歌或在网易云内播放', 403)
    const url = new URL(item.url)
    if (!/(^|\.)music\.126\.net$|(^|\.)music\.163\.com$/.test(url.hostname) || !['http:', 'https:'].includes(url.protocol)) throw new AccountError('音乐平台返回了无法识别的音频地址', 502)
    url.protocol = 'https:'
    return { src: url.href, lyrics: typeof lyric.data.lrc?.lyric === 'string' ? lyric.data.lrc.lyric : '', trial: Boolean(item.freeTrialInfo) }
  }
  throw new AccountError('不支持这个账号操作')
}
