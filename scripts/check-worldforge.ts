import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { AIAdapter } from '../src/engine/AIAdapter.ts'
import { makeCard } from '../src/lib/cardMaker.ts'
import { applyForgeResult, forgeWithReferences, forgeWorldFromCard, forgeWorldFromDocument, forgeWorldFromProse, reviseForgeResult } from '../src/lib/worldForge.ts'
import { requestForgeOutput, validateForgeOutput } from '../src/lib/worldForgeFormat.ts'
import { storage } from '../src/storage/StorageService.ts'
import type { AIRequest, Character, Identity } from '../src/types/index.ts'

const character = {
  name: '夜班医生', description: '在雨城医院值夜班，随身带着一本记录旧城病例的笔记。',
  personality: '耐心谨慎', scenario: '雨城的夜间急诊', firstMes: '哪里不舒服？',
  mesExample: '', systemPrompt: '不要替玩家发言', tags: ['雨城'],
}
const valid = { worldTitle: '雨城', worldSummary: '三年不能说出自己的名字。', worldEntries: [], characters: [character] }
const worldOnly = { ...valid, worldSummary: '旧城区的人把这里叫作“雨城”。', characters: [] }
validateForgeOutput(valid)
validateForgeOutput(worldOnly)
assert.throws(() => validateForgeOutput({ ...worldOnly, worldSummary: '' }), /没有生成任何世界设定或角色/)
assert.deepEqual(await requestForgeOutput(async () => `整理结果如下：\n${JSON.stringify(worldOnly)}`), worldOnly)
assert.deepEqual(await requestForgeOutput(async () => JSON.stringify(JSON.stringify(valid))), valid)
validateForgeOutput({ characters: [character] }, [character.name])
for (const raw of [null, [], '角色卡正文', { ...valid, characters: ['姓名：医生'] },
  { ...valid, characters: [JSON.stringify(character)] },
  { ...valid, characters: [{ ...character, firstMes: null }] },
  { ...valid, characters: [character, character] },
  { ...valid, worldEntries: [{ title: '规则', keys: ['雨城'], content: '规则' }] }]) {
  assert.throws(() => validateForgeOutput(raw))
}
assert.throws(() => validateForgeOutput(valid, ['夜班医生', '书店老板']), /全部角色/)
let attempts = 0
const retried = await requestForgeOutput(async correction => {
  attempts++
  if (attempts === 1) return '姓名：夜班医生\n性格：耐心谨慎'
  assert.match(correction, /上次输出未通过校验/)
  return JSON.stringify(valid)
})
assert.deepEqual(retried, valid)
assert.equal(attempts, 2)
attempts = 0
await assert.rejects(requestForgeOutput(async () => { attempts++; return '{"characters":[' }), /模型回复中没有可解析的 JSON/)
assert.equal(attempts, 2)
await assert.rejects(requestForgeOutput(async () => '  '), /模型没有返回正文/)
attempts = 0
await assert.rejects(requestForgeOutput(async () => { attempts++; throw new Error('网络断开') }), /网络断开/)
assert.equal(attempts, 1)

// Exercise the public prose path: errors must not be replaced by card-parser errors.
const original = AIAdapter.fromStored
await storage.boot()
try {
  AIAdapter.fromStored = async () => ({ complete: async () => ({ content: '非 JSON 人物介绍' }) }) as unknown as AIAdapter
  await assert.rejects(forgeWorldFromProse('雨城有一位夜班医生，请搭建完整世界。'), /世界搭建输出格式不符合要求/)
  const fallback = await forgeWorldFromCard([
    { name: character.name, description: character.description, personality: character.personality, scenario: '雨城' },
    { name: '书店老板', description: '守着旧书店', scenario: '雨城' },
  ])
  assert.equal(fallback.local, true)
  assert.equal(fallback.characters[0].draft.description, character.description)
  assert.equal(fallback.characters[0].note, '保留原文设定')
  const identity = { name: '江澜', persona: '曾在雨城开过一家旧书店' }
  AIAdapter.fromStored = async () => ({ complete: async (request: AIRequest) => {
    assert.match(request.messages.at(-1)!.content, /江澜.*曾在雨城开过一家旧书店/)
    return { content: JSON.stringify(valid) }
  } }) as unknown as AIAdapter
  const result = await forgeWorldFromProse('雨城有一位夜班医生，请搭建完整世界。', identity)
  assert.equal(result.characters[0].draft.name, character.name)
  assert.equal(result.characters[0].draft.firstMes, character.firstMes)

  AIAdapter.fromStored = async () => ({ complete: async () => ({
    content: `整理结果如下：\n${JSON.stringify(worldOnly)}`,
  }) }) as unknown as AIAdapter
  const setting = await forgeWorldFromProse('旧城区的人把这里叫作雨城，三年不能说出自己的名字。')
  assert.equal(setting.worldSummary, worldOnly.worldSummary)
  assert.deepEqual(setting.characters, [])
  const imported = await applyForgeResult({ namespace: 'worldforge-check' } as Identity, setting)
  assert.equal(imported.world[0]?.content, worldOnly.worldSummary)
  assert.deepEqual(imported.characters, [])
  const entries = [{ title: '城门', keys: '城门', content: '落日闭门。' }, { title: '河道', keys: '渡口', content: '黎明开船。' }]
  const multiple = await applyForgeResult({ namespace: 'worldforge-check' } as Identity, { ...setting, worldEntries: entries })
  assert.deepEqual(multiple.world.map(({ title, keys, content }) => ({ title, keys, content })), [
    { title: '雨城 · 世界观', keys: '雨城', content: worldOnly.worldSummary },
    ...entries,
  ])
  assert.equal(new Set(multiple.world.map(item => item.id)).size, 3)
  AIAdapter.fromStored = async () => ({ complete: async (request: AIRequest) => {
    const prompt = request.messages.at(-1)!.content
    assert.match(prompt, /周渡守着旧渡口/)
    assert.match(prompt, /改为清晨开船|雨城的河道设定/)
    return { content: JSON.stringify({ ...worldOnly, worldEntries: entries }) }
  } }) as unknown as AIAdapter
  assert.deepEqual((await forgeWithReferences('雨城的河道设定', '周渡守着旧渡口')).worldEntries, entries)
  assert.deepEqual((await reviseForgeResult(setting, '改为清晨开船', undefined, '周渡守着旧渡口')).worldEntries, entries)

  const longSource = '【人物：夜班医生】在雨城医院值夜班。\n' + '雨城的街道在夜晚落雨。'.repeat(4200) + '\n【人物：席淮】在四万字之后经营城南旧书店。'
  const longCalls: AIRequest[] = []
  AIAdapter.fromStored = async () => ({ complete: async (request: AIRequest) => {
    longCalls.push(request)
    const system = request.messages[0]!.content
    const input = request.messages.at(-1)!.content
    assert.doesNotMatch(input, /后文已截/)
    if (system.includes('只提取原文')) {
      assert.doesNotMatch(input, /参考人物不要导入/)
      return { content: JSON.stringify({ names: [...input.matchAll(/【人物：([^】]+)】/g)].map(match => match[1]) }) }
    }
    if (system.includes('只整理本段世界设定')) return { content: JSON.stringify(worldOnly) }
    const names = JSON.parse(input.split('【本批人物名单】')[1]!) as string[]
    return { content: JSON.stringify({ characters: names.map(name => ({ ...character, name, description: name === '席淮' ? '在四万字之后经营城南旧书店。' : character.description })) }) }
  } }) as unknown as AIAdapter
  for (const build of [() => forgeWorldFromProse(longSource), () => forgeWorldFromDocument(longSource, '参考人物不要导入'), () => forgeWithReferences(longSource, '参考人物不要导入')]) {
    const long = await build()
    assert.deepEqual(long.characters.map(item => item.draft.name), ['夜班医生', '席淮'])
    assert.match(long.characters[1]!.draft.description, /四万字之后/)
    assert.ok(long.worldSummary)
  }
  assert.ok(longCalls.some(call => call.messages.at(-1)!.content.includes('四万字之后')))
  AIAdapter.fromStored = async () => ({ complete: async (request: AIRequest) => ({ content: JSON.stringify(
    request.messages[0]!.content.includes('只提取原文') ? { names: ['夜班医生'] } : worldOnly,
  ) }) }) as unknown as AIAdapter
  await assert.rejects(forgeWorldFromProse(longSource), /全部角色/)

  const requests: AIRequest[] = []
  const longDescription = '席淮总把那本未寄出的信藏在抽屉里。'.repeat(300)
  AIAdapter.fromStored = async () => ({ complete: async (request: AIRequest) => {
    requests.push(request)
    return { content: requests.length === 1 ? '{"name":"席淮","description":"未写完' : JSON.stringify({ name: '席淮', description: longDescription }) }
  } }) as unknown as AIAdapter
  const cardInput = { wish: '精修席淮人设，不少于4000字', depth: '标准', world: [], identity,
    source: { name: '席淮', description: '已有设定：替江澜保管旧书店钥匙' } as Character }
  await assert.rejects(makeCard(cardInput), /原草稿仍在/)
  assert.equal(requests.length, 1, 'invalid card output must not trigger automatic regeneration')
  const made = await makeCard(cardInput)
  assert.equal(made.description, longDescription)
  assert.equal(requests.length, 2, 'only a manual call requests another card')
  for (const request of requests) {
    const prompt = request.messages.at(-1)!.content
    assert.match(prompt, /曾在雨城开过一家旧书店/)
    assert.match(prompt, /替江澜保管旧书店钥匙/)
    assert.match(prompt, /不少于4000字/)
  }

  const draft = {
    avatar: '', mesExample: '', creatorNotes: '', systemPrompt: '不要替玩家发言', postHistoryInstructions: '',
    alternateGreetings: [] as string[], creator: 'worldforge', characterVersion: '1.0.0', characterBook: null, extensions: {}, rawCard: null,
  }
  const forged = (description: string, name = character.name) => ({
    worldTitle: '雨城', worldSummary: worldOnly.worldSummary, worldEntries: [],
    characters: [{ draft: { ...character, ...draft, name, description, tags: ['雨城'] }, note: '测试' }],
  })
  const ns = 'worldforge-update'
  const first = await applyForgeResult({ namespace: ns } as Identity, forged('旧设定：夜班医生随身带着笔记。'))
  assert.equal(first.created, 1)
  assert.equal(first.updated, 0)
  const originalId = first.characters[0]!.id
  const chat = (await storage.listChats(ns)).find(item => item.memberIds.includes(originalId))
  assert.ok(chat)
  await storage.putMessage(ns, {
    id: 'msg-keep', chatId: chat.id, role: 'user', kind: 'text', content: '昨晚没睡。', charId: null, createdAt: Date.now(), status: 'sent',
  })
  await storage.putCharacter(ns, { ...first.characters[0]!, avatar: 'avatar-keep', signature: '还在值班', voiceId: 'voice-keep' })
  await storage.putCharacter(ns, {
    ...first.characters[0]!, id: 'char-old-world', name: character.name, description: '旧世里的另一位夜班医生',
    tags: ['旧世', '古风'], extensions: { jiushi: { importedAt: 1 } }, createdAt: 1,
  })
  const second = await applyForgeResult({ namespace: ns } as Identity, forged('新设定：夜班医生改去城南坐诊。'))
  assert.equal(second.created, 0)
  assert.equal(second.updated, 1)
  assert.equal(second.characters[0]!.id, originalId)
  assert.equal(second.characters[0]!.description, '新设定：夜班医生改去城南坐诊。')
  assert.equal(second.characters[0]!.avatar, 'avatar-keep')
  assert.equal(second.characters[0]!.signature, '还在值班')
  assert.equal(second.characters[0]!.voiceId, 'voice-keep')
  const people = await storage.listCharacters(ns)
  assert.equal(people.filter(person => person.name === character.name).length, 2)
  assert.equal(people.find(person => person.id === 'char-old-world')?.description, '旧世里的另一位夜班医生')
  const messages = await storage.listMessages(ns, chat.id)
  assert.equal(messages.filter(item => item.content === '昨晚没睡。').length, 1)
  assert.equal(messages.filter(item => item.role === 'assistant' && item.content === character.firstMes).length, 1)
  assert.equal((await storage.listChats(ns)).filter(item => item.memberIds.includes(originalId)).length, 1)
  const renamed = await applyForgeResult({ namespace: ns } as Identity, forged('同一个人，只是名字里多了空格。', '夜班 医生'))
  assert.equal(renamed.updated, 1)
  assert.equal(renamed.characters[0]!.id, originalId)
} finally {
  AIAdapter.fromStored = original
}
console.log('World forge checks passed: schema validation, bounded format retry, network errors and public prose import')
process.exit(0)
