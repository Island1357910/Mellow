import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { storage } from '../src/storage/StorageService.ts'
import { AIAdapter } from '../src/engine/AIAdapter.ts'
import { buildStoryPrompt, DEFAULT_CONFIG, focusChars, generate, generateStoryReply, mergeStoryContinuation, newSave, putSave, saveConfig, writeSummary } from '../src/engine/story.ts'
import { runStoryGeneration } from '../src/domain/storyRunner.ts'
import { writeWorld } from '../src/lib/worldbook.ts'
import type { AIMessage, Character } from '../src/types/index.ts'

const snap = await storage.boot(), identity = snap.identities[0]!, ns = identity.namespace
const person = (id: string, name: string): Character => ({ id, name, nickname: '', remark: '', avatar: '', description: '背景'.repeat(600) + `${name}独有的身份结尾`, personality: '性格'.repeat(300) + `${name}独有的性格结尾`, scenario: '初次见面', mesExample: '', systemPrompt: `${name}本人指令`, postHistoryInstructions: `${name}后置设定`, tags: [], extensions: {}, createdAt: 1, updatedAt: 1 } as Character)
const a = person('a', '阿青'), b = person('b', '阿墨'), c = person('c', '阿白'), chars = [a, b, c]
const cast = newSave('三人', { lines: [
  { id: 'u', role: 'user', content: '我们坐下来', createdAt: 1, participantIds: ['a', 'b', 'c'] },
  { id: 'a', role: 'assistant', content: '前段细节。'.repeat(200) + '三人已经吃完饭，阿墨已经付款，阿白收好了雨伞。', createdAt: 2, participantIds: ['a', 'b', 'c'] },
  { id: 'u2', role: 'user', content: '我对阿青点头', createdAt: 3 },
] })
assert.deepEqual(focusChars(chars, cast).map(p => p.id), ['a', 'b', 'c'], 'addressing one person cannot remove the rest of the cast')
const onlyA = { ...cast, lines: [{ ...cast.lines[0]!, participantIds: ['a'] }, { id: 'mention', role: 'user' as const, content: '我和阿青聊起阿墨，想起阿白', createdAt: 4 }] }
assert.deepEqual(focusChars(chars, onlyA).map(p => p.id), ['a'], 'references do not make people enter')
assert.deepEqual(focusChars(chars, onlyA, '去找阿墨').map(p => p.id), ['b'], 'explicit scene changes replace the cast')
assert.deepEqual(focusChars(chars, onlyA, '阿青走了，只剩阿墨').map(p => p.id), ['b'], 'departed people do not remain in the cast')
assert.deepEqual(focusChars(chars, newSave('称呼'), '“阿墨，你好。”').map(p => p.id), ['b'], 'directly addressing someone in quotes still resolves the character')
assert.deepEqual(focusChars(chars, { ...cast, lines: [{ ...cast.lines[0]!, participantIds: [] }] }), [], 'an explicitly empty cast does not revive old people')
const short = person('short', '张三'), long = person('long', '张三丰')
assert.deepEqual(focusChars([short, long], newSave('同名', { lines: [{ id: 'n', role: 'user', content: '去找张三丰', createdAt: 1 }] })).map(p => p.id), ['long'])
assert.deepEqual(focusChars([{ ...a, nickname: '小猫' }, { ...b, nickname: '小猫' }], newSave('歧义', { lines: [{ id: 'n', role: 'user', content: '找小猫', createdAt: 1 }] })), [], 'ambiguous aliases must not pick both people')
const prompt = buildStoryPrompt({ mode: 'offline', save: { ...cast, summaries: [{ id: 'summary', kind: 'small', text: '旧事'.repeat(600) + '最新约定尚未完成', upTo: 1, createdAt: 1 }] }, chars, identity, preset: null, config: DEFAULT_CONFIG })
for (const char of chars) {
  assert(prompt[0]!.content.includes(`${char.name}独有的身份结尾`))
  assert(prompt[0]!.content.includes(`${char.name}独有的性格结尾`))
  assert(prompt[0]!.content.includes(`${char.name}本人指令`))
  assert(prompt[0]!.content.includes(`${char.name}后置设定`))
}
assert(prompt[0]!.content.includes('最新约定尚未完成'))
assert(prompt.some(m => m.content.includes('阿白收好了雨伞')))
const original = AIAdapter.fromStored
let requests: Array<{ messages: AIMessage[]; maxTokens?: number }> = []
let answer = '三人走到门外，阿墨撑开伞，阿白在旁等候。'.repeat(5)
AIAdapter.fromStored = async () => ({ complete: async (request: { messages: AIMessage[]; maxTokens?: number }) => { requests.push(request); return { content: answer } } }) as unknown as AIAdapter
try {
  const unchanged = JSON.stringify(prompt)
  await generate(prompt, null)
  assert.equal(JSON.stringify(prompt), unchanged)
  for (const char of chars) assert(requests[0]!.messages[0]!.content.includes(`${char.name}独有的身份结尾`), 'full cards must survive the actual adapter boundary')
  assert(requests[0]!.messages.some(m => m.content.includes('阿白收好了雨伞')), 'completed actions at the end of a long paragraph must reach the API')
  requests = []
  await generateStoryReply({ messages: prompt, preset: null, mode: 'offline', charsMin: 80, charsMax: 200 })
  assert.equal(requests.length, 1, 'a normal reply need not be split into forced tiny continuations')
  assert(requests[0]!.maxTokens! >= 2048)
  const previous = '已经走进餐厅并坐在靠窗的位置，服务员已经递上菜单。'
  assert.equal(mergeStoryContinuation(previous, previous), previous)
  const overlap = '已经走进餐厅并坐在靠窗的位置，服务员已经递上菜单，阿白接过菜单。'
  assert.equal(mergeStoryContinuation(overlap, '服务员已经递上菜单，阿白接过菜单。阿墨开始看饮品。'), `${overlap}阿墨开始看饮品。`)
  for (const char of chars) await storage.putCharacter(ns, char)
  await saveConfig(ns, { ...DEFAULT_CONFIG, autoSummary: false, replyCharsMin: 80, replyCharsMax: 200 })
  await writeWorld(ns, [a, b, c].map(char => ({ id: char.id, charId: char.id, title: char.name, content: `${char.name}专属世界书`, keys: '', enabled: true, updatedAt: 1 })))
  const save = await putSave(ns, newSave('双人现场', { lines: [{ id: 'bc', role: 'user', content: '继续', createdAt: 1, participantIds: ['b', 'c'] }] }))
  requests = []
  await runStoryGeneration({ namespace: ns, saveId: save.id, mode: 'offline', identity, presetId: '', presets: [] })
  assert(requests[0]!.messages[0]!.content.includes('阿墨专属世界书'))
  assert(requests[0]!.messages[0]!.content.includes('阿白专属世界书'))
  assert(!requests[0]!.messages[0]!.content.includes('阿青专属世界书'))
  answer = '阿青已经付款，阿白的约定尚未完成。'
  await writeSummary(cast, 'small', 12)
  assert(requests.at(-1)!.messages[0]!.content.includes('已完成事件'))
} finally { AIAdapter.fromStored = original }
console.log('Story continuity checks passed: cast persistence, alias isolation, complete cards at API boundary, scene endings, summaries, worldbook ownership and continuation deduplication')
