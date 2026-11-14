import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { AIAdapter } from '../src/engine/AIAdapter.ts'
import { makeCard } from '../src/lib/cardMaker.ts'
import { applyForgeResult, forgeWithReferences, forgeWorldFromCard, forgeWorldFromProse, reviseForgeResult } from '../src/lib/worldForge.ts'
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

  const requests: AIRequest[] = []
  const longDescription = '席淮总把那本未寄出的信藏在抽屉里。'.repeat(300)
  AIAdapter.fromStored = async () => ({ complete: async (request: AIRequest) => {
    requests.push(request)
    return { content: requests.length === 1 ? '{"name":"席淮","description":"未写完' : JSON.stringify({ name: '席淮', description: longDescription }) }
  } }) as unknown as AIAdapter
  const made = await makeCard({
    wish: '精修席淮人设，不少于4000字', depth: '标准', world: [], identity,
    source: { name: '席淮', description: '已有设定：替江澜保管旧书店钥匙' } as Character,
  })
  assert.equal(made.description, longDescription)
  assert.equal(requests.length, 2)
  for (const request of requests) {
    const prompt = request.messages.at(-1)!.content
    assert.match(prompt, /曾在雨城开过一家旧书店/)
    assert.match(prompt, /替江澜保管旧书店钥匙/)
    assert.match(prompt, /不少于4000字/)
  }
  assert.match(requests[1]!.messages.at(-1)!.content, /上次结果不是完整的角色卡 JSON/)
} finally {
  AIAdapter.fromStored = original
}
console.log('World forge checks passed: schema validation, bounded format retry, network errors and public prose import')
process.exit(0)
