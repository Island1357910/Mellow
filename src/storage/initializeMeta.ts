import Dexie from 'dexie'
import { normalizeSettings } from '../lib/defaults.ts'
import { uid } from '../lib/id.ts'
import { BUNDLED_THEMES } from '../theme/themes.ts'
import { OFFICIAL_PRESETS } from '../data/officialPresets.ts'
import type { Identity } from '../types/index.ts'
import type { MetaDB } from './db.ts'

/** Keep transaction continuations on Dexie's own promises on older WebViews. */
export function initializeMeta(db: MetaDB): PromiseLike<unknown> {
  return db.settings.get('global').then(existing => {
    if (existing) return
    return db.transaction('rw', db.settings, db.identities, db.themes, db.presets, () =>
      db.settings.get('global').then(recheck => {
        if (recheck) return
        return db.identities.orderBy('createdAt').first().then(savedIdentity => {
          // A prematurely committed first launch may already have created some rows.
          const identity: Identity = savedIdentity ?? {
            id: uid('id'), name: '我', avatar: '🙂', persona: '一个会在这台小手机里打字的人。',
            namespace: 'mellow_main', defaultForApps: {}, perAppOverride: {}, createdAt: Date.now(),
          }
          return Dexie.Promise.all([
            db.themes.bulkGet(BUNDLED_THEMES.map(theme => theme.id)),
            db.presets.bulkGet(OFFICIAL_PRESETS.map(preset => preset.id)),
          ]).then(([themes, presets]) => {
            const missingThemes = BUNDLED_THEMES.filter((_, i) => !themes[i])
            const missingPresets = OFFICIAL_PRESETS.filter((_, i) => !presets[i])
            return Dexie.Promise.all<unknown>([
              savedIdentity ? Dexie.Promise.resolve() : db.identities.add(identity),
              db.themes.bulkAdd(missingThemes),
              db.presets.bulkAdd(missingPresets),
            ]).then(() => db.settings.add(normalizeSettings({ activeIdentityId: identity.id })))
          })
        })
      }))
  })
}
