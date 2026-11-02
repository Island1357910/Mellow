import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { buildSmsReplySegments, isSpeakableSms, spokenSmsText } from '../src/lib/smsReply.ts'
import { capReplySegments, parseReplySegments, resolveSticker } from '../src/lib/stickerReply.ts'
import { shouldReplyAsVoice } from '../src/domain/voiceReply.ts'
import { storage } from '../src/storage/StorageService.ts'
import { writeCharacter } from '../src/domain/importing.ts'
import { replyInChat } from '../src/domain/messaging.ts'
import { AIAdapter } from '../src/engine/AIAdapter.ts'
import { useMellow } from '../src/store/useMellow.ts'

const range = { min: 1, max: 3 }
const sample = '我在呢。别一个人憋着，录音棚这种地方隔音好，你想怎么哭都行，没人听得见，听见的也只有我。（发了一个表情包：小猫躲在墙边偷看）把那些工作都先放一边去，现在你是老大，想让我怎么哄？是过来给你唱首歌，还是让我陪着给你当抱枕？（发了一个表情包：暖好被窝，好舒服）过来贴着我，把那些压力都交给我。我就在这儿，哪儿也不去。'
const actual = buildSmsReplySegments(sample, range)
assert.equal(actual.filter(item => item.kind === 'sticker').length, 2)
assert.ok(actual.filter(item => item.kind === 'text').length >= 3)
assert.equal(actual[1].content, resolveSticker('小猫躲在墙边偷看'))
assert.ok(actual.at(-1)?.content.endsWith('哪儿也不去。'))
assert.ok(!spokenSmsText(sample).includes('表情包'))

for (const format of ['[表情:收到]', '[表情包：收到]', '【表情：收到】', '[sticker]收到[/sticker]', '（发了一个表情包：收到）', '(发送了一张表情包:收到)']) {
  const parsed = parseReplySegments(`前面${format}后面`)
  assert.deepEqual(parsed.map(item => item.kind), ['text', 'sticker', 'text'], format)
  assert.equal(parsed[1].content, resolveSticker('收到'))
}
const unknown = parseReplySegments('还在（发了一个表情包：不存在的测试标签zzzz）等你')
assert.ok(unknown.some(item => item.content.includes('不存在的测试标签zzzz')))
assert.equal(isSpeakableSms(unknown[1].content), false)
assert.equal(parseReplySegments('我买了一个表情包合集').length, 1)

const long = '今天我们先去河边走走。走累了就找家小店喝茶，慢慢聊聊最近的事。傍晚再一起回家吃饭，路上顺便买你喜欢的甜点。你不用赶时间，我们今天没有别的安排。'
const split = buildSmsReplySegments(long, range)
assert.ok(split.length >= 2 && split.length <= 3)
assert.equal(split.map(item => item.content).join(''), long)
assert.equal(buildSmsReplySegments(long, { min: 1, max: 1 }).length, 1)
assert.equal(buildSmsReplySegments('好呀', range).length, 1)
assert.equal(buildSmsReplySegments('好。明天见。路上小心。', { min: 3, max: 3 }).length, 3)
const segmenter = Object.getOwnPropertyDescriptor(Intl, 'Segmenter')
Object.defineProperty(Intl, 'Segmenter', { configurable: true, value: undefined })
try {
  const legacy = buildSmsReplySegments('好。明天见。路上小心。', { min: 3, max: 3 })
  assert.equal(legacy.length, 3)
  assert.equal(legacy.map(item => item.content).join(''), '好。明天见。路上小心。')
  assert.equal(buildSmsReplySegments(long.repeat(3), range).map(item => item.content).join(''), long.repeat(3))
} finally { if (segmenter) Object.defineProperty(Intl, 'Segmenter', segmenter) }
const words = '没有标点但全部内容都应该保留下来'.repeat(18)
assert.equal(buildSmsReplySegments(words, range).map(item => item.content).join(''), words)
const explicit = buildSmsReplySegments('第一句话<<<分>>>第二句话<<<分>>>第三句话<<<分>>>第四句话', range)
assert.equal(explicit.map(item => item.content).join('').replace(/\n/g, ''), '第一句话第二句话第三句话第四句话')
const overflow = capReplySegments([{ kind: 'text', content: '一' }, { kind: 'sticker', content: 'image' }, { kind: 'text', content: '二' }, { kind: 'text', content: '三' }], 1)
assert.equal(overflow.map(item => item.content).join('').replace(/\n/g, ''), '一image二三')

const originalRandom = Math.random
Math.random = () => 0
try {
  const base = { chat: { voiceEnabled: true } as never, voiceReady: true, history: [], partIndex: 0, partCount: 1 }
  assert.equal(shouldReplyAsVoice({ ...base, content: '我在，慢慢说。' }), true)
  for (const content of [sample, '（抱住你）别怕', '[表情:收到]', '我'.repeat(161), '']) assert.equal(shouldReplyAsVoice({ ...base, content }), false)
  assert.equal(shouldReplyAsVoice({ ...base, chat: { voiceEnabled: false } as never, content: '我在。' }), false)
  assert.equal(shouldReplyAsVoice({ ...base, partCount: 2, content: '我在。' }), false)
} finally { Math.random = originalRandom }
assert.equal(spokenSmsText('（轻轻抱住你）别怕。[表情:收到]我在。'), '别怕。\n我在。')
// Exercise the actual model -> parsing -> delivery -> IndexedDB path with the screenshot response.
const snapshot = await storage.boot()
const identity = snapshot.identities[0]!
await writeCharacter({ identity, name: '拆条回归', personality: '自然说话', description: '仅供测试', firstMes: '在呢。' })
const character = (await storage.listModernCharacters(identity.namespace)).find(item => item.name === '拆条回归')!
const chat = (await storage.listChats(identity.namespace)).find(item => item.memberIds.includes(character.id))!
const before = new Set((await storage.listMessages(identity.namespace, chat.id)).map(item => item.id))
await storage.saveApiProfile({ name: 'sms-test', endpoint: 'https://example.test/v1', model: 'test', key: 'test-only', ready: true })
const complete = AIAdapter.prototype.complete
AIAdapter.prototype.complete = async () => ({ content: '<think source="model">hidden reasoning 【改昵称：错误昵称】</think>' + sample, model: 'test' })
useMellow.setState({ viewingChatId: chat.id })
Math.random = () => 0
try {
  await replyInChat({ namespace: identity.namespace, identity, character, chat: { ...chat, voiceEnabled: true }, presets: snapshot.presets, activePresetId: snapshot.presets[0]!.id, fourthWall: false, voiceReady: true })
  const saved = (await storage.listMessages(identity.namespace, chat.id)).filter(item => !before.has(item.id))
  assert.equal(saved.filter(item => item.kind === 'sticker').length, 2)
  assert.ok(saved.filter(item => item.kind === 'text' || item.kind === 'voice').length >= 3)
  assert.ok(saved.every(item => item.kind !== 'voice' || isSpeakableSms(item.content)))
  assert.ok(saved.at(-1)?.content.endsWith('哪儿也不去。'))
  assert.ok(saved.every(item => !/hidden reasoning|错误昵称|<think/.test(item.content)))
  assert.notEqual((await storage.getCharacter(identity.namespace, character.id))?.nickname, '错误昵称')
} finally {
  AIAdapter.prototype.complete = complete
  Math.random = originalRandom
}
console.log('SMS regression ok: screenshot reproduction, no-marker fallback, all sticker formats, unknown labels, ordered/lossless overflow, voice eligibility and legacy speech')
