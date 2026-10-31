import assert from 'node:assert/strict'
const url = 'https://mellow-music-cloud-20261031.basicheart1.chatgpt.site/api/account'
async function call(action, input = {}) {
  const r = await fetch(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(40000), headers: { 'Content-Type': 'application/json', Origin: 'https://localhost' }, body: JSON.stringify({ action, ...input }) })
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://localhost')
  const data = await r.json()
  if (!r.ok) throw Error(data.error || '账号接口 HTTP ' + r.status)
  return data
}
const login = await call('qr_start')
assert.equal(new URL(login.url).origin, 'https://music.163.com')
assert.ok(login.key)
const checked = await call('qr_check', { key: login.key })
assert.equal(checked.state, 'waiting')
const unauthorized = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://localhost' }, body: JSON.stringify({ action: 'playlists' }) })
assert.equal(unauthorized.status, 401)
const insecure = await fetch(url, { method: 'OPTIONS', headers: { Origin: 'http://mymellow.top' } })
assert.equal(insecure.status, 403)
console.log(JSON.stringify({ liveQr: true, state: checked.state, missingSessionRejected: true, insecureOriginRejected: true, realAccountLogin: 'requires user confirmation in NetEase app' }))
