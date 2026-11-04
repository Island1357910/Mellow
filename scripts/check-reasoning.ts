import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { stripReasoning } from '../src/lib/reasoning.ts'
import { stripThinkingFromSms } from '../src/lib/smsSanitize.ts'
import { AIAdapter } from '../src/engine/AIAdapter.ts'
import { generate, writeSummary, newSave, line } from '../src/engine/story.ts'
import { storage } from '../src/storage/StorageService.ts'

for (const text of [
  '<think>hidden</think>正文',
  '<THINK source="model">hidden\n<analysis>nested</analysis></THINK>正文',
  '<think>hidden</think><reasoning>more</reasoning>正文',
  'hidden tail</think>正文',
  '正文<think>unfinished hidden',
  '正文<thinking source="unfinished"',
  '```analysis\nhidden\n```\n正文',
  '~~~thinking\nhidden\n~~~\n正文',
  '正文\n```reasoning\nhidden unfinished',
  '【思考过程】\nhidden\nmore hidden\n【正文】\n正文',
  '### 思维链\nhidden\n### 最终回答\n正文',
  '**Analysis:** hidden\nmore hidden\n**Final Answer:** 正文',
]) assert.equal(stripReasoning(text), '正文', text)
for (const text of ['<think>hidden', '<thinking', '```thinking\nhidden', '思考过程：\nhidden']) assert.equal(stripReasoning(text), '')
for (const text of ['“让我想一想。”他在心里思索着。', '【内心独白】我其实很想见你。',
  '<div class="story"><p>他在想，雨什么时候停。</p><status>心情：平静</status></div>',
  '{"characters":[{"name":"林澄","description":"习惯思考后再说话"}]}',
  '```html\n<div>剧情正文</div>\n```']) assert.equal(stripReasoning(text), text)
assert.equal(stripThinkingFromSms('<think>hidden</think>你好<status>状态</status>'), '你好')

const adapter = new AIAdapter({ endpoint: 'https://example.invalid/v1', model: 'test', key: 'test-only' })
const fetchOriginal = globalThis.fetch
let calls = 0
function mock(body: unknown) {
  calls = 0
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify(body), { status: 200 }) }
}
const request = { messages: [{ role: 'user' as const, content: '继续' }] }
try {
  for (const body of [
    { choices: [{ message: { reasoning_content: 'hidden', content: '<think>hidden</think>正文' } }] },
    { choices: [{ message: { content: [{ type: 'reasoning', text: 'hidden' }, { type: 'text', text: '正文' }] } }] },
    { content: [{ type: 'thinking', text: 'hidden' }, { type: 'text', text: '正文' }] },
    { output: [{ type: 'reasoning', summary: [{ type: 'summary_text', text: 'hidden' }] }, { type: 'message', content: [{ type: 'output_text', text: '正文' }] }] },
  ]) {
    mock(body)
    assert.equal((await adapter.complete(request)).content, '正文')
    assert.equal(calls, 1)
  }
  for (const body of [
    { choices: [{ message: { content: '', reasoning_content: 'hidden' } }] },
    { choices: [{ message: { content: '<think>hidden</think>' } }] },
    { choices: [{ message: { content: [{ type: 'thinking', text: 'hidden' }] } }] },
  ]) {
    mock(body)
    await assert.rejects(adapter.complete({ ...request, antiTruncation: false }), /只返回了思考内容/)
    assert.equal(calls, 1, 'reasoning-only responses must not trigger paid retry loops')
  }
} finally { globalThis.fetch = fetchOriginal }

await storage.boot()
await storage.saveApiProfile({ name: 'test', endpoint: 'https://example.invalid/v1', model: 'test', key: 'test-only', ready: true })
const original = AIAdapter.prototype.complete
try {
  AIAdapter.prototype.complete = async () => ({ content: '<think>hidden</think>他推开门，笑着打了声招呼。', model: 'test' })
  for (const mode of ['offline', 'side', 'jiushi'] as const) {
    assert.equal(await generate(request.messages, null, 200, mode), '他推开门，笑着打了声招呼。')
    const summary = await writeSummary({ ...newSave('测试'), lines: [line('user', '你好')] }, 'small', 4, mode)
    assert.equal(summary.summaries[0].text, '他推开门，笑着打了声招呼。')
  }
  AIAdapter.prototype.complete = async () => ({ content: '<think>hidden unfinished', model: 'test' })
  await assert.rejects(generate(request.messages, null), /没有剧情正文/)
  await assert.rejects(writeSummary({ ...newSave('测试'), lines: [line('user', '你好')] }, 'small', 4), /总结返回为空/)
} finally { AIAdapter.prototype.complete = original }
console.log('Reasoning checks passed: tags, nested/truncated blocks, fences, headings, preserved prose/HTML/JSON, provider fields, typed content, story modes and summaries')
process.exit(0)
