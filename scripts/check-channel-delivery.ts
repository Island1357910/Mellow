import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { storage } from '../src/storage/StorageService.ts'
import { takeSmsMoney } from '../src/domain/chatMoney.ts'
import { pendingGlance, rememberSearch, setGlancePermission } from '../src/domain/glance.ts'
import { deliverSms, replyInChat } from '../src/domain/messaging.ts'
import { purchaseMemory } from '../src/lib/deliveryMemory.ts'
import { normalizeSettings } from '../src/lib/defaults.ts'
import { readCharacterWallet, takeWalletActivity } from '../src/domain/characterWallet.ts'
import { newSave, putSave, loadConfig, saveConfig, focusChars, buildStoryPrompt } from '../src/engine/story.ts'
import { smsBridgeForStory, storyBridgeForSms } from '../src/lib/channelBridge.ts'
import { patchChatMemory } from '../src/lib/chatMemory.ts'
import { tickDeliveries, type Delivery } from '../src/lib/delivery.ts'
import { AIAdapter } from '../src/engine/AIAdapter.ts'
import { changeMomentInteraction, momentAuthor, momentMemory, readMomentInteractions, replyToMomentComment } from '../src/lib/socialAi.ts'
import { useMellow } from '../src/store/useMellow.ts'
import type { Character, ChatMessage } from '../src/types/index.ts'

const snap = await storage.boot(), identity = snap.identities[0]!, ns = identity.namespace
const payment = takeSmsMoney('祝你生日快乐！\n【红包：12.34｜生日快乐】\n【转账：3｜多一笔】', identity.name, 3)
assert.equal(payment.body, '祝你生日快乐！')
assert.equal(payment.payment?.kind, 'redpacket')
assert.equal(payment.payment?.incomingMoney.cents, 411)
assert.match(payment.payment!.content, /群红包 · 3 份/)
assert.equal(takeSmsMoney('【转账：201｜超限】', identity.name).payment, undefined)
const transfer = takeSmsMoney('【转账：12.34｜给你的】', '玩家', 3)
assert.equal(transfer.payment?.incomingMoney.cents, 1234)
assert.match(transfer.payment!.content, /给 玩家/)
const received: ChatMessage = {
  ...payment.payment!, id: 'claim-regression', chatId: 'claim-group', role: 'assistant',
  charId: 'a', createdAt: 1, status: 'sent',
}
await storage.putMessage(ns, received)
await assert.rejects(storage.claimChatMoney(ns, 'another-chat', received.id), /不可领取/)
await Promise.all([storage.claimChatMoney(ns, received.chatId, received.id), storage.claimChatMoney(ns, received.chatId, received.id)])
const [claimed] = await storage.listMessages(ns, received.chatId)
assert.ok(claimed?.incomingMoney?.claimedAt)
await storage.updateMessage(ns, { ...received, starred: true })
assert.deepEqual((await storage.listMessages(ns, received.chatId))[0]?.incomingMoney, claimed?.incomingMoney)
const a: Character = {
  id: 'a', name: '甲', nickname: '', remark: '', avatar: '', description: '', personality: '', scenario: '',
  firstMes: '', mesExample: '', creatorNotes: '', systemPrompt: '', postHistoryInstructions: '',
  alternateGreetings: [], tags: [], creator: '', characterVersion: '', characterBook: null,
  extensions: {}, rawCard: null, presetId: null, createdAt: 1, updatedAt: 1,
}
const b = { ...a, id: 'b', name: '乙' }
assert.equal(readCharacterWallet(null, { ...a, description: '手头只有 12.50 元' }).balanceCents, 1250)
assert.equal(readCharacterWallet(null, { ...a, description: '身无分文' }).balanceCents, 0)
assert.equal(readCharacterWallet(null, { ...a, description: '经济拮据' }).balanceCents, 2000)
assert.equal(readCharacterWallet({ balanceCents: 0 }, { ...a, description: '家境殷实' }).balanceCents, 0)
assert.deepEqual(takeWalletActivity('我刚刚结了稿费。\n【记账：收入｜15.20｜结了稿费】'), {
  body: '我刚刚结了稿费。', activity: { delta: 1520, evidence: '结了稿费' },
})
assert.equal(takeWalletActivity('还没收到。\n【记账：收入｜15.20｜结了稿费】').activity, undefined)
await storage.putCharacter(ns, a)
await storage.putChat(ns, { id: 'wallet-chat', kind: 'group', title: '群聊', memberIds: [a.id, b.id], unread: 0 } as import('../src/types/index.ts').Chat)
const beforeCoins = await storage.getBag(ns, 'coins')
const walletOrder: Delivery = { id: 'wallet-order', shop: 'duotao', items: [{ name: '茶', qty: 1, price: 6 }], total: 6, recipient: 'self', recipientName: '我', told: false, note: '', createdAt: 1, arrivesAt: 2, reacted: false, payerId: a.id }
await storage.updateCharacterWallet(ns, a.id, wallet => ({ ...wallet, balanceCents: 1_000 }))
await assert.rejects(storage.purchaseDelivery(ns, walletOrder), /亲密付目前不可用/)
await storage.updateCharacterWallet(ns, a.id, wallet => ({ ...wallet, authorization: 'approved' }))
const fundedCard: ChatMessage = { ...received, id: 'funded-payment', chatId: 'wallet-chat', charId: a.id, incomingMoney: { cents: 500, totalCents: 500 } }
const competing = await Promise.allSettled([
  storage.fundCharacterMessage(ns, fundedCard),
  storage.purchaseDelivery(ns, walletOrder),
])
const paidCard = competing[0]?.status === 'fulfilled' && competing[0].value
const paidOrder = competing[1]?.status === 'fulfilled'
assert.equal(Number(paidCard) + Number(paidOrder), 1)
assert.equal((await storage.characterWallet(ns, a.id)).balanceCents, paidCard ? 500 : 400)
assert.equal(await storage.getBag(ns, 'coins'), beforeCoins)
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
const receivedOrder = { ...order, id: 'already-discussed', createdAt: 1, arrivesAt: 2, told: false, reacted: false }
await storage.setBag(ns, 'deliveries', [receivedOrder])
await storage.putMessage(ns, { id: 'gift-user', chatId: 'dm-a', role: 'user', kind: 'text', content: '热茶是我给你买的。', createdAt: 100, status: 'sent' } as ChatMessage)
await storage.putMessage(ns, { id: 'gift-reply', chatId: 'dm-a', role: 'assistant', charId: a.id, kind: 'text', content: '收到了，谢谢，很好喝。', createdAt: 101, status: 'sent' } as ChatMessage)
let arrivalCalls = 0
AIAdapter.prototype.complete = async () => { arrivalCalls++; return { content: '是你买的吗？' } }
try {
  await tickDeliveries(ns, [a])
  assert.equal(arrivalCalls, 0, 'already discussed receipt never starts a delayed notification')
  const synced = (await storage.getBag<Delivery[]>(ns, 'deliveries'))![0]!
  assert.equal(synced.told, true)
  assert.equal(synced.reacted, true)
  assert.match(await purchaseMemory(ns, [a.id]), /玩家已告知是自己下单/)

  const slowOrder = { ...receivedOrder, id: 'slow-notification', createdAt: 200, arrivesAt: 201 }
  await storage.clearChat(ns, 'dm-a')
  await storage.setBag(ns, 'deliveries', [slowOrder])
  AIAdapter.prototype.complete = async () => {
    await storage.putMessage(ns, { id: 'slow-user', chatId: 'dm-a', role: 'user', kind: 'text', content: '我给你买的热茶收到没？', createdAt: 210, status: 'sent' } as ChatMessage)
    await storage.putMessage(ns, { id: 'slow-reply', chatId: 'dm-a', role: 'assistant', charId: a.id, kind: 'text', content: '收到了，刚喝了一口。', createdAt: 211, status: 'sent' } as ChatMessage)
    return { content: '是你买的吗？' }
  }
  const countBefore = (await storage.listMessages(ns, 'dm-a')).length
  await tickDeliveries(ns, [a])
  assert.equal((await storage.listMessages(ns, 'dm-a')).length, countBefore + 2, 'stale generated notification is discarded after a concurrent receipt conversation')
  assert.equal((await storage.getBag<Delivery[]>(ns, 'deliveries'))![0]!.reacted, true)
} finally { AIAdapter.prototype.complete = original }
const post = { id: 'cached-post', charId: a.id, author: '旧昵称', text: '今天做了华夫饼。', at: 10 }
const comment = { id: 'comment-1', author: identity.name, text: '留一块给我？' }
assert.equal(momentAuthor(post, [a, b])?.id, a.id)
assert.equal(momentAuthor({ ...post, charId: undefined }, [a, { ...b, nickname: post.author }, { ...a, remark: post.author }]), undefined)
await Promise.all([
  changeMomentInteraction(ns, post, row => ({ ...row, liked: true })),
  changeMomentInteraction(ns, post, row => ({ ...row, comments: [...row.comments, comment] })),
])
const saved = (await readMomentInteractions(ns))[post.id]!
assert.equal(saved.liked, true)
assert.deepEqual(saved.post, post)
assert.deepEqual(saved.comments, [comment])
assert.equal(await momentMemory(ns, [a]), '')
await changeMomentInteraction(ns, post, row => ({ ...row, comments: [{ ...comment, reply: '给你留了。' }] }))
assert.match(await momentMemory(ns, [a]), /今天做了华夫饼.*留一块给我.*给你留了/)
assert.equal(await momentMemory(ns, [b]), '')
assert.equal(await momentMemory(ns + '_other', [a]), '')
const fromStored = AIAdapter.fromStored
let modelReply: string | null = null
AIAdapter.fromStored = async () => ({ complete: async () => ({ content: JSON.stringify({ reply: modelReply }) }) }) as unknown as AIAdapter
try {
  assert.equal(await replyToMomentComment(post, a, comment), '')
  modelReply = '给你留了。'
  assert.equal(await replyToMomentComment(post, a, comment), modelReply)
} finally { AIAdapter.fromStored = fromStored }

assert.equal(normalizeSettings({}).phoneFontScale, 100)
assert.equal(normalizeSettings({ phoneFontScale: 200 }).phoneFontScale, 130)
assert.equal(normalizeSettings({ phoneFontScale: 115 }).phoneFontScale, 115)
await storage.saveSettings({ ...await storage.getSettings(), phoneFontScale: 115 })
assert.equal((await storage.getSettings()).phoneFontScale, 115)

await storage.setBag(ns, 'diary', [{ id: 'entry', text: '蓝色自行车', at: 1 }])
await rememberSearch(ns, identity.id, '深夜花店')
await Promise.all([
  setGlancePermission(ns, a.id, 'search', true),
  setGlancePermission(ns, a.id, 'diary', true),
  setGlancePermission(ns, b.id, 'search', true),
])
const input = { namespace: ns, identity, character: a, chat: chatA, presets: [], activePresetId: '', fourthWall: false }
let searchPrompt = ''
let fail = true
AIAdapter.fromStored = async () => ({
  complete: async (request: Parameters<AIAdapter['complete']>[0]) => {
    searchPrompt = request.messages[0]!.content
    if (fail) throw Error('model unavailable')
    return { content: '嗯，知道了。' }
  },
}) as unknown as AIAdapter
try {
  assert.equal((await deliverSms({ ...input, text: '到家了吗？' })).role, 'system')
  assert.ok(await pendingGlance(ns, a.id), 'failed replies do not consume a mention')
  fail = false
  const reply = await replyInChat(input)
  assert.equal(reply.role, 'assistant', reply.content)
  assert.match(searchPrompt, /蓝色自行车/)
  assert.match(searchPrompt, /深夜花店/)
  assert.match(reply.content, /蓝色自行车/, 'an omitted mention is added to the same reply')
  assert.doesNotMatch(reply.content, /回针已提及/)
  assert.equal(await pendingGlance(ns, a.id), null)
  assert.doesNotMatch((await pendingGlance(ns, b.id))!.note, /蓝色自行车/)

  await rememberSearch(ns, identity.id, '周末市集')
  const next = await deliverSms({ ...input, text: '周末见。' })
  assert.match(searchPrompt, /周末市集/)
  assert.doesNotMatch(searchPrompt, /蓝色自行车/)
  assert.match(next.content, /周末市集/)
  assert.equal(await pendingGlance(ns, a.id), null)
  await setGlancePermission(ns, a.id, 'diary', false)
  await storage.setBag(ns, 'diary', [{ id: 'new-entry', text: '撤回后的日记', at: 2 }])
  assert.equal(await pendingGlance(ns, a.id), null)
} finally { AIAdapter.fromStored = fromStored }
console.log('Channel and delivery checks passed: participant isolation, arrival fallback, concurrent purchases, persisted font size and immediate phone-permission mentions')
