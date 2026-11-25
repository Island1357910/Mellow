import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { AIAdapter } from '../src/engine/AIAdapter.ts'
import { normalizeSettings } from '../src/lib/defaults.ts'

const adapter = new AIAdapter({ endpoint: 'https://test.invalid/v1', model: 'test', key: 'test-only' })
const originalFetch = globalThis.fetch
const payloads: Array<Record<string, unknown>> = []
const messages = [{ role: 'system' as const, content: '原格式和知识边界必须保留。'.repeat(500) }, { role: 'user' as const, content: '在家' }]
const before = JSON.stringify(messages)
function replies(rows: Array<{ content?: string; reasoning_content?: string; finish?: string } | Error | number | string>) {
  payloads.length = 0
  globalThis.fetch = async (_url, init) => {
    payloads.push(JSON.parse(String(init?.body)))
    const next = rows.shift()
    assert(next !== undefined, 'unexpected extra request')
    if (next instanceof Error) throw next
    if (typeof next === 'number') return new Response(JSON.stringify({ error: { message: 'invalid parameter max_tokens' } }), { status: next })
    if (typeof next === 'string') return new Response(JSON.stringify({ error: { message: next } }), { status: 400 })
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

  for (const content of ['半段正文', '{"text":"半', '<p>正文</p><status>未完成']) {
    replies([{ content, finish: 'length' }])
    const partial = await adapter.complete({ messages })
    assert.equal(partial.content, content)
    assert.equal(partial.truncated, true)
    assert.equal(partial.recovered, false)
    assert.equal(payloads.length, 1, 'visible partial content must never trigger automatic continuation')
  }
  let streamReads = 0
  globalThis.fetch = async (_url, init) => {
    assert.equal(JSON.parse(String(init?.body)).stream, true)
    return new Response(new ReadableStream({
      pull(controller) {
        if (streamReads++ === 0) {
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"已收到的正文。"}}]}\n\n'))
        } else controller.error(new TypeError('Failed to fetch'))
      },
    }), { headers: { 'Content-Type': 'text/event-stream' } })
  }
  const interrupted = await adapter.complete({ messages, stream: true })
  assert.equal(interrupted.content, '已收到的正文。')
  assert.equal(interrupted.truncated, true)
  assert.equal(interrupted.interrupted, true)
  replies(['unsupported stream', { content: '非流式兼容。' }])
  assert.equal((await adapter.complete({ messages, stream: true })).content, '非流式兼容。')
  assert.equal(payloads[0].stream, true)
  assert.equal(payloads[1].stream, false)

  replies(Array.from({ length: 2 }, () => ({ reasoning_content: 'hidden', finish: 'length' })))
  await assert.rejects(adapter.complete({ messages }), /没有可显示的正文/)
  assert.equal(payloads.length, 2, 'empty recovery is limited to one additional generation')
  replies([{ content: '半段', finish: 'length' }])
  const disabled = await adapter.complete({ messages, maxTokens: 512, antiTruncation: false })
  assert.equal(payloads[0].max_tokens, 512)
  assert.equal(disabled.truncated, true)
  assert.equal(payloads.length, 1)

  replies([{ content: '' }, { content: '空正文恢复。' }])
  assert.equal((await adapter.complete({ messages })).content, '空正文恢复。')
  assert.equal(payloads.length, 2)
  replies(['请求参数校验失败', { content: '第一段\\n第二段' }])
  assert.equal((await adapter.complete({ messages, antiTruncation: false, maxTokens: 128 })).content, '第一段\n第二段')
  assert.equal(payloads.length, 2)
  assert.equal('temperature' in payloads[1], false)
  replies([400, { content: '兼容正文' }])
  assert.equal((await adapter.complete({ messages })).content, '兼容正文')
  assert.equal(payloads[1].max_tokens, 8192)
  assert.deepEqual(payloads[1].messages, messages, 'compatibility must not trim history or system boundaries')
  replies([400, 400, { content: '新额度参数兼容正文' }])
  assert.equal((await adapter.complete({ messages, maxTokens: 512 })).content, '新额度参数兼容正文')
  assert.equal(payloads.length, 3)
  assert.equal(payloads[2].max_completion_tokens, 8192)
  assert.equal('max_tokens' in payloads[2], false, 'the two alternative budget parameters must not be sent together')
  assert.deepEqual(payloads[2].messages, messages, 'switching budget fields preserves the complete context')
  replies([new TypeError('Failed to fetch'), { content: '不应重发' }])
  await assert.rejects(adapter.complete({ messages }), /请求中途断开/)
  assert.equal(payloads.length, 1, 'a disconnected request may already have reached the provider')
  assert.equal(JSON.stringify(messages), before)
  assert.deepEqual(normalizeSettings({}).generation, { antiTruncation: true, maxOutputTokens: 8192, timeoutSeconds: 180 })
  assert.deepEqual(normalizeSettings({ generation: { antiTruncation: false, maxOutputTokens: -1, timeoutSeconds: Infinity } }).generation,
    { antiTruncation: false, maxOutputTokens: 1024, timeoutSeconds: 600 })
} finally { globalThis.fetch = originalFetch }
console.log('Generation checks passed: reasoning-only recovery, budgets, single-call partial preservation, one empty-body recovery, disabling and full-context compatibility')
