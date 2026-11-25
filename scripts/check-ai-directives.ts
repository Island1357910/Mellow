import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { AIAdapter } from '../src/engine/AIAdapter.ts'
import { takeReasoning } from '../src/lib/reasoning.ts'
import { draftDirective } from '../src/lib/directives.ts'
import { storage } from '../src/storage/StorageService.ts'

const directive = { title: '先想再说', text: '把简短想法放进 <thinking> 和 </thinking>，然后输出正文。\n保留角色口吻。' }
const json = JSON.stringify(directive)
for (const source of [json, '```json\n' + json + '\n```', '<think>整理规则</think>\n' + json]) {
  const result = takeReasoning(source)
  assert.ok(result.content.includes(json), 'literal tags in generated JSON must survive filtering')
  assert.ok(!result.content.includes('整理规则'))
}
assert.equal(takeReasoning('<thinking>' + json + '</thinking>').content, '', 'JSON inside actual reasoning stays hidden')

const adapter = new AIAdapter({ endpoint: 'https://test.invalid/v1', model: 'test', key: 'test-only' })
const originalFetch = globalThis.fetch
const messages = [{ role: 'user' as const, content: '生成一条写作指令' }]
let calls = 0
try {
  for (const content of [json, [{ type: 'reasoning', text: '只在思考区' }, { type: 'text', text: json }]]) {
    calls = 0
    const event = 'data: ' + JSON.stringify({ choices: [{ delta: { content }, finish_reason: 'stop' }] })
    const bytes = new TextEncoder().encode(event)
    globalThis.fetch = async () => {
      calls++
      return new Response(new ReadableStream({ start(controller) {
        for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7))
        controller.close()
      } }), { headers: { 'Content-Type': 'text/event-stream' } })
    }
    const result = await adapter.complete({ messages, stream: true })
    assert.deepEqual(JSON.parse(result.content), directive)
    assert.equal(result.truncated, false)
    assert.equal(calls, 1, 'complete tail events must not trigger recovery requests')
  }
  await storage.boot()
  await storage.saveApiProfile({ name: 'test', endpoint: 'https://test.invalid/v1', model: 'test', key: 'test-only', ready: true })
  const outputs = [json]
  const requests: Array<{ messages: { content: string }[]; max_tokens: number }> = []
  globalThis.fetch = async (_url, init) => {
    requests.push(JSON.parse(String(init?.body)))
    assert.ok(outputs.length)
    return Response.json({ choices: [{ message: { content: outputs.shift() }, finish_reason: 'stop' }] })
  }
  const result = await draftDirective('使用简短的角色想法')
  assert.equal(result.text, directive.text)
  assert.equal(requests.length, 1)
  assert.ok(requests.every(request => request.max_tokens >= 8192 && request.messages.at(-1)?.content === '使用简短的角色想法'))
  await assert.rejects(draftDirective('  '), /请先填写/)
  outputs.push('{"title":"空指令","text":""}', '缺了 JSON 格式也直接显示这段指令')
  const partial = await draftDirective('保持角色口吻')
  assert.equal(partial.title, '空指令')
  assert.equal(partial.text, '')
  const plain = await draftDirective('保持角色口吻')
  assert.equal(plain.text, '缺了 JSON 格式也直接显示这段指令')
  assert.equal(requests.length, 3, 'partial and unstructured outputs must not trigger repair calls')

} finally { globalThis.fetch = originalFetch }
console.log('AI directive checks passed: literal reasoning tags, structured drafts, stream tails, typed chunks, UTF-8 boundaries and bounded repairs')
