import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { AIAdapter } from '../src/engine/AIAdapter.ts'
import { generate, writeSummary, newSave, line } from '../src/engine/story.ts'
import { API_MODULES } from '../src/lib/apiModules.ts'
import { moduleAi } from '../src/lib/ask.ts'
import { normalizeSettings } from '../src/lib/defaults.ts'
import { storage } from '../src/storage/StorageService.ts'
import { MetaDB } from '../src/storage/db.ts'

await storage.boot()
for (const profile of await storage.listApiProfiles()) await storage.deleteApiProfile(profile.id)
const save = (id: string) => storage.saveApiProfile({ id, name: id, endpoint: `https://${id}.invalid/v1`, model: `${id}-model`, key: `${id}-test-key`, ready: true })
await save('api-one')
await save('api-two')
// Concurrent creates cannot exceed the three-profile cap.
const results = await Promise.allSettled([save('api-three'), save('api-four')])
assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
assert.equal((await storage.listApiProfiles()).length, 3)
await assert.rejects(save('api-five'), /最多保存三组/)
await save('api-two') // Existing profiles remain editable at the cap.
let settings = await storage.getSettings()
await storage.saveSettings({ ...settings, activeApiId: 'api-one' })
assert.deepEqual(normalizeSettings({}).apiModuleBindings, {})
assert.deepEqual(normalizeSettings({ apiModuleBindings: { messages: ['api-one'], unknown: 'x', star: ' api-two ' } as never }).apiModuleBindings, { star: 'api-two' })
await storage.bindApiModule('messages', 'api-two')
await storage.bindApiModule('messages', 'api-one')
assert.equal((await storage.getSettings()).apiModuleBindings.messages, 'api-one', 'reassignment replaces the previous binding')
await storage.bindApiModule('messages', 'api-two')
await Promise.all([storage.bindApiModule('star', 'api-two'), storage.bindApiModule('worldforge', 'api-two')])
assert.equal((await storage.getSettings()).apiModuleBindings.star, 'api-two', 'concurrent changes retain both modules')
assert.equal((await storage.getSettings()).apiModuleBindings.worldforge, 'api-two')
await assert.rejects(storage.bindApiModule('forum', 'missing'), /请先保存/)
assert.equal((await storage.readModuleApi('messages'))?.id, 'api-two')
assert.equal((await storage.readModuleApi('forum'))?.id, 'api-one', 'unassigned module uses default')
const reopened = new MetaDB()
await reopened.open()
assert.equal((await reopened.settings.get('global'))?.apiModuleBindings.messages, 'api-two', 'bindings survive reopening the database')
reopened.close()

const original = AIAdapter.fromStored
const calls: Array<{ id: string; key: string; model: string }> = []
try {
  AIAdapter.fromStored = async (profile, key) => {
    assert(profile)
    calls.push({ id: profile.id, key, model: profile.model })
    return { complete: async () => ({ content: '继续。' }) } as unknown as AIAdapter
  }
  await Promise.all(API_MODULES.map(async module => {
    await storage.bindApiModule(module.id, module.id === 'messages' ? 'api-two' : 'api-one')
    await moduleAi(module.id).askLine('测试', '只用本模块的接口')
  }))
  assert(calls.some(call => call.id === 'api-two' && call.key === 'api-two-test-key'))
  assert(calls.every(call => call.key === `${call.id}-test-key` && call.model === `${call.id}-model`), 'profile, model and decrypted key must match')
  for (const mode of ['offline', 'side', 'jiushi'] as const) {
    await storage.bindApiModule(mode, 'api-two')
    await generate([{ role: 'user', content: '继续' }], null, 20, mode)
    assert.equal(calls.at(-1)?.id, 'api-two')
    await writeSummary({ ...newSave('测试'), lines: [line('user', '共同过往')] }, 'small', 4, mode)
    assert.equal(calls.at(-1)?.id, 'api-two', 'summaries use the same module binding as story generation')
  }
} finally { AIAdapter.fromStored = original }
await storage.deleteApiProfile('api-two')
settings = await storage.getSettings()
assert(!Object.values(settings.apiModuleBindings).includes('api-two'))
assert.equal((await storage.readModuleApi('messages'))?.id, 'api-one')
await storage.bindApiModule('star', '')
assert.equal((await storage.getSettings()).apiModuleBindings.star, undefined)
// Invalid imported bindings must never silently send a request to another API.
settings = await storage.getSettings()
await storage.saveSettings({ ...settings, apiModuleBindings: { star: 'missing' } })
await assert.rejects(storage.readModuleApi('star'), /绑定的 API 不可用/)
await storage.deleteApiProfile('api-one')
assert.notEqual((await storage.getSettings()).activeApiId, 'api-one')
console.log('API routing checks passed: three-profile cap, concurrent creation/binding, exclusive reassignment, persistence, credentials, story/summary routing and deletion cleanup')
process.exit(0)
