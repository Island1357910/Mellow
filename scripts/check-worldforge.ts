import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { AIAdapter } from '../src/engine/AIAdapter.ts'
import { forgeWorldFromCard, forgeWorldFromProse } from '../src/lib/worldForge.ts'
import { requestForgeOutput, validateForgeOutput } from '../src/lib/worldForgeFormat.ts'
import { storage } from '../src/storage/StorageService.ts'

const character = {
  name: '夜班医生', description: '在雨城医院值夜班，随身带着一本记录旧城病例的笔记。',
  personality: '耐心谨慎', scenario: '雨城的夜间急诊', firstMes: '哪里不舒服？',
  mesExample: '', systemPrompt: '不要替玩家发言', tags: ['雨城'],
}
const valid = { worldTitle: '雨城', worldSummary: '三年不能说出自己的名字。', worldEntries: [], characters: [character] }
validateForgeOutput(valid)
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
await assert.rejects(requestForgeOutput(async () => { attempts++; return '{"characters":[' }), /世界搭建输出格式不符合要求/)
assert.equal(attempts, 2)
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
  AIAdapter.fromStored = async () => ({ complete: async () => ({ content: JSON.stringify(valid) }) }) as unknown as AIAdapter
  const result = await forgeWorldFromProse('雨城有一位夜班医生，请搭建完整世界。')
  assert.equal(result.characters[0].draft.name, character.name)
  assert.equal(result.characters[0].draft.firstMes, character.firstMes)
} finally {
  AIAdapter.fromStored = original
}
console.log('World forge checks passed: schema validation, bounded format retry, network errors and public prose import')
process.exit(0)
