import assert from 'node:assert/strict'
import { callMusicTool } from '../services/mellow-music-cloud/lib/music.ts'
const original = globalThis.fetch
let requests = 0
globalThis.fetch = async input => {
  const url = new URL(String(input)); requests++
  assert.equal(url.origin, 'https://music.163.com')
  let data: unknown
  if (url.pathname === '/api/search/get') data = { code: 200, result: { songs: [{ id: 123, name: '歌名', artists: [{ name: '歌手' }] }] } }
  else if (url.pathname === '/api/song/lyric') data = { code: 200, lrc: { lyric: '[00:01]测试歌词' } }
  else if (url.pathname === '/api/song/detail') data = { code: 200, songs: [{ id: 123, name: '歌名', artists: [{ name: '歌手' }] }] }
  else throw Error('不应请求其他接口')
  return Response.json(data)
}
try {
  const result = await callMusicTool('search_music', { query: '歌名', limit: 1 })
  assert.equal(result.tracks[0].lyrics, '[00:01]测试歌词')
  assert.match(result.tracks[0].src, /^https:\/\/music\.163\.com\/song\/media\/outer\/url\?id=123\.mp3$/)
  const song = await callMusicTool('get_song_context', { song_id: '123' })
  assert.equal(song.name, '歌名'); assert.equal(song.artist, '歌手')
  const before = requests
  await assert.rejects(() => callMusicTool('get_song_context', { song_id: 'https://internal/' }), /数字/)
  await assert.rejects(() => callMusicTool('search_music', { query: 'a', limit: 99 }), /1–5/)
  await assert.rejects(() => callMusicTool('search_music', { query: '' }), /请输入/)
  assert.equal(requests, before)
  globalThis.fetch = async () => new Response('blocked', { status: 403 })
  await assert.rejects(() => callMusicTool('search_music', { query: 'a' }), /403/)
} finally { globalThis.fetch = original }
if (process.argv.includes('--live')) {
  const result = await callMusicTool('search_music', { query: '晴天', limit: 1 })
  assert.ok(result.tracks.length > 0)
  assert.ok(result.tracks[0].lyrics.length > 0)
  console.log(JSON.stringify({ liveSongs: result.tracks.length, hasLyrics: Boolean(result.tracks[0].lyrics), platform: result.source }))
}
console.log('music cloud regression ok: provider allowlist, song + timed lyrics, importable tracks, argument bounds, upstream failures')
