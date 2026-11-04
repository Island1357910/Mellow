import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { AIAdapter } from '../src/engine/AIAdapter.ts'
import { normalizeSettings } from '../src/lib/defaults.ts'

const adapter = new AIAdapter({ endpoint: 'https://test.invalid/v1', model: 'test', key: 'test-only' })
const originalFetch = globalThis.fetch
const payloads: Array<Record<string, unknown>> = []
const messages = [{ role: 'system' as const, content: '原格式和知识边界必须保留。'.repeat(500) }, { role: 'user' as const, content: '在家' }]
const before = JSON.stringify(messages)
function replies(rows: Array<{ content?: string; reasoning_content?: string; finish?: string } | Error | number>) {
  payloads.length = 0
  globalThis.fetch = async (_url, init) => {
    payloads.push(JSON.parse(String(init?.body)))
    const next = rows.shift()
    assert(next !== undefined, 'unexpected extra request')
    if (next instanceof Error) throw next
    if (typeof next === 'number') return new Response(JSON.stringify({ error: { message: 'invalid parameter max_tokens' } }), { status: next })
    return new Response(JSON.stringify({ choices: [{ finish_reason: next.finish ?? 'stop', message: { content: next.content ?? '', reasoning_content: next.reasoning_content } }] }))
  }
}
try {
  replies([{ reasoning_content: 'private analysis', finish: 'length' }, { content: '他抬头看向你。' }])
  const recovered = await adapter.complete({ messages, maxTokens: 512 })
  assert.equal(recovered.content, '他抬头看向你。')
  assert.equal(recovered.recovered, true)
  assert.equal(payloads[0].max_tokens, 8192)
  assert.equal(payloads[1].max_tokens, 16384)
  assert(payloads.every(body => !JSON.stringify(body).includes('private analysis')))
  assert(payloads.every(body => JSON.stringify(body).includes(messages[0].content)))

  replies([{ content: '{"text":"半', finish: 'length' }, { content: '糖"}' }])
  const json = await adapter.complete({ messages })
  assert.deepEqual(JSON.parse(json.content), { text: '半糖' })
  assert.equal(json.truncated, false)
  assert.match(JSON.stringify(payloads[1]), /不重复|不要重复/)

  replies([{ content: '{"text":"hello', finish: 'length' }, { content: ' world"}' }])
  assert.deepEqual(JSON.parse((await adapter.complete({ messages })).content), { text: 'hello world' })
  replies([{ content: 'Hello ', finish: 'length' }, { content: 'world.' }])
  assert.equal((await adapter.complete({ messages })).content, 'Hello world.')
  const head = '这是一段不能重复的完整开头，后面还有一半'
  replies([{ content: head, finish: 'length' }, { content: head + '结尾。' }])
  assert.equal((await adapter.complete({ messages })).content, head + '结尾。')
  replies([{ content: head, finish: 'length' }, { content: head.slice(-14) + '结尾。' }])
  assert.equal((await adapter.complete({ messages })).content, head + '结尾。')

  replies([{ content: '保留的半段', finish: 'length' }, new TypeError('Failed to fetch')])
  const partial = await adapter.complete({ messages })
  assert.equal(partial.content, '保留的半段')
  assert.equal(partial.truncated, true)

  replies(Array.from({ length: 3 }, () => ({ reasoning_content: 'hidden', finish: 'length' })))
  await assert.rejects(adapter.complete({ messages }), /没有可显示的正文/)
  assert.equal(payloads.length, 3, 'recovery is bounded')
  replies([{ content: '半段', finish: 'length' }])
  const disabled = await adapter.complete({ messages, maxTokens: 512, antiTruncation: false })
  assert.equal(payloads[0].max_tokens, 512)
  assert.equal(disabled.truncated, true)
  assert.equal(payloads.length, 1)

  replies([{ content: '' }, { content: '空正文恢复。' }])
  assert.equal((await adapter.complete({ messages })).content, '空正文恢复。')
  assert.equal(payloads.length, 2)
  replies([400, { content: '兼容正文' }])
  assert.equal((await adapter.complete({ messages })).content, '兼容正文')
  assert.equal(payloads[1].max_tokens, 8192)
  assert.deepEqual(payloads[1].messages, messages, 'compatibility must not trim history or system boundaries')
  assert.equal(JSON.stringify(messages), before)
  assert.deepEqual(normalizeSettings({}).generation, { antiTruncation: true, maxOutputTokens: 8192, timeoutSeconds: 180 })
  assert.deepEqual(normalizeSettings({ generation: { antiTruncation: false, maxOutputTokens: -1, timeoutSeconds: Infinity } }).generation,
    { antiTruncation: false, maxOutputTokens: 1024, timeoutSeconds: 600 })
} finally { globalThis.fetch = originalFetch }
console.log('Generation checks passed: reasoning-only recovery, budgets, JSON continuation, overlap, partial preservation, bounded retries, disabling and full-context compatibility')
