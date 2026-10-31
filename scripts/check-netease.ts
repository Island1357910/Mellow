import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { createDecipheriv } from 'node:crypto'
import { accountAction, cleanCookie, sessionFromHeaders, weapi } from '../services/mellow-music-cloud/lib/neteaseAccount.ts'
import { accountSupported, forgetNeteaseAccount, neteaseAccountCall, readNeteaseAccount, saveNeteaseAccount } from '../src/lib/neteaseAccount.ts'

const originalRandom = crypto.getRandomValues.bind(crypto)
crypto.getRandomValues = ((array: Uint8Array) => { array.fill(0); return array }) as typeof crypto.getRandomValues
const originalFetch = globalThis.fetch
const decrypt = (text: string, key: string) => { const d = createDecipheriv('aes-128-cbc', key, '0102030405060708'); return Buffer.concat([d.update(Buffer.from(text, 'base64')), d.final()]).toString('utf8') }
const decodeRequest = (body: unknown) => JSON.parse(decrypt(decrypt(new URLSearchParams(String(body)).get('params')!, 'a'.repeat(16)), '0CoJUm6Qyw8W8jud'))
const encrypted = await weapi({ test: '中文' })
assert.deepEqual(decodeRequest(encrypted), { test: '中文' })
assert.equal(encrypted.get('encSecKey')?.length, 256)
assert.throws(() => cleanCookie('MUSIC_U=x\r\nOther: bad'), /格式/)
assert.equal(cleanCookie('MUSIC_U=fake-a; __csrf=csrf-a; ignored=secret'), 'MUSIC_U=fake-a; __csrf=csrf-a')
assert.throws(() => sessionFromHeaders(new Headers({ Authorization: 'Bearer not-base64!' })), /失效/)
let qrCode = 801, requests = 0, invalidAudio = false
const seen: Array<{ path: string; cookie: string; args: Record<string, unknown> }> = []
globalThis.fetch = async (input, init) => {
  requests++
  const url = new URL(String(input)); assert.equal(url.origin, 'https://music.163.com')
  const cookie = new Headers(init?.headers).get('Cookie') ?? ''
  assert.equal(new Headers(init?.headers).has('Authorization'), false, '下游认证头不能原样传给音乐平台')
  const args = decodeRequest(init?.body)
  seen.push({ path: url.pathname, cookie, args })
  let data: unknown
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (url.pathname.endsWith('/login/qrcode/unikey')) data = { code: 200, unikey: 'test-login-key-123' }
  else if (url.pathname.endsWith('/login/qrcode/client/login')) {
    data = { code: qrCode }
    if (qrCode === 803) { headers.append('Set-Cookie', 'MUSIC_U=fake-a; Path=/; HttpOnly'); headers.append('Set-Cookie', '__csrf=csrf-a; Path=/') }
  } else if (url.pathname.endsWith('/w/nuser/account/get')) data = cookie.includes('MUSIC_U=expired') ? { code: 301 } : { code: 200, profile: { userId: cookie.includes('fake-b') ? 2 : 1, nickname: '测试用户' } }
  else if (url.pathname.endsWith('/user/playlist')) data = { code: 200, more: false, playlist: [{ id: 10, name: '我的歌单', trackCount: 1, creator: { userId: Number(args.uid) } }] }
  else if (url.pathname.endsWith('/v6/playlist/detail')) data = { code: 200, playlist: { name: '歌单', trackCount: 1, trackIds: [{ id: 123 }], tracks: [{ id: 123, name: '歌名', ar: [{ name: '歌手' }] }] } }
  else if (url.pathname.endsWith('/song/enhance/player/url')) data = { code: 200, data: [{ code: 200, url: invalidAudio ? 'https://other.test/steal' : 'http://m10.music.126.net/test.mp3' }] }
  else if (url.pathname.endsWith('/song/lyric')) data = { code: 200, lrc: { lyric: '[00:01]测试歌词' } }
  else throw Error('不应调用其他接口')
  return new Response(JSON.stringify(data), { headers })
}
try {
  const start = await accountAction('qr_start', {}, '')
  assert.match(start.url, /^https:\/\/music\.163\.com\/login\?codekey=/)
  assert.equal((await accountAction('qr_check', { key: start.key }, '')).state, 'waiting')
  qrCode = 802; assert.equal((await accountAction('qr_check', { key: start.key }, '')).state, 'confirm')
  qrCode = 803; const signed = await accountAction('qr_check', { key: start.key }, '')
  assert.equal(signed.state, 'authorized'); assert.equal(signed.user.id, '1')
  assert.match(atob(signed.session), /MUSIC_U=fake-a/)
  assert.ok(!JSON.stringify(signed.user).includes('MUSIC_U'))
  const alice = await accountAction('playlists', {}, 'MUSIC_U=fake-a; __csrf=csrf-a')
  const bob = await accountAction('playlists', {}, 'MUSIC_U=fake-b; __csrf=csrf-b')
  assert.equal(alice.user.id, '1'); assert.equal(bob.user.id, '2')
  assert.ok(seen.some(r => r.path.endsWith('/user/playlist') && r.args.uid === '2' && r.cookie.includes('fake-b')))
  assert.equal((await accountAction('playlist', { id: '10' }, 'MUSIC_U=fake-a')).songs[0].id, '123')
  const song = await accountAction('song', { id: '123' }, 'MUSIC_U=fake-a')
  assert.equal(song.src, 'https://m10.music.126.net/test.mp3'); assert.match(song.lyrics, /测试歌词/)
  invalidAudio = true; await assert.rejects(() => accountAction('song', { id: '123' }, 'MUSIC_U=fake-a'), /无法识别/)
  await assert.rejects(() => accountAction('profile', {}, 'MUSIC_U=expired'), /失效/)
  const before = requests; await assert.rejects(() => accountAction('profile', {}, ''), /先登录/); assert.equal(requests, before)

  // 本地会话加密、身份隔离、断开和失效；账号凭据不写入可导出的 appData。
  const memory = new Map<string, string>()
  Object.assign(globalThis, { isSecureContext: true, localStorage: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) } })
  assert.equal(accountSupported(), true)
  await saveNeteaseAccount('phone-a', { token: signed.session, user: signed.user })
  assert.equal((await readNeteaseAccount('phone-a'))?.user.id, '1')
  assert.equal(await readNeteaseAccount('phone-b'), null)
  assert.ok(![...memory.values()].some(v => v.includes('fake-a') || v.includes(signed.session)))
  globalThis.fetch = async (_input, init) => {
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer ' + signed.session)
    assert.ok(!String(init?.body).includes(signed.session))
    return Response.json({ user: signed.user })
  }
  await neteaseAccountCall('phone-a', 'profile')
  globalThis.fetch = async () => { forgetNeteaseAccount('phone-a'); return Response.json({ user: signed.user }) }
  await assert.rejects(() => neteaseAccountCall('phone-a', 'profile'), /连接已变化/)
  assert.equal(await readNeteaseAccount('phone-a'), null)
  await saveNeteaseAccount('phone-a', { token: signed.session, user: signed.user })
  globalThis.fetch = async () => Response.json({ error: '登录已失效' }, { status: 401 })
  await assert.rejects(() => neteaseAccountCall('phone-a', 'profile'), /失效/)
  assert.equal(await readNeteaseAccount('phone-a'), null)
  Object.assign(globalThis, { isSecureContext: false }); assert.equal(accountSupported(), false)
} finally { crypto.getRandomValues = originalRandom; globalThis.fetch = originalFetch }
console.log('netease account regression ok: QR states, encrypted requests/session storage, per-account playlists, authorized audio/lyrics, logout races, credential isolation and expired sessions')
process.exit(0)
