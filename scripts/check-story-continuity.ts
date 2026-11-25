import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseCharacterCard } from '../src/lib/sillytavern.ts'
import { presetFromUnknown } from '../src/data/officialPresets.ts'
import { saveCustomDirective, saveDirectivePicks } from '../src/lib/directives.ts'
import { modePresetId, normalizeSettings } from '../src/lib/defaults.ts'
import { defaultJiushiConfig, replyJiushiLetter } from '../src/lib/jiushi.ts'
import { jiushiWorldNs } from '../src/lib/jiushiPhone.ts'
import { pickPreset } from '../src/engine/prompt.ts'
import { storage } from '../src/storage/StorageService.ts'
import { AIAdapter, AIError } from '../src/engine/AIAdapter.ts'
import { buildStoryPrompt, cardRegex, DEFAULT_CONFIG, DEFAULT_READING, editStoryLine, ensureStoryBreaks, focusChars, frameDoc, generate, generateStoryReply, htmlBody, loadSave, mergeStoryContinuation, newSave, normalizeStoryParagraphs, putSave, saveConfig, STATUS_EXAMPLE, storyDisplayParts, writeSummary } from '../src/engine/story.ts'
import { runStoryGeneration } from '../src/domain/storyRunner.ts'
import { castIdsFromModel, castTranscript, readSceneReply } from '../src/lib/offlineCast.ts'
import { readWorld, storyWorldText, writeWorld } from '../src/lib/worldbook.ts'
import type { AIMessage, Character } from '../src/types/index.ts'

const snap = await storage.boot(), identity = snap.identities[0]!, ns = identity.namespace
const customPreset = presetFromUnknown({ id: 'test-long-preset', name: '长预设', prompts: [
  { identifier: 'paste', content: '场景写法'.repeat(600) },
  { identifier: 'ending', content: '预设结尾：{{char}}给{{user}}留下回话机会。' },
  { identifier: 'off', content: '不应发送的预设测试标记', enabled: false },
] })!
const fallbackSettings = normalizeSettings({ activePresetId: customPreset.id, modePresets: { ...snap.settings.modePresets, side: '' } })
assert.equal(modePresetId(fallbackSettings, 'side'), customPreset.id)
assert.equal(pickPreset([customPreset], customPreset.id, '旧角色预设', '已删除聊天预设'), customPreset)
const person = (id: string, name: string): Character => ({ id, name, nickname: '', remark: '', avatar: '', description: '背景'.repeat(600) + `${name}独有的身份结尾`, personality: '性格'.repeat(300) + `${name}独有的性格结尾`, scenario: '初次见面', mesExample: '', systemPrompt: `${name}本人指令`, postHistoryInstructions: `${name}后置设定`, tags: [], extensions: {}, createdAt: 1, updatedAt: 1 } as Character)
const a = person('a', '阿青'), b = person('b', '阿墨'), c = person('c', '阿白'), chars = [a, b, c]
const cast = newSave('三人', { lines: [
  { id: 'u', role: 'user', content: '我们坐下来', createdAt: 1, participantIds: ['a', 'b', 'c'] },
  { id: 'a', role: 'assistant', content: '前段细节。'.repeat(200) + '三人已经吃完饭，阿墨已经付款，阿白收好了雨伞。', createdAt: 2, participantIds: ['a', 'b', 'c'] },
  { id: 'u2', role: 'user', content: '我对阿青点头', createdAt: 3 },
] })
assert.deepEqual(focusChars(chars, cast).map(p => p.id), ['a', 'b', 'c'], 'addressing one person cannot remove the rest of the cast')
const editTarget = { ...cast, summaries: [
  { id: 'before', kind: 'small' as const, text: '先前约在茶馆会面。', upTo: 1, createdAt: 1 },
  { id: 'covers-edit', kind: 'big' as const, text: '阿墨已经付款。', upTo: 2, createdAt: 2 },
] }
const revisedText = '阿墨收起钱袋。\n\n“这回由我请客。”'
const revised = editStoryLine(editTarget, 'a', revisedText)
assert.equal(revised.lines[1]!.content, revisedText)
assert.equal(revised.lines[1]!.role, 'assistant')
assert.equal(revised.lines[1]!.createdAt, editTarget.lines[1]!.createdAt)
assert.deepEqual(revised.summaries.map(summary => summary.id), ['before'])
assert.throws(() => editStoryLine(editTarget, 'a', '  \n '), /不能为空/)
const revisedSave = await putSave(ns, revised)
const reloaded = (await loadSave(ns, revisedSave.id))!
const revisedPrompt = buildStoryPrompt({ mode: 'jiushi', save: reloaded, chars: [b], identity, preset: null, config: DEFAULT_CONFIG })
assert(revisedPrompt.some(message => message.role === 'assistant' && message.content.includes('这回由我请客。')))
assert(!revisedPrompt.some(message => message.content.includes('阿墨已经付款。')))
const onlyA = { ...cast, lines: [{ ...cast.lines[0]!, participantIds: ['a'] }, { id: 'mention', role: 'user' as const, content: '我和阿青聊起阿墨，想起阿白', createdAt: 4 }] }
assert.deepEqual(focusChars(chars, onlyA).map(p => p.id), ['a'], 'references do not make people enter')
assert.deepEqual(focusChars(chars, onlyA, '去找阿墨').map(p => p.id), ['b'], 'explicit scene changes replace the cast')
assert.deepEqual(focusChars(chars, onlyA, '阿青走了，只剩阿墨').map(p => p.id), ['b'], 'departed people do not remain in the cast')
assert.deepEqual(focusChars(chars, newSave('称呼'), '“阿墨，你好。”').map(p => p.id), ['b'], 'directly addressing someone in quotes still resolves the character')
assert.deepEqual(focusChars(chars, { ...cast, lines: [{ ...cast.lines[0]!, participantIds: [] }] }), [], 'an explicitly empty cast does not revive old people')
const short = person('short', '张三'), long = person('long', '张三丰')
assert.deepEqual(focusChars([short, long], newSave('同名', { lines: [{ id: 'n', role: 'user', content: '去找张三丰', createdAt: 1 }] })).map(p => p.id), ['long'])
assert.deepEqual(focusChars([{ ...a, nickname: '小猫' }, { ...b, nickname: '小猫' }], newSave('歧义', { lines: [{ id: 'n', role: 'user', content: '找小猫', createdAt: 1 }] })), [], 'ambiguous aliases must not pick both people')
const ver = person('ver', '阿墨2.0')
assert.deepEqual(focusChars([ver], newSave('版本', { lines: [{ id: 'n', role: 'user', content: '去找阿墨', createdAt: 1 }] })).map(p => p.id), ['ver'], 'a version suffix is not part of the spoken name')
assert.deepEqual(focusChars([b, ver], newSave('两个阿墨', { lines: [{ id: 'n', role: 'user', content: '去找阿墨', createdAt: 1 }] })).map(p => p.id), ['b'], 'an exact card name wins when the spoken name is shared')
assert.deepEqual(focusChars([a, ver], newSave('叙述加人', { lines: [
  { id: 'u', role: 'user', content: '我和阿青在门口', createdAt: 1, participantIds: ['a'] },
  { id: 'n', role: 'assistant', content: '阿墨把伞靠在门边，没有说话。', createdAt: 2 },
]})).map(p => p.id), ['a', 'ver'], 'someone acting in the narration joins the cast')
assert.deepEqual(focusChars([a, ver], newSave('叙述提起', { lines: [
  { id: 'u', role: 'user', content: '我和阿青在门口', createdAt: 1, participantIds: ['a'] },
  { id: 'n', role: 'assistant', content: '阿青想起阿墨，没有把那句话说完。', createdAt: 2 },
]})).map(p => p.id), ['a'], 'a recalled person does not enter from narration')
assert.deepEqual(focusChars([a, ver], newSave('叙述离开', { lines: [
  { id: 'u', role: 'user', content: '一起走', createdAt: 1, participantIds: ['a', 'ver'] },
  { id: 'n', role: 'assistant', content: '阿墨离开了，阿青还站在门边。', createdAt: 2 },
]})).map(p => p.id), ['a'], 'a versioned card leaves when the spoken name leaves')
assert.deepEqual(castIdsFromModel('{"ids":["阿墨"]}', [ver]), ['ver'], 'model names resolve through the version suffix')
assert.deepEqual(castIdsFromModel('{"ids":["ver"]}', [ver]), ['ver'])
assert.equal(castIdsFromModel('不是json', [ver]), null)
assert.deepEqual(castIdsFromModel('{"ids":["没有这个人"]}', [ver]), null, 'unresolved names fall back instead of clearing the cast')
const longScene = newSave('长场面', { lines: [{ id: 'tail', role: 'assistant', content: '铺垫'.repeat(500) + '阿白推门进来了', createdAt: 1 }] })
assert(castTranscript(longScene).includes('阿白推门进来了'), 'the end of a long scene is what gets recognized')
assert(!castTranscript(longScene).includes('铺垫'.repeat(400)))
const prompt = buildStoryPrompt({ mode: 'offline', save: { ...cast, summaries: [{ id: 'summary', kind: 'small', text: '旧事'.repeat(600) + '最新约定尚未完成', upTo: 1, createdAt: 1 }] }, chars, identity, preset: null, config: DEFAULT_CONFIG })
for (const char of chars) {
  assert(prompt[0]!.content.includes(`${char.name}独有的身份结尾`))
  assert(prompt[0]!.content.includes(`${char.name}独有的性格结尾`))
  assert(!prompt[0]!.content.includes(`${char.name}本人指令`), 'card control instructions are opt-in')
  assert(!prompt[0]!.content.includes(`${char.name}后置设定`))
}
const expanded = buildStoryPrompt({ mode: 'offline', save: cast, chars, identity, preset: null, config: { ...DEFAULT_CONFIG, includeCardExtras: true } })
for (const char of chars) assert(expanded[0]!.content.includes(`${char.name}本人指令`) && expanded[0]!.content.includes(`${char.name}后置设定`))
for (const [slug, marker] of [['lanyuzhou', '<蓝与舟状态>'], ['luhuaiyuan', '[EndWorkMemo]']]) {
  const draft = parseCharacterCard(JSON.parse(readFileSync(new URL(`../cardlib/cards/${slug}/card.json`, import.meta.url), 'utf8')))
  const fixed = { ...a, ...draft }
  const fixedSave = newSave('固定角色', { charId: fixed.id, bookCharIds: [], lines: [{ id: 'fixed', role: 'user', content: '继续', createdAt: 1, participantIds: [fixed.id] }] })
  for (const mode of ['side', 'jiushi', 'offline'] as const) {
    const input = { mode, save: fixedSave, chars: [fixed], identity, preset: null, config: DEFAULT_CONFIG }
    const request = buildStoryPrompt(input)[0]!.content
    assert(request.includes(marker), `${slug} status format reaches the model in ${mode}`)
    assert(!request.includes('不要输出状态栏'))
    assert(!buildStoryPrompt({ ...input, config: { ...DEFAULT_CONFIG, useCardRegex: false } })[0]!.content.includes(`【${fixed.name}的状态栏格式】`))
  }
}
const oldHistory = newSave('旧记录', { lines: Array.from({ length: 40 }, (_, i) => ({ id: `history-${i}`, role: i % 2 ? 'assistant' as const : 'user' as const, content: i < 36 ? '不应超出窗口的旧原文' : `最新剧情${i}`, createdAt: i, participantIds: ['a'] })) })
const bounded = buildStoryPrompt({ mode: 'offline', save: oldHistory, chars, identity, preset: null, config: { ...DEFAULT_CONFIG, keepRounds: 2 } })
assert.equal(bounded.length, 5, 'keepRounds applies before summaries exist too')
const wall = '他走进房间，把伞靠在门边。'.repeat(6)
assert.equal(ensureStoryBreaks(wall), Array.from({ length: 6 }, () => '他走进房间，把伞靠在门边。').join('\n'))
assert.equal(ensureStoryBreaks('短句。'), '短句。')
assert.equal(htmlBody('<span>上一句</span>\n<span>下一句</span>'), '<span>上一句</span>\n<span>下一句</span>')
const yinzhenya = parseCharacterCard(JSON.parse(readFileSync(new URL('../cardlib/cards/yinzhenya/card.json', import.meta.url), 'utf8')))
const oldWorldReply = [
  '他抬眼望向长街。\n\n茶馆里正说到热闹处。',
  '---',
  '[殷枕崖状态]\n日期时间：永宁三年 · 春 · 未时二刻\n地点天气：茶馆 · 春日融融\n安全感：60%\n警惕心：50%\n欲望值：5%\n好感度：38%\n内心想法：且看她如何作答。\n判词：且纵雀片刻',
].join('\n\n')
const yinzhenyaRules = cardRegex({ ...a, ...yinzhenya })
const defaultOldWorldParts = storyDisplayParts(oldWorldReply, yinzhenyaRules, 'assistant')
assert.deepEqual(defaultOldWorldParts.map(part => part.card), [false, true])
assert.equal(defaultOldWorldParts[0]!.text, '他抬眼望向长街。\n\n茶馆里正说到热闹处。')
const oldWorldParts = storyDisplayParts(oldWorldReply, yinzhenyaRules.map(rule => rule.name === '全局美化' ? { ...rule, enabled: true } : rule), 'assistant')
assert.deepEqual(oldWorldParts.map(part => part.card), [false, true])
assert.match(oldWorldParts[0]!.text, /浮生若梦/)
assert.doesNotMatch(oldWorldParts[0]!.text, /---|日期时间|\x60\x60\x60/)
const statusFrame = frameDoc('status', oldWorldParts[1]!.text, DEFAULT_READING, '#3a3a3a')
assert.equal(statusFrame.match(/<!doctype html>/gi)?.length, 1)
assert.match(statusFrame, /\.zhenya-status-card[\s\S]*<\/head><body>/)
assert.match(statusFrame, /永宁三年 · 春 · 未时二刻/)
assert.match(statusFrame, /且纵雀片刻/)
assert.doesNotMatch(statusFrame, /<br>/)
assert.equal(htmlBody('<div>\n  <p>第一段\n\n第二段</p>\n</div>'), '<div>\n  <p>第一段<br><br>第二段</p>\n</div>')
const preformatted = '<!-- 装饰\n注释 --><pre>一\n  二</pre><script>if (1 < 2) {\n  console.log("卡片")\n}</script>'
assert.equal(htmlBody(preformatted), preformatted)
assert.equal(htmlBody('<details title="1 > 0">\n  <summary>展开</summary>\n</details>'), '<details title="1 > 0">\n  <summary>展开</summary>\n</details>')
const inlineStatusRule = { ...STATUS_EXAMPLE.rule, id: 'example', enabled: true }
const mixedParts = storyDisplayParts('前文\n---\n<status>春|茶馆|许知知|好奇</status>\n后文\n~~~html\n<details><summary>手札</summary>正文</details>\n~~~\n尾声', [inlineStatusRule], 'assistant')
assert.deepEqual(mixedParts.map(part => part.card), [false, true, false, true, false])
assert.deepEqual(mixedParts.filter(part => !part.card).map(part => part.text.trim()), ['前文', '后文', '尾声'])
assert.match(mixedParts[1]!.text, /茶馆/)
const luhuaiyuan = parseCharacterCard(JSON.parse(readFileSync(new URL('../cardlib/cards/luhuaiyuan/card.json', import.meta.url), 'utf8')))
const workStatus = '<status>[Date]周一[Time]午后[Season]春[Weather]晴[Outfit]便装[Action]看书[Location]家中[Thought]安静[WorkMemo]写完了[EndWorkMemo][LifeMemo]准备喝茶[EndLifeMemo][HeartVoice]休息片刻[Desire]喝茶</status>'
const workParts = storyDisplayParts(`他合上账本。\n${workStatus}\n他去倒茶。`, cardRegex({ ...a, ...luhuaiyuan }), 'assistant')
assert.deepEqual(workParts.map(part => part.card), [false, true, false])
assert.match(workParts[1]!.text, /<details[\s\S]*准备喝茶/)
const templateRule = { ...inlineStatusRule, roles: 'all' as const, find: '手札', replace: '```html\n<article>手札内容</article>\n```' }
assert.deepEqual(storyDisplayParts('前文手札后文', [templateRule], 'user').map(part => part.text.trim()), ['前文', '<article>手札内容</article>', '后文'])
const fullDocument = '<html lang="zh-CN"><head><title>手札</title></head><body class="paper"><main>手札内容</main></body></html>'
assert.deepEqual(storyDisplayParts('前文\n' + fullDocument + '\n后文', [], 'assistant').map(part => part.card), [false, true, false])
assert.match(frameDoc('journal', fullDocument, DEFAULT_READING, '#333'), /<html lang="zh-CN">[\s\S]*<title>手札<\/title><\/head><body class="paper">/)
assert(!bounded.some(row => row.content.includes('不应超出窗口的旧原文')))
assert.equal(oldHistory.lines.length, 40, 'limiting transmitted history never deletes saved history')
assert(prompt[0]!.content.includes('最新约定尚未完成'))
assert(prompt.some(m => m.content.includes('阿白收好了雨伞')))
const original = AIAdapter.fromStored
let requests: Array<{ messages: AIMessage[]; maxTokens?: number }> = []
let answer = '三人走到门外，阿墨撑开伞，阿白在旁等候。'.repeat(5)
let continuationFailure: 'empty' | 'timeout' | undefined
let holdStoryReply: ((signal?: AbortSignal) => Promise<void>) | undefined
let interruptedReply = false
AIAdapter.fromStored = async () => ({ complete: async (request: { messages: AIMessage[]; maxTokens?: number; signal?: AbortSignal }) => {
  requests.push(request)
  const system = request.messages[0]?.content ?? ''
  if (system.includes('谁此刻在现场')) {
    throw new Error('Scene recognition must not create an extra model request')
  }
  if (request.messages.at(-1)?.content.startsWith('请紧接上一段末尾自然续写')) {
    if (continuationFailure === 'timeout') throw new Error('补写超时')
    if (continuationFailure === 'empty') return { content: '', reasoning: '只有思考内容' }
  }
  if (holdStoryReply) await holdStoryReply(request.signal)
  return { content: answer, reasoning: '测试思维记录', interrupted: interruptedReply }
} }) as unknown as AIAdapter
try {
  const unchanged = JSON.stringify(prompt)
  await generate(prompt, null)
  assert.equal(JSON.stringify(prompt), unchanged)
  for (const char of chars) assert(requests[0]!.messages[0]!.content.includes(`${char.name}独有的身份结尾`), 'full cards must survive the actual adapter boundary')
  assert(requests[0]!.messages.some(m => m.content.includes('阿白收好了雨伞')), 'completed actions at the end of a long paragraph must reach the API')
  requests = []
  const reply = await generateStoryReply({ messages: prompt, preset: null, mode: 'offline', charsMin: 80, charsMax: 200 })
  assert.equal(requests.length, 1, 'a normal reply need not be split into forced tiny continuations')
  assert.equal(reply.content, Array.from({ length: 5 }, () => '三人走到门外，阿墨撑开伞，阿白在旁等候。').join('\n\n'))
  assert.equal(normalizeStoryParagraphs('第一段\r\n\r\n第二段\n第三段\n  \n\n第四段'), '第一段\n\n第二段\n\n第三段\n\n第四段')
  assert.equal(normalizeStoryParagraphs('<p>第一段</p>\n<p>第二段</p>'), '<p>第一段</p>\n<p>第二段</p>')
  assert(requests[0]!.maxTokens! >= 2048)
  const fullAnswer = answer
  for (const mode of ['offline', 'side', 'jiushi'] as const) {
    requests = []
    answer = '他放下茶盏。\n<status>午后|茶室|他|平静</status>'
    const combined = await generateStoryReply({ messages: prompt, preset: null, mode, charsMin: 2000, charsMax: 3000 })
    assert.equal(requests.length, 1, 'short narrative and status must stay in one generation without word-count retries')
    assert.match(combined.content, /他放下茶盏。[\s\S]*<status>午后\|茶室\|他\|平静<\/status>/)
  }
  answer = '殷枕崖放下茶盏。'
  for (const [mode, failure] of [['jiushi', 'empty'], ['side', 'timeout'], ['offline', 'empty']] as const) {
    continuationFailure = failure
    const partial = await generateStoryReply({ messages: prompt, preset: null, mode, charsMin: 80, charsMax: 200 })
    assert.equal(partial.content, answer, `已有正文在 ${mode} 补写失败时仍可用`)
  }
  continuationFailure = undefined
  answer = '<think>只有思考内容</think>'
  await assert.rejects(generateStoryReply({ messages: prompt, preset: null, mode: 'jiushi', charsMin: 80, charsMax: 200 }), /没有剧情正文/)
  answer = fullAnswer
  const previous = '已经走进餐厅并坐在靠窗的位置，服务员已经递上菜单。'
  assert.equal(mergeStoryContinuation(previous, previous), previous)
  const overlap = '已经走进餐厅并坐在靠窗的位置，服务员已经递上菜单，阿白接过菜单。'
  assert.equal(mergeStoryContinuation(overlap, '服务员已经递上菜单，阿白接过菜单。阿墨开始看饮品。'), `${overlap}阿墨开始看饮品。`)
  for (const char of chars) await storage.putCharacter(ns, char)
  await saveConfig(ns, { ...DEFAULT_CONFIG, autoSummary: false, replyCharsMin: 80, replyCharsMax: 200 })
  await writeWorld(ns, [a, b, c].map(char => ({ id: char.id, charId: char.id, title: char.name, content: `${char.name}专属世界书`, keys: '', enabled: true, updatedAt: 1 })))
  const save = await putSave(ns, newSave('双人现场', { lines: [{ id: 'bc', role: 'user', content: '继续', createdAt: 1, participantIds: ['b', 'c'] }] }))
  await storage.setBag(ns, 'deliveries', [
    { id: 'tea', shop: 'flash', items: [{ name: '桂花乌龙', qty: 2, price: 8 }], recipient: 'b', recipientName: '阿墨', told: false, createdAt: 1, arrivesAt: 2, note: '少糖' },
    { id: 'secret', shop: 'duotao', items: [{ name: '藏起来的围巾', qty: 1, price: 8 }], recipient: 'b', recipientName: '阿墨', told: false, createdAt: 1, arrivesAt: Date.now() + 60_000, note: '' },
    { id: 'other', shop: 'duotao', items: [{ name: '阿青的杯子', qty: 1, price: 8 }], recipient: 'a', recipientName: '阿青', told: true, createdAt: 1, arrivesAt: 2, note: '' },
  ])
  requests = []
  let replySaved = false
  const job = runStoryGeneration({ namespace: ns, saveId: save.id, mode: 'offline', identity, presetId: customPreset.id, presets: [customPreset], onReplySaved: () => {
    replySaved = true
  } })
  try {
    for (let i = 0; i < 100 && !replySaved; i++) await new Promise(resolve => setTimeout(resolve, 10))
    const storedReply = (await loadSave(ns, save.id))?.lines.at(-1)
    assert(replySaved, 'the reply is saved without waiting for another model request')
    assert.equal(storedReply?.role, 'assistant')
    assert.equal(storedReply?.content, reply.content)
  } finally {
    await job
  }
  assert.equal(requests.length, 1, 'the full offline flow must use one request, including scene membership and status')
  const mainRequests = requests
  const joined = '他放下茶杯。\n<status>午后|茶室|阿白|平静</status>'
  assert.deepEqual(readSceneReply(joined + '<mellow-scene>{"ids":["c"]}</mellow-scene>', chars), { content: joined, ids: ['c'] })
  assert.deepEqual(readSceneReply(joined + '<mellow-scene>{"ids":', chars), { content: joined, ids: null })
  for (const marker of ['<mellow-scene>{"ids":["c"]}</mellow-scene>', '<mellow-scene>{"ids":[]}</mellow-scene>', '<mellow-scene>invalid</mellow-scene>']) {
    answer = joined + marker
    requests = []
    const combinedSave = await putSave(ns, newSave('同轮状态栏测试', { lines: [{ id: 'bc-joined', role: 'user', content: '继续', createdAt: 1, participantIds: ['b', 'c'] }] }))
    await runStoryGeneration({ namespace: ns, saveId: combinedSave.id, mode: 'offline', identity, presetId: '', presets: [] })
    assert.equal(requests.length, 1)
    const stored = (await loadSave(ns, combinedSave.id))!.lines.at(-1)!
    assert.equal(stored.content, normalizeStoryParagraphs(joined))
    assert.doesNotMatch(stored.content, /mellow-scene/)
    if (marker.includes('"c"')) assert.deepEqual(stored.participantIds, ['c'])
    if (marker.includes('[]')) assert.deepEqual(stored.participantIds, [])
  }
  answer = fullAnswer
  requests = mainRequests
  const storyCall = requests.find((item) => item.messages[0]?.content.includes('阿墨专属世界书'))
  assert(storyCall, 'the story request follows the cast recognition')
  assert(storyCall!.messages[0]!.content.includes('阿白专属世界书'))
  assert(storyCall!.messages[0]!.content.includes(`预设结尾：阿墨给${identity.name}留下回话机会。`))
  assert(!storyCall!.messages[0]!.content.includes('不应发送的预设测试标记'))
  assert(!storyCall!.messages[0]!.content.includes('阿青专属世界书'))
  assert.match(storyCall!.messages[0]!.content, /桂花乌龙 ×2（已送达，送礼人尚未确认）.*少糖/)
  assert.doesNotMatch(storyCall!.messages[0]!.content, /藏起来的围巾|阿青的杯子/)
  await storage.putCharacter(ns, { ...b, name: '周既' })
  const versioned = person('ver', '阿墨2.0')
  await storage.putCharacter(ns, versioned)
  const versionSave = await putSave(ns, newSave('版本卡', { lines: [{ id: 'go', role: 'user', content: '去找阿墨', createdAt: 2 }] }))
  requests = []
  await runStoryGeneration({ namespace: ns, saveId: versionSave.id, mode: 'offline', identity, presetId: '', presets: [] })
  const versionStory = requests.find((item) => item.messages.some((message) => message.content.includes('阿墨2.0独有的身份结尾')))
  assert(versionStory, 'a card named 阿墨2.0 is present when the scene says 阿墨')
  await writeWorld(ns, [{ id: 'unrelated', title: '未触发条目', charId: b.id, keys: '旅行，机场', content: '不应该自动发送的无关条目', enabled: true, updatedAt: 1 }, { id: 'related', title: '茶馆条目', charId: b.id, keys: '茶馆', content: '应该发送的相关条目', enabled: true, updatedAt: 1 }])
  const world = await storyWorldText(ns, [b], '我们在茶馆坐下')
  assert(world.includes('应该发送的相关条目'))
  assert(!world.includes('不应该自动发送的无关条目'))
  const ancient = { ...person('ancient', '顾生'), tags: ['旧世'], characterBook: { entries: [
    { name: '常驻史实', keys: ['从未提及的词'], constant: true, content: '顾生家住在北渡。' },
    { name: '关掉的人物设定', constant: true, content: '不应发出的旧世设定。' },
  ] } }
  await storage.putCharacter(ns, ancient)
  const oldWorldNs = jiushiWorldNs(ns)
  await writeWorld(ns, [
    ...await readWorld(ns),
    { id: 'old-world-import', title: '常驻史实', charId: ancient.id, cardImport: true, keys: '从未提及的词', content: '顾生家住在北渡。', enabled: true, updatedAt: 1 },
    { id: 'old-world-off', title: '关掉的人物设定', charId: ancient.id, cardImport: true, keys: '', content: '不应发出的旧世设定。', enabled: false, updatedAt: 1 },
  ])
  const directive = { id: 'old-world-directive-test', title: '旧世末尾指令', category: '自定义', text: '旧世写法'.repeat(2500) + '只让{{char}}提到松风。' }
  await saveCustomDirective(directive)
  await saveDirectivePicks(oldWorldNs, { global: [], byChar: { [ancient.id]: [directive.id] } })
  await saveConfig(oldWorldNs, { ...DEFAULT_CONFIG, autoSummary: false, replyCharsMin: 80, replyCharsMax: 200 })
  const ancientSave = await putSave(oldWorldNs, newSave('旧世测试', { charId: ancient.id }))
  requests = []
  await runStoryGeneration({ namespace: oldWorldNs, saveId: ancientSave.id, mode: 'jiushi', identity, presetId: customPreset.id, presets: [customPreset] })
  const ancientSystem = requests[0]!.messages[0]!.content
  assert(ancientSystem.includes('预设结尾：顾生给无名旅人留下回话机会。'))
  assert(ancientSystem.includes('只让顾生提到松风。'))
  assert(ancientSystem.includes('顾生家住在北渡。'))
  assert(!ancientSystem.includes('不应发出的旧世设定。'))
  assert.equal((await readWorld(oldWorldNs)).filter(row => row.id === 'old-world-import').length, 1)
  await storage.savePreset(customPreset)
  await storage.saveSettings({ ...fallbackSettings, modePresets: { ...fallbackSettings.modePresets, jiushi: customPreset.id } })
  answer = '{"letter":"见字如晤。"}'
  await replyJiushiLetter({ namespace: ns, character: ancient, config: { ...defaultJiushiConfig(), roleName: '来信人' }, userText: '可有新消息？' })
  const letterSystem = requests.at(-1)!.messages[0]!.content
  assert(letterSystem.includes('预设结尾：顾生给来信人留下回话机会。'))
  assert(letterSystem.includes('顾生后置设定'))
  assert(letterSystem.includes('只让顾生提到松风。'))
  assert(letterSystem.includes('顾生家住在北渡。'))
  assert(!letterSystem.includes('不应发出的旧世设定。'))
  const sideNs = ns + '__side'
  await saveConfig(sideNs, { ...DEFAULT_CONFIG, autoSummary: false, replyCharsMin: 80, replyCharsMax: 200 })
  const sideSave = await putSave(sideNs, newSave('番外测试', { charId: c.id, charIds: [c.id, a.id] }))
  answer = fullAnswer
  requests = []
  await runStoryGeneration({ namespace: sideNs, saveId: sideSave.id, mode: 'side', identity, presetId: customPreset.id, presets: [customPreset] })
  const sideSystem = requests[0]!.messages[0]!.content
  assert(sideSystem.includes(`预设结尾：阿白给${identity.name}留下回话机会。`))
  assert(sideSystem.includes('阿青后置设定'))
  assert(!sideSystem.includes('只让顾生提到松风。'))
  for (const [mode, namespace, charId] of [['offline', ns, b.id], ['side', sideNs, c.id]] as const) {
    interruptedReply = true
    answer = '连接断开前已收到的剧情。'
    const save = await putSave(namespace, newSave('断线正文测试', { charId }))
    let savedInterrupted = false
    await runStoryGeneration({
      namespace, saveId: save.id, mode, identity, presetId: '', presets: [],
      onReplySaved: value => { savedInterrupted = value },
    })
    assert.equal((await loadSave(namespace, save.id))!.lines.at(-1)?.content, answer)
    assert.equal(savedInterrupted, true)
  }
  interruptedReply = false
  answer = fullAnswer
  for (const [mode, namespace, charId] of [['offline', ns, b.id], ['side', sideNs, c.id], ['jiushi', oldWorldNs, ancient.id]] as const) {
    const player = { id: 'keep-user', role: 'user' as const, content: '我在门口等。', createdAt: 1 }
    const unfinished = await putSave(namespace, newSave('停止测试', { charId, lines: [player] }))
    const options = { namespace, saveId: unfinished.id, mode, identity, presetId: '', presets: [] }
    async function stopWhileReplying(replaceLineId?: string) {
      let entered!: () => void
      let release!: () => void
      const controller = new AbortController()
      const waiting = new Promise<void>(resolve => { release = resolve })
      const started = new Promise<void>(resolve => { entered = resolve })
      holdStoryReply = async signal => {
        assert.equal(signal, controller.signal)
        entered()
        await waiting
      }
      const stopped = runStoryGeneration({ ...options, replaceLineId, signal: controller.signal })
      await started
      controller.abort()
      release()
      await assert.rejects(stopped, { name: 'AbortError' })
      holdStoryReply = undefined
    }
    await stopWhileReplying()
    assert.deepEqual((await loadSave(namespace, unfinished.id))!.lines, [player])
    await runStoryGeneration(options)
    const retried = (await loadSave(namespace, unfinished.id))!
    assert.deepEqual(retried.lines.map(item => item.role), ['user', 'assistant'])
    assert.equal(retried.lines[0]!.id, player.id)
    assert.equal(retried.lines[1]!.reasoning, '测试思维记录')
    await stopWhileReplying(retried.lines[1]!.id)
    assert.deepEqual((await loadSave(namespace, unfinished.id))!.lines, retried.lines)
  }
  answer = '阿青已经付款，阿白的约定尚未完成。'
  await writeSummary(cast, 'small', 12)
  assert(requests.at(-1)!.messages[0]!.content.includes('已完成事件'))
} finally { AIAdapter.fromStored = original }
const fetchBefore = globalThis.fetch
try {
  const adapter = new AIAdapter({ endpoint: 'https://test.invalid/v1', model: 'test', key: 'test-only' })
  for (const [status, data] of [
    [400, { error: { message: 'request blocked by Gemini API: PROHIBITED_CONTENT', type: 'invalid_request_error' } }],
    [200, { promptFeedback: { blockReason: 'PROHIBITED_CONTENT' } }],
    [200, { choices: [{ finish_reason: 'content_filter', message: { content: '' } }] }],
  ] as const) {
    let calls = 0
    globalThis.fetch = async () => { calls++; return new Response(JSON.stringify(data), { status }) }
    await assert.rejects(adapter.complete({ messages: [{ role: 'user', content: '测试请求' }] }), error => error instanceof AIError && !error.retryable && error.message.includes('内容审核拦截'))
    assert.equal(calls, 1, 'policy blocks must not retry alternative parameters or empty-body recovery')
  }
} finally { globalThis.fetch = fetchBefore }
console.log('Story continuity checks passed: cast persistence, alias isolation, complete cards at API boundary, scene endings, summaries, worldbook ownership and continuation deduplication')
