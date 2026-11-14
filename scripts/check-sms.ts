import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { buildSmsReplySegments, chatStatusLine, isSpeakableSms, spokenSmsText, visibleSmsParts } from '../src/lib/smsReply.ts'
import { capReplySegments, parseReplySegments, resolveSticker } from '../src/lib/stickerReply.ts'
import { shouldReplyAsVoice } from '../src/domain/voiceReply.ts'
import { storage } from '../src/storage/StorageService.ts'
import { writeCharacter } from '../src/domain/importing.ts'
import { replyInChat } from '../src/domain/messaging.ts'
import { buildSmsMessages, describeMessage } from '../src/engine/prompt.ts'
import type { ChatMessage } from '../src/types/index.ts'
import { AIAdapter } from '../src/engine/AIAdapter.ts'
import { useMellow } from '../src/store/useMellow.ts'

for (const prefix of ['（语音消息）', '(语音消息)', '[语音]', '【语音消息】：', '（语音消息）[语音]']) {
  assert.deepEqual(buildSmsReplySegments(prefix + '我在。<<<分>>>' + prefix + '慢慢说。', { min: 1, max: 3 }), [{ kind: 'text', content: '我在。' }, { kind: 'text', content: '慢慢说。' }])
}
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
assert.deepEqual(buildSmsReplySegments('？？？你认真的吗', range).map(item => item.content), ['？？？你认真的吗'])
assert.deepEqual(buildSmsReplySegments('我觉得这件事\n没有那么简单。', range).map(item => item.content), ['我觉得这件事没有那么简单。'])
assert.deepEqual(buildSmsReplySegments('我到了，\n但是外面好冷。', range).map(item => item.content), ['我到了，但是外面好冷。'])
assert.deepEqual(buildSmsReplySegments('在呢\n刚到家\n你吃了吗', range).map(item => item.content), ['在呢', '刚到家', '你吃了吗'])
assert.deepEqual(buildSmsReplySegments('1. 先吃饭\n2. 再出门', range).map(item => item.content), ['1. 先吃饭', '2. 再出门'])
const quoted = buildSmsReplySegments('他说“明天再看吧。”然后挂了。', range).map(item => item.content)
assert.equal(quoted.join(''), '他说“明天再看吧。”然后挂了。')
assert.ok(quoted.some(item => item.includes('“明天再看吧。”')))
assert.ok(quoted.every(item => item !== '。' && item !== '”'))
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
const leaked = '===== Page 1 =====\n<<<分\n我没点接收，这分手就不作数。\n<<<分\n把门锁好，我进地下车库了。\n<<<分'
const repaired = buildSmsReplySegments(leaked, { min: 1, max: 4 })
assert.deepEqual(repaired.map(item => item.content), ['我没点接收，这分手就不作数。', '把门锁好，我进地下车库了。'])
assert.ok(repaired.every(item => !item.content.includes('<<<') && !/page/i.test(item.content)))
assert.deepEqual(visibleSmsParts(leaked), ['我没点接收，这分手就不作数。', '把门锁好，我进地下车库了。'])
assert.deepEqual(visibleSmsParts('我现在上电梯了。\n<<<分\n既然你有胆量提分手。\n<<<分'), ['我现在上电梯了。', '既然你有胆量提分手。'])
assert.equal(chatStatusLine('===== Page 1 =====', '今晚见。'), '今晚见')
assert.equal(chatStatusLine('', '===== Page 1 =====\n地下车库见。'), '地下车库见')
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
const oldBackground = 'data:image/png;base64,b2xk'
const newBackground = 'data:image/png;base64,bmV3'
await storage.patchChat(identity.namespace, chat.id, { backgroundImage: oldBackground, unread: 1 })
await Promise.all([
  storage.patchChat(identity.namespace, chat.id, { backgroundImage: newBackground }),
  storage.markChatRead(identity.namespace, chat.id),
  storage.refreshChatPreview(identity.namespace, chat.id),
])
const styledChat = await storage.getChat(identity.namespace, chat.id)
assert.equal(styledChat?.backgroundImage, newBackground)
assert.equal(styledChat?.unread, 0)
assert.equal(await storage.patchChat(identity.namespace, 'missing-chat', { backgroundImage: newBackground }), undefined)
const groupHistory: ChatMessage[] = [
  { id: 'a', chatId: 'group', role: 'assistant', kind: 'text', content: '我昨天去了海边。', charId: 'other', createdAt: 1, status: 'sent' },
  { id: 'b', chatId: 'group', role: 'assistant', kind: 'voice', content: '我在家。', charId: character.id, createdAt: 2, status: 'sent' },
  { id: 'c', chatId: 'group', role: 'user', kind: 'text', content: '谁去了海边？', charId: null, createdAt: 3, status: 'sent' },
]
const built = buildSmsMessages({ character, identity, preset: null, history: groupHistory, fourthWall: false, groupMembers: [{ id: character.id, name: character.name }, { id: 'other', name: '另一位' }] })
assert.deepEqual(built.messages.slice(1).map(message => message.role), ['user', 'assistant', 'user'])
assert.match(built.messages[1]!.content, /发送者：另一位；ID：other/)
assert.match(built.messages[2]!.content, new RegExp(character.id))
assert.match(built.messages[0]!.content, /未经公开且不属于你的事情应当不知道/)
assert.equal(describeMessage(groupHistory[1]!), '我在家。')
const dmBuilt = buildSmsMessages({ character, identity, preset: null, history: groupHistory.slice(1), fourthWall: false })
assert.equal(dmBuilt.messages[1]!.content, '我在家。')
const before = new Set((await storage.listMessages(identity.namespace, chat.id)).map(item => item.id))
await storage.saveApiProfile({ name: 'sms-test', endpoint: 'https://example.test/v1', model: 'test', key: 'test-only', ready: true })
const complete = AIAdapter.prototype.complete
AIAdapter.prototype.complete = async () => ({ content: '<think source="model">hidden reasoning 【改昵称：错误昵称】</think>' + sample, model: 'test' })
useMellow.setState({ viewingChatId: chat.id })
Math.random = () => 0
try {
  await replyInChat({ namespace: identity.namespace, identity, character, chat: { ...chat, voiceEnabled: true }, presets: snapshot.presets, activePresetId: snapshot.presets[0]!.id, fourthWall: false, voiceReady: true })
  const saved = (await storage.listMessages(identity.namespace, chat.id)).filter(item => !before.has(item.id))
  assert.equal((await storage.getChat(identity.namespace, chat.id))?.backgroundImage, newBackground, 'delivering a reply with a stale chat must preserve the new background')
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
