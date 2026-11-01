import 'fake-indexeddb/auto'
import './check-transaction-scope.mjs'
import assert from 'node:assert/strict'
import Dexie from 'dexie'
import { MetaDB } from '../src/storage/db.ts'
import { initializeMeta } from '../src/storage/initializeMeta.ts'
import { BUNDLED_THEMES } from '../src/theme/themes.ts'
import { OFFICIAL_PRESETS } from '../src/data/officialPresets.ts'
import type { Identity } from '../src/types/index.ts'

// All tests use in-memory fake-indexeddb, never browser/user databases.
let db = new MetaDB()
await db.open()
await Promise.all(Array.from({ length: 8 }, () => initializeMeta(db)))
assert.equal(await db.identities.count(), 1, 'concurrent first launches create only one identity')
const settings = await db.settings.get('global')
assert.ok(await db.identities.get(settings!.activeIdentityId))
assert.equal(await db.themes.count(), BUNDLED_THEMES.length)
assert.equal(await db.presets.count(), OFFICIAL_PRESETS.length)
await initializeMeta(db)
assert.deepEqual(await db.settings.get('global'), settings, 'normal launch does not overwrite settings')
db.close(); await Dexie.delete('mellow_meta')

db = new MetaDB(); await db.open()
const identity: Identity = { id: 'existing-phone', name: '原有身份', avatar: '🙂', persona: '保留', namespace: 'existing-world', defaultForApps: {}, perAppOverride: {}, createdAt: 1 }
const customTheme = { ...BUNDLED_THEMES[0]!, name: '原有主题内容', wallpaper: 'data:image/png;base64,test' }
const importedPreset = { ...OFFICIAL_PRESETS[0]!, id: 'imported-preset', name: '导入的个人预设' }
await db.identities.put(identity)
await db.themes.put(customTheme)
await db.presets.bulkPut([OFFICIAL_PRESETS[0]!, importedPreset])
await initializeMeta(db)
assert.equal((await db.settings.get('global'))?.activeIdentityId, identity.id)
assert.deepEqual(await db.identities.toArray(), [identity], 'partial first launch reuses the saved identity')
assert.deepEqual(await db.themes.get(customTheme.id), customTheme)
assert.deepEqual(await db.presets.get(importedPreset.id), importedPreset)
assert.ok((await db.themes.count()) >= BUNDLED_THEMES.length)
assert.equal(await db.presets.count(), OFFICIAL_PRESETS.length + 1)
db.close(); await Dexie.delete('mellow_meta')

db = new MetaDB(); await db.open()
const fail = () => { throw new Error('simulated write failure') }
db.presets.hook('creating', fail)
await assert.rejects(Promise.resolve(initializeMeta(db)), /simulated write failure/)
assert.equal(await db.identities.count(), 0, 'failed seeding rolls back identity writes')
assert.equal(await db.themes.count(), 0)
assert.equal(await db.settings.count(), 0)
db.presets.hook('creating').unsubscribe(fail)
await initializeMeta(db)
assert.equal(await db.identities.count(), 1, 'retry succeeds after a transaction failure')
assert.ok(await db.settings.get('global'))
db.close()
console.log('Database startup checks passed: Dexie promise scopes, concurrent boot, partial initialization repair, preservation, rollback and retry')
