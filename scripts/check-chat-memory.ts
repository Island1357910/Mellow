import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { storage } from '../src/storage/StorageService.ts'
import { AIAdapter, AIError } from '../src/engine/AIAdapter.ts'
import { chatMemoryNote, completedChatTurns, pendingChatTurns, readChatMemory, patchChatMemory, summarizeChatMemory } from '../src/lib/chatMemory.ts'
import { apiErrorText } from '../src/lib/apiErrorText.ts'
import type { Chat, ChatMessage } from '../src/types/index.ts'

const snap = await storage.boot(), identity = snap.identities[0]!, ns = identity.namespace
await storage.saveApiProfile({ name: 'memory-test', endpoint: 'https://test.invalid/v1', model: 'test', key: 'test-only', ready: true })
const chat: Chat = { id: 'memory-chat', kind: 'dm', title: '记忆测试', memberIds: ['a'], lastMessage: '', lastMessageAt: 0, unread: 0, presetId: null, createdAt: 1, updatedAt: 1, backstory: '手填关系必须保留' }
await storage.putChat(ns, chat)
const msg = (id: string, role: ChatMessage['role'], at: number, content = id, kind: ChatMessage['kind'] = 'text'): ChatMessage => ({ id, chatId: chat.id, role, kind, charId: role === 'assistant' ? 'a' : null, content, createdAt: at, status: 'sent' })
const rounds = (from: number, count: number) => Array.from({ length: count }, (_, i) => {
  const n = from + i
  return [msg(`u${n}`, 'user', n * 100, `玩家约定${n}`), msg(`a${n}`, 'assistant', n * 100 + 1, `角色答复${n}`), msg(`b${n}`, 'assistant', n * 100 + 2, '角色连发的第二条')]
}).flat()
const save = async (messages: ChatMessage[]) => { for (const message of messages) await storage.putMessage(ns, message) }
const initial = [msg('greeting', 'assistant', 1), ...rounds(1, 9), msg('error', 'system', 950, 'raw-error-secret', 'system')]
await save(initial)
assert.equal(completedChatTurns(initial).length, 9)
assert.equal(completedChatTurns([msg('u', 'user', 1), { ...msg('failed', 'assistant', 2), status: 'failed' }, msg('tip', 'system', 3, 'error', 'system')]).length, 0)
assert.equal(completedChatTurns([msg('u', 'user', 1), { ...msg('hidden', 'assistant', 2), hidden: true }]).length, 0)
assert.equal(completedChatTurns([msg('u', 'user', 1), msg('think', 'assistant', 2, '<think>private</think>')]).length, 0)
const original = AIAdapter.prototype.complete
let calls = 0, prompts: string[] = []
AIAdapter.prototype.complete = async request => { calls++; prompts.push(JSON.stringify(request.messages)); return { content: '角色 a 与玩家约好周末去看海。', model: 'test', provider: 'openai' } }
try {
  await summarizeChatMemory(ns, chat.id)
  assert.equal(calls, 0, 'nine completed rounds must not summarize')
  await save(rounds(10, 1))
  await storage.putChat(ns, { ...chat, id: 'other-chat' })
  await storage.putMessage(ns, { ...msg('other-secret', 'user', 1, '其他会话的私密内容'), chatId: 'other-chat' })
  await Promise.all([summarizeChatMemory(ns, chat.id), summarizeChatMemory(ns, chat.id)])
  assert.equal(calls, 1, 'concurrent jobs share a persistent lease')
  let memory = await readChatMemory(ns, chat.id)
  assert.equal(memory.rounds, 10)
  assert.equal(memory.through?.id, 'u10')
  assert.equal(memory.text, '角色 a 与玩家约好周末去看海。')
  assert.equal((await storage.getChat(ns, chat.id))?.backstory, chat.backstory)
  assert(!prompts[0].includes('其他会话的私密内容'))
  assert(!prompts[0].includes('raw-error-secret'))
  assert.match(await chatMemoryNote(ns, chat.id), /周末去看海/)
  assert.equal(await chatMemoryNote(ns, 'other-chat'), '')
  await summarizeChatMemory(ns, chat.id)
  assert.equal(calls, 1, 'already summarized rounds are not charged again')
  await save(rounds(11, 10))
  assert.equal(pendingChatTurns(await storage.listMessages(ns, chat.id), memory).length, 10)

  AIAdapter.prototype.complete = async () => { throw new Error('模型暂时不可用') }
  await summarizeChatMemory(ns, chat.id)
  memory = await readChatMemory(ns, chat.id)
  assert.equal(memory.rounds, 10)
  assert.equal(memory.through?.id, 'u10')
  assert.match(memory.error!, /不可用/)
  assert.equal(memory.running, undefined)
  AIAdapter.prototype.complete = async () => ({ content: '半段', model: 'test', provider: 'openai', truncated: true })
  await summarizeChatMemory(ns, chat.id)
  assert.equal((await readChatMemory(ns, chat.id)).text, '角色 a 与玩家约好周末去看海。')

  AIAdapter.prototype.complete = async request => {
    assert.match(JSON.stringify(request.messages), /周末去看海/)
    await patchChatMemory(ns, chat.id, { text: '用户正在编辑的记忆' })
    return { content: '不得覆盖用户编辑', model: 'test', provider: 'openai' }
  }
  await summarizeChatMemory(ns, chat.id)
  assert.equal((await readChatMemory(ns, chat.id)).text, '用户正在编辑的记忆')
  assert.equal((await readChatMemory(ns, chat.id)).rounds, 10)

  AIAdapter.prototype.complete = async () => {
    await storage.deleteMessage(ns, 'a11')
    return { content: '包含已删除原文的整理不得写入', model: 'test', provider: 'openai' }
  }
  await summarizeChatMemory(ns, chat.id)
  assert.equal((await readChatMemory(ns, chat.id)).rounds, 10)
  assert.match((await readChatMemory(ns, chat.id)).error!, /发生变化/)
  AIAdapter.prototype.complete = async () => ({ content: '合并后的完整记忆', model: 'test', provider: 'openai' })
  await summarizeChatMemory(ns, chat.id)
  memory = await readChatMemory(ns, chat.id)
  assert.equal(memory.rounds, 20)
  assert.equal(memory.through?.id, 'u20')
  assert.equal(memory.error, undefined)
  await storage.deleteMessage(ns, 'u20')
  assert.equal(pendingChatTurns(await storage.listMessages(ns, chat.id), memory).length, 0, 'deleting a checkpoint does not reprocess old rounds')
  await save(rounds(21, 1))
  await patchChatMemory(ns, chat.id, { enabled: false, interval: 1 })
  await summarizeChatMemory(ns, chat.id)
  assert.equal((await readChatMemory(ns, chat.id)).rounds, 20)
  await summarizeChatMemory(ns, chat.id, true)
  assert.equal((await readChatMemory(ns, chat.id)).rounds, 21)

  // System tips can be deleted without changing actual conversation messages or memory.
  await storage.deleteMessages(ns, chat.id, ['error'])
  assert(!(await storage.listMessages(ns, chat.id)).some(message => message.id === 'error'))
  assert((await storage.listMessages(ns, chat.id)).some(message => message.id === 'u1'))
  assert.equal((await readChatMemory(ns, chat.id)).rounds, 21)
} finally { AIAdapter.prototype.complete = original }

const diagnostic = 'The requested model is temporarily unavailable (model_not_found · new_api_error)'
assert.match(apiErrorText(diagnostic), /所选模型暂时不可用/)
assert.equal(apiErrorText('角色换了签名'), '角色换了签名')
const originalFetch = globalThis.fetch
let requests = 0
try {
  const adapter = new AIAdapter({ endpoint: 'https://test.invalid/v1', model: 'missing', key: 'test-only' })
  for (const status of [404, 200]) {
    requests = 0
    globalThis.fetch = async () => { requests++; return new Response(JSON.stringify({ error: { message: diagnostic, code: 'model_not_found' } }), { status }) }
    await assert.rejects(adapter.complete({ messages: [{ role: 'user', content: '你好' }] }), error => {
      assert(error instanceof AIError)
      assert.match(error.message, /重新拉取/)
      assert.match(error.diagnostic!, /model_not_found/)
      return true
    })
    assert.equal(requests, 1, 'unavailable models are not silently changed or retried in a paid loop')
  }
} finally { globalThis.fetch = originalFetch }
console.log('Chat memory checks passed: rounds, split replies, isolation, leases, checkpointing, failures, editing/deletion races, manual controls, injection and removable model-error tips')
process.exit(0)
