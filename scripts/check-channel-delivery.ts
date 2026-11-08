import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { storage } from '../src/storage/StorageService.ts'
import { newSave, putSave, loadConfig, saveConfig, focusChars, buildStoryPrompt } from '../src/engine/story.ts'
import { smsBridgeForStory, storyBridgeForSms } from '../src/lib/channelBridge.ts'
import { patchChatMemory } from '../src/lib/chatMemory.ts'
import { tickDeliveries, type Delivery } from '../src/lib/delivery.ts'
import { AIAdapter } from '../src/engine/AIAdapter.ts'
import { useMellow } from '../src/store/useMellow.ts'
import type { Character, ChatMessage } from '../src/types/index.ts'

const snap = await storage.boot(), identity = snap.identities[0]!, ns = identity.namespace
const a = { id: 'a', name: '甲', nickname: '', remark: '', description: '', personality: '', scenario: '', mesExample: '', systemPrompt: '', postHistoryInstructions: '', extensions: {} } as Character
const b = { ...a, id: 'b', name: '乙' }
const save = newSave('首次线下', { lines: [
  { id: 'u1', role: 'user', content: '和甲去吃华夫饼', createdAt: 1, participantIds: ['a'] },
  { id: 'a1', role: 'assistant', content: '甲已经接到你，约好了吃草莓华夫饼', createdAt: 2, participantIds: ['a'] },
  { id: 'u2', role: 'user', content: '和乙谈一件私事', createdAt: 3, participantIds: ['b'] },
  { id: 'a2', role: 'assistant', content: '乙的独家秘密', createdAt: 4, participantIds: ['b'] },
] })
await putSave(ns, save)
assert.equal((await loadConfig(ns)).activeSaveId, '')
const bridge = await storyBridgeForSms(ns, a)
assert.match(bridge, /草莓华夫饼/, 'old first-use saves work without a persisted active ID')
assert.doesNotMatch(bridge, /乙的独家秘密/)
assert.equal(await storyBridgeForSms(ns, { ...a, id: 'c', name: '丙' }), '')
const config = await loadConfig(ns)
await saveConfig(ns, { ...config, activeSaveId: 'deleted-save' })
assert.match(await storyBridgeForSms(ns, a), /草莓华夫饼/, 'stale save selection recovers')
assert.deepEqual(focusChars([a, b], { ...save, lines: [save.lines[0]!, save.lines[1]!, ...Array.from({ length: 8 }, (_, i) => ({ id: `continue${i}`, role: 'user' as const, content: '继续', createdAt: 5 + i }))] }).map(c => c.id), ['a'])
for (const person of [a, b]) {
  const id = `dm-${person.id}`
  await storage.putChat(ns, { id, kind: 'dm', title: person.name, memberIds: [person.id], lastMessage: '', lastMessageAt: 0, unread: 0, presetId: null, createdAt: 1, updatedAt: 1 })
  for (let i = 0; i < 10; i++) await storage.putMessage(ns, { id: `${id}-${i}`, chatId: id, role: 'user', kind: 'text', content: `${person.name}的私聊${i}。${'内容'.repeat(150)}`, createdAt: person.id === 'a' ? i * 2 + 1 : i * 2, status: 'sent' } as ChatMessage)
}
const sms = await smsBridgeForStory(ns, [a, b])
assert(sms.indexOf('乙的私聊0') < sms.indexOf('甲的私聊0'), 'merged chats are chronological')
assert.match(sms, /仅本人知情/)
const prompt = buildStoryPrompt({ mode: 'offline', config, chars: [a, b], identity, save, smsBridge: sms })
assert.match(prompt[0]!.content, /甲的私聊0/, 'bridge is not silently clipped to only the last character')

await patchChatMemory(ns, 'dm-a', { text: '两人约好周六还书' })
await patchChatMemory(ns, 'dm-b', { text: '乙的旧事只写在乙的私聊里' })
const chatA = (await storage.getChat(ns, 'dm-a'))!
await storage.putChat(ns, { ...chatA, backstory: '曾经一起开过书店' })
await storage.putMessage(ns, { id: 'voice-a', chatId: 'dm-a', role: 'user', kind: 'voice', content: '还书地点改到车站', createdAt: 30, status: 'sent' } as ChatMessage)
const privateBridge = await smsBridgeForStory(ns, [a])
assert.match(privateBridge, /两人约好周六还书/)
assert.match(privateBridge, /曾经一起开过书店/)
assert.match(privateBridge, /还书地点改到车站/)
assert.doesNotMatch(privateBridge, /乙的旧事|乙的私聊\d/)
assert.equal(await smsBridgeForStory(ns, []), '')

await storage.saveApiProfile({ name: 'test', endpoint: 'https://test.invalid/v1', model: 'test', key: 'test', ready: true })
useMellow.setState({ identities: snap.identities, activeIdentityId: identity.id })
const original = AIAdapter.prototype.complete
let calls = 0
const order: Delivery = { id: 'delivered', shop: 'flash', items: [{ name: '热茶', qty: 1, price: 8 }], total: 8, recipient: a.id, recipientName: a.name, told: true, note: '不要复述这条留言', createdAt: 1, arrivesAt: 2, reacted: false }
await storage.setBag(ns, 'deliveries', [order])
AIAdapter.prototype.complete = async () => {
  calls++
  // Simulate another purchase while the arrival response is being generated.
  await storage.setBag(ns, 'deliveries', [order, { ...order, id: 'new-order', arrivesAt: Date.now() + 600_000 }])
  throw Error('model unavailable')
}
try {
  await Promise.all([tickDeliveries(ns, [a]), tickDeliveries(ns, [a])])
  assert.equal(calls, 1, 'overlapping checks cannot generate duplicate reactions')
  const orders = await storage.getBag<Delivery[]>(ns, 'deliveries')
  assert.equal(orders?.length, 2, 'arrival processing preserves concurrent purchases')
  assert.equal(orders?.find(o => o.id === order.id)?.reacted, true)
  const messages = await storage.listMessages(ns, 'dm-a')
  const replies = messages.filter(m => m.role === 'assistant')
  assert.equal(replies.length, 1)
  assert.match(replies[0]!.content, /热茶已经收到了/)
  assert.doesNotMatch(replies[0]!.content, /不要复述/)
  await tickDeliveries(ns, [a])
  assert.equal(calls, 1, 'completed delivery does not react again')
} finally { AIAdapter.prototype.complete = original }
console.log('Channel and delivery checks passed: first-save recovery, participant isolation, chronological prompts, arrival fallback, concurrency and purchase preservation')
