import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { storage } from '../src/storage/StorageService.ts'
import { writeCharacter } from '../src/domain/importing.ts'
import { AIAdapter } from '../src/engine/AIAdapter.ts'
import { useMellow } from '../src/store/useMellow.ts'
import { usePlayer } from '../src/lib/playerStore.ts'
import { bindTogetherSource, bookPages, lyricAt, mcpContent, pollTogetherSource, togetherNoteFor, togetherSnapshot, useTogether } from '../src/lib/together.ts'
import { tickTogether } from '../src/lib/togetherReplies.ts'
import { replyInChat } from '../src/domain/messaging.ts'
import { McpClient } from '../src/lib/mcp.ts'

assert.equal(lyricAt('[00:05.00]第一句\n[00:10.00]第二句\n[00:15.00]第三句\n[00:20.00]第四句', 12), '第一句\n第二句\n第三句')
assert.match(lyricAt('[00:05]第一句', 1), /前奏/)
assert.equal(lyricAt('[offset:1000]\n[00:05]第一句\n[00:08]第二句\n[00:09]第三句', 7), '第一句\n第二句\n第三句')
assert.equal(lyricAt('纯文本歌词', 99), '纯文本歌词')
assert.equal(bookPages('甲'.repeat(1200) + '后文')[1], '后文')
assert.throws(() => mcpContent({ isError: true }), /错误/)
assert.throws(() => mcpContent({ content: [{ type: 'text', text: 'null' }] }), /JSON 对象/)

const snap = await storage.boot(), identity = snap.identities[0]!, ns = identity.namespace
await writeCharacter({ identity, name: '共读测试', personality: '简洁自然', description: '陪伴回归', firstMes: '' })
const character = (await storage.listModernCharacters(ns)).find(c => c.name === '共读测试')!
let chat = (await storage.listChats(ns)).find(c => c.memberIds[0] === character.id)!
chat = { ...chat, replyMin: 1, replyMax: 1 }; await storage.putChat(ns, chat)
await storage.saveApiProfile({ name: 'together-test', endpoint: 'https://example.test/v1', model: 'test', key: 'test-only', ready: true })
useMellow.setState({ identities: snap.identities, activeIdentityId: identity.id, locked: false, activeApp: 'connections', immersiveUntil: 0, apiMeta: { ...useMellow.getState().apiMeta, ready: true }, viewingChatId: chat.id })
await useTogether.getState().load(ns)
await useTogether.getState().patch({ charId: character.id, reading: true, music: false, auto: true, minutes: 1, book: { title: '共读的书', text: '当前页'.padEnd(1200, '。') + '秘密结局', page: 0, kind: '小说' } })
let snapshot = togetherSnapshot(ns, character.id)
assert.match(snapshot.note, /当前页/)
assert.ok(!snapshot.note.includes('秘密结局'))
assert.equal(togetherSnapshot(ns, 'other-char').note, '')
assert.equal(togetherSnapshot('other-phone', character.id).note, '')

const original = AIAdapter.prototype.complete
let calls = 0, prompt = ''
AIAdapter.prototype.complete = async input => { calls++; prompt = input.messages.map(m => m.content).join('\n'); return { content: '这段我也很喜欢。', model: 'test' } }
const originalNow = Date.now
let now = originalNow(); Date.now = () => now
try {
  await Promise.all([tickTogether(identity), tickTogether(identity)])
  assert.equal(calls, 1, '并发 tick 只能触发一次')
  assert.match(prompt, /当前页/)
  assert.ok(!prompt.includes('秘密结局'))
  const delivered = await storage.listMessages(ns, chat.id)
  assert.ok(delivered.some(m => m.role === 'assistant' && m.content.includes('这段我也很喜欢')))
  assert.ok(!delivered.some(m => m.role === 'user'), '主动回应无需伪造用户消息')
  now += 120_000; await tickTogether(identity); assert.equal(calls, 1, '同一页不重复主动说')
  await useTogether.getState().patch({ book: { ...useTogether.getState().config.book!, page: 1 } })
  await tickTogether(identity); assert.equal(calls, 2); assert.match(prompt, /秘密结局/)
  await useTogether.getState().patch({ reading: false })
  now += 120_000; await tickTogether(identity); assert.equal(calls, 2)
  assert.equal(togetherSnapshot(ns, character.id).note, '')

  await usePlayer.getState().load(ns)
  usePlayer.getState().patch({ tracks: [{ id: 'test-song', name: '当前歌曲', lyrics: '[00:01]真实歌词', src: 'https://example.test/song.mp3' }] })
  usePlayer.setState({ playing: true, seconds: 10 })
  await useTogether.getState().patch({ music: true })
  snapshot = togetherSnapshot(ns, character.id)
  assert.match(snapshot.note, /真实歌词/)
  usePlayer.setState({ playing: false }); assert.equal(togetherSnapshot(ns, character.id).note, '')
  usePlayer.setState({ playing: true })
  await replyInChat({ namespace: ns, identity, character, chat, presets: [], activePresetId: '', fourthWall: false })
  assert.match(prompt, /当前歌曲/); assert.match(prompt, /真实歌词/)

  // 外部只读工具自动取数、节流、错误反馈和解绑。
  const client = new McpClient('https://example.test/mcp')
  let reads = 0
  client.call = async () => { reads++; return { structuredContent: { title: '网页正文', text: '自动读取的章节' } } }
  await useTogether.getState().patch({ reading: true })
  bindTogetherSource({ namespace: ns, client, tool: 'read_current', args: {}, kind: 'reading' })
  await pollTogetherSource(ns); await pollTogetherSource(ns)
  assert.equal(reads, 1); assert.equal(useTogether.getState().config.book?.title, '网页正文')
  assert.match(togetherSnapshot(ns, character.id).note, /自动读取的章节/)
  now += 31_000
  client.call = async () => { throw Error('测试断网') }
  await pollTogetherSource(ns); assert.match(useTogether.getState().status, /测试断网/)
  bindTogetherSource(null); now += 31_000; await pollTogetherSource(ns); assert.equal(reads, 1)

  client.call = async () => ({ structuredContent: { name: '外部歌曲', lyrics: '[00:01]外部真实歌词', position: 5, playing: true } })
  bindTogetherSource({ namespace: ns, client, tool: 'now_playing', args: {}, kind: 'music' })
  await pollTogetherSource(ns)
  assert.match(togetherSnapshot(ns, character.id).note, /外部真实歌词/)
  await useTogether.getState().patch({ music: false })
  assert.ok(!togetherSnapshot(ns, character.id).note.includes('外部真实歌词'))
  now += 31_000; await pollTogetherSource(ns)
  assert.equal(useTogether.getState().config.music, false, '自动查询不能重新打开被关闭的共享')
  bindTogetherSource(null)

  // 读取其他身份的资料不能切换当前手机状态。
  await storage.setBag('other-phone', 'together_config', { ...useTogether.getState().config, charId: 'other', book: { title: '另一个身份', text: '隔离内容', page: 0, kind: '小说' } })
  assert.match(await togetherNoteFor('other-phone', 'other'), /隔离内容/)
  assert.equal(useTogether.getState().namespace, ns)
  assert.ok(!togetherSnapshot(ns, character.id).note.includes('隔离内容'))
  await useTogether.getState().patch({ music: false, reading: false, auto: false })
  now += 120_000
  const before = calls; await tickTogether(identity, true); assert.equal(calls, before)
} finally { AIAdapter.prototype.complete = original; Date.now = originalNow; bindTogetherSource(null) }
console.log('together regression ok: timed lyrics, no spoilers, character/identity isolation, real SMS delivery, concurrency/cooldown, pause/stop, MCP polling/errors')
process.exit(0)
