import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { AIAdapter } from '../src/engine/AIAdapter.ts'
import { buildSmsMessages } from '../src/engine/prompt.ts'
import { replyInChat } from '../src/domain/messaging.ts'
import { writeCharacter } from '../src/domain/importing.ts'
import { storage } from '../src/storage/StorageService.ts'
import { useMellow } from '../src/store/useMellow.ts'
import type { AIMessage } from '../src/types/index.ts'

const originalFetch = globalThis.fetch
const requests: Array<Record<string, unknown> & { messages: AIMessage[] }> = []
let rejectFirst = false
globalThis.fetch = async (_url, init) => {
  const body = JSON.parse(String(init?.body))
  requests.push(body)
  const last = body.messages.at(-1)
  if (last?.role !== 'user' || !last.content.trim()) {
    return new Response(JSON.stringify({ error: { message: 'Last message must have user role' } }), { status: 400 })
  }
  if (rejectFirst && requests.length === 1) {
    return new Response(JSON.stringify({ error: { message: 'invalid parameter max_tokens' } }), { status: 400 })
  }
  return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: '今天路过那家店，想起你。' } }] }), { status: 200 })
}
try {
  const adapter = new AIAdapter({ endpoint: 'https://example.invalid/v1', model: 'strict-role-test', key: 'test-only' })
  const longHistory = '完整历史不应因补充末尾角色而被截断。'.repeat(100)
  for (const messages of [
    [{ role: 'system', content: '设定' }, { role: 'assistant', content: longHistory }],
    [{ role: 'user', content: '真实玩家的话' }, { role: 'assistant', content: longHistory }, { role: 'system', content: '末尾关系优先约束' }],
    [{ role: 'system', content: '设定' }],
    [{ role: 'user', content: '  ' }],
    [{ role: 'user', content: '正常请求保持原样' }],
    [],
  ] as AIMessage[][]) {
    const before = JSON.stringify(messages)
    requests.length = 0
    await adapter.complete({ messages, maxTokens: 1234, temperature: 0.65, topP: 0.8, presencePenalty: 0.2 })
    assert.equal(requests.length, 1, 'strict role endpoint accepts the first full-context request')
    assert.equal(requests[0].messages.at(-1)?.role, 'user')
    assert.equal(requests[0].max_tokens, 1234)
    assert.equal(requests[0].temperature, 0.65)
    assert.equal(requests[0].top_p, 0.8)
    assert.equal(requests[0].presence_penalty, 0.2)
    assert.equal(JSON.stringify(messages), before, 'caller history is not mutated')
    if (messages.some(item => item.content === longHistory)) assert(requests[0].messages.some(item => item.content === longHistory))
    if (messages.at(-1)?.content === '末尾关系优先约束') assert(requests[0].messages.some(item => item.role === 'system' && item.content === '末尾关系优先约束'))
    if (messages.at(-1)?.content === '正常请求保持原样') assert.deepEqual(requests[0].messages, messages)
  }
  rejectFirst = true
  requests.length = 0
  await adapter.complete({ messages: [{ role: 'assistant', content: longHistory }] })
  assert.equal(requests.length, 2)
  assert(requests.every(body => body.messages.at(-1)?.role === 'user' && body.messages.at(-1)?.content.trim()))
  rejectFirst = false

  const snapshot = await storage.boot(), identity = snapshot.identities[0]
  await storage.saveApiProfile({ name: 'strict-role-test', endpoint: 'https://example.invalid/v1', model: 'strict-role-test', key: 'test-only', ready: true })
  await writeCharacter({ identity, name: '主动消息回归', description: '仅供回归测试', personality: '简洁自然', firstMes: '在吗？' })
  const character = (await storage.listModernCharacters(identity.namespace)).find(item => item.name === '主动消息回归')!
  const chat = { ...(await storage.listChats(identity.namespace)).find(item => item.memberIds.includes(character.id))!, replyMin: 1, replyMax: 1 }
  await storage.putChat(identity.namespace, chat)
  useMellow.setState({ viewingChatId: chat.id, identities: snapshot.identities, activeIdentityId: identity.id })
  const history = await storage.listMessages(identity.namespace, chat.id)
  const built = buildSmsMessages({ character, identity, preset: null, history, fourthWall: false, proactive: true,
    priority: '必须遵守的最新关系变化', triggerNote: '当前读到第三页，主动聊一两句。' })
  assert.equal(built.messages.at(-1)?.role, 'user')
  assert.match(built.messages.at(-1)!.content, /玩家没有发送新消息/)
  assert.match(built.messages.at(-1)!.content, /当前读到第三页/)
  assert(built.messages.some(item => item.role === 'system' && item.content === '必须遵守的最新关系变化'))
  for (const triggerNote of [undefined, '围绕共同阅读的当前页主动聊一句。', '今天的约定还有半小时，主动提醒一句。']) {
    requests.length = 0
    const before = await storage.listMessages(identity.namespace, chat.id)
    const reply = await replyInChat({ namespace: identity.namespace, identity, character, chat,
      presets: snapshot.presets, activePresetId: snapshot.presets[0].id, fourthWall: false, proactive: true, triggerNote })
    assert.equal(reply.role, 'assistant')
    assert.equal(requests.length, 1)
    assert.equal(requests[0].messages.at(-1)?.role, 'user')
    assert.match(requests[0].messages.at(-1)!.content, /不是玩家发来的短信/)
    if (triggerNote) assert(requests[0].messages.at(-1)!.content.includes(triggerNote))
    const after = await storage.listMessages(identity.namespace, chat.id)
    assert.equal(after.filter(item => item.role === 'user').length, before.filter(item => item.role === 'user').length)
    assert(!after.some(item => item.content.includes('应用触发的主动消息任务')), 'request control hints never enter chat storage')
  }
} finally { globalThis.fetch = originalFetch }
console.log('Proactive API checks passed: user-ending first request and fallback, full context and parameters, proactive/reading/reminder delivery, no fabricated player records')
process.exit(0)
