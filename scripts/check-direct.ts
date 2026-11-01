import assert from 'node:assert/strict'
import { createDecipheriv } from 'node:crypto'
import { directAccountAction } from '../src/lib/neteaseDirect.ts'
const originalFetch = globalThis.fetch, originalRandom = crypto.getRandomValues.bind(crypto)
crypto.getRandomValues = ((array: Uint8Array) => { array.fill(0); return array }) as typeof crypto.getRandomValues
globalThis.fetch = async () => { throw Error('直连流程不能调用云端 fetch') }
const decrypt = (text: string, key: string) => { const d = createDecipheriv('aes-128-cbc', key, '0102030405060708'); return Buffer.concat([d.update(Buffer.from(text, 'base64')), d.final()]).toString('utf8') }
const requests: Array<{ path: string; cookie: string }> = []
const transport = { request: async (options: { path: string; body: string; cookie: string }) => {
  const data = JSON.parse(decrypt(decrypt(new URLSearchParams(options.body).get('params')!, 'a'.repeat(16)), '0CoJUm6Qyw8W8jud'))
  assert.ok(!options.body.includes('MUSIC_U'))
  assert.ok(options.path.startsWith('/weapi/'))
  requests.push({ path: options.path, cookie: options.cookie })
  let result: Record<string, unknown> = {}, setCookie = ''
  if (options.path.endsWith('/qrcode/unikey')) result = { code: 200, unikey: 'native-qr-key-123' }
  else if (options.path.endsWith('/qrcode/client/login')) { result = { code: 803 }; setCookie = 'MUSIC_U=native-test-a; Path=/; HttpOnly, __csrf=csrf-a; Path=/' }
  else if (options.path.endsWith('/nuser/account/get')) result = { code: 200, profile: { userId: options.cookie.includes('test-b') ? 2 : 1, nickname: '测试' } }
  else if (options.path.endsWith('/cloudsearch/pc')) { assert.equal(data.s,'晴天'); result={code:200,result:{songCount:1,songs:[{id:123,name:'晴天',ar:[{name:'测试歌手'}]}]}} }
  else if (options.path.endsWith('/user/playlist')) result = { code: 200, playlist: [{ id: 10, name: '直连歌单', trackCount: 1, creator: { userId: Number(data.uid) } }] }
  else if (options.path.endsWith('/player/url')) result = { code: 200, data: [{ code: 200, url: 'https://m10.music.126.net/song.mp3' }] }
  else if (options.path.endsWith('/song/lyric')) result = { code: 200, lrc: { lyric: '[00:01]直连歌词' } }
  else throw Error('未允许的请求')
  return { status: 200, data: result, setCookie }
} }
try {
  const qr = await directAccountAction('qr_start', {}, '', transport)
  assert.equal(qr.key, 'native-qr-key-123')
  const login = await directAccountAction('qr_check', { key: qr.key }, '', transport)
  assert.equal(login.state, 'authorized'); assert.equal(login.user.id, '1')
  assert.equal((await directAccountAction('playlists', {}, login.session, transport)).playlists[0].name, '直连歌单')
  const searched=await directAccountAction('search',{keywords:'晴天'},login.session,transport)
  assert.equal(searched.songs[0].name,'晴天')
  assert.equal(searched.songs[0].artist,'测试歌手')
  const bob = btoa('MUSIC_U=native-test-b; __csrf=csrf-b')
  assert.equal((await directAccountAction('profile', {}, bob, transport)).user.id, '2')
  const song = await directAccountAction('song', { id: '123' }, login.session, transport)
  assert.match(song.lyrics, /直连歌词/)
  assert.equal(song.src, 'https://m10.music.126.net/song.mp3')
  assert.ok(requests.some(r => r.cookie.includes('test-b')))
  assert.ok(requests.every(r => !r.cookie.includes('test-a') || !r.cookie.includes('test-b')))
  assert.equal(requests[0].cookie, '', '生成登录码不能混入其他身份的凭据')
} finally { globalThis.fetch = originalFetch; crypto.getRandomValues = originalRandom }
if (process.argv.includes('--live')) {
  const networkAdapter = { request: async (options: { path: string; body: string; cookie: string }) => {
    const r = await fetch('https://music.163.com' + options.path, { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(20000), headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: 'https://music.163.com/', 'User-Agent': 'Mozilla/5.0', Cookie: 'os=pc; appver=3.1.17; ' + options.cookie }, body: options.body })
    return { status: r.status, data: await r.json(), setCookie: r.headers.getSetCookie().join(', ') }
  } }
  const qr = await directAccountAction('qr_start', {}, '', networkAdapter)
  const state = await directAccountAction('qr_check', { key: qr.key }, '', networkAdapter)
  assert.equal(state.state, 'waiting')
  console.log(JSON.stringify({ liveDirectHost: 'music.163.com', hasQrKey: Boolean(qr.key), state: state.state, cloudUsed: false }))
}
console.log('native direct regression ok: no cloud fetch, QR login, per-request cookie isolation, playlists, authorized audio and lyrics')
process.exit(0)
