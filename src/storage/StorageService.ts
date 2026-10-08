import Dexie from 'dexie'
import { OFFICIAL_PRESETS } from '../data/officialPresets.ts'
import { sortChats } from '../lib/chats.ts'
import { messagePreview } from '../lib/messagePreview.ts'
import { normalizeSettings } from '../lib/defaults.ts'
import { uid } from '../lib/id.ts'
import { BUNDLED_THEMES } from '../theme/themes.ts'
import type {
  ApiMeta,
  ApiProfile,
  ApiProfileView,
  AppSettings,
  Character,
  CharacterInternalState,
  Chat,
  ChatMessage,
  Identity,
  IdentitySpaceState,
  NotifyPref,
  PlayerEvent,
  Preset,
  Theme,
} from '../types/index.ts'
import { purgeCharacterBindings } from '../domain/characterCleanup.ts'
import { normalizeForumThreads } from '../lib/forumAi.ts'
import { normalizeFeedPosts } from '../lib/feed.ts'
import { markBuildCurrent, needsDataUpgrade } from '../lib/upgrade.ts'
import { decryptSecret, encryptSecret } from './crypto.ts'
import { MetaDB, NamespaceDB } from './db.ts'

const EPHEMERAL_BAG_IDS = new Set([
  'circle-feed',
  'circle-feed_error',
  'nearby_people',
  'nearby_error',
  'map_world',
  'create_draft',
])

const EPHEMERAL_BAG_PREFIXES = ['browser_', 'browser_error_', 'browser_detail_error_', 'table_say_', 'story_error_']

function isEphemeralBag(id: string): boolean {
  if (EPHEMERAL_BAG_IDS.has(id)) return true
  return EPHEMERAL_BAG_PREFIXES.some((prefix) => id.startsWith(prefix))
}

export interface BootSnapshot {
  identities: Identity[]
  settings: AppSettings
  themes: Theme[]
  presets: Preset[]
  apiMeta: ApiMeta
  apiProfiles: ApiProfileView[]
}

const EMPTY_API: ApiMeta = {
  provider: 'openai',
  id: '',
  name: '',
  endpoint: '',
  model: '',
  hasKey: false,
  ready: false,
}

function asProfile(raw: Partial<ApiProfile> & { id: string }): ApiProfile {
  const model = raw.model ?? ''
  return {
    id: raw.id,
    name: raw.name?.trim() || '未命名接口',
    endpoint: raw.endpoint ?? '',
    model,
    encryptedKey: raw.encryptedKey ?? '',
    ready: raw.ready ?? Boolean(model),
    updatedAt: raw.updatedAt ?? Date.now(),
    provider: raw.provider,
  }
}

function viewOf(profile: ApiProfile): ApiProfileView {
  return {
    id: profile.id,
    name: profile.name,
    endpoint: profile.endpoint,
    model: profile.model,
    hasKey: Boolean(profile.encryptedKey),
    ready: profile.ready && Boolean(profile.model),
  }
}

function emptySpace(): IdentitySpaceState {
  return { id: 'current', currentScene: null, remoteChats: [], history: [] }
}

export function defaultCharState(charId: string): CharacterInternalState {
  return {
    charId,
    mood: '平静',
    moodDecay: 0.15,
    unspoken: [],
    grudges: [],
    pendingOutburst: 3,
    energy: 0.8,
    location: '自己的地方',
    schedule: [],
    bond: { intimacy: 0.2, trust: 0.4, debt: 0 },
    updatedAt: Date.now(),
  }
}

class StorageService {
  private meta = new MetaDB()
  private namespaces = new Map<string, NamespaceDB>()
  private bootPromise: Promise<BootSnapshot> | null = null

  boot(): Promise<BootSnapshot> {
    if (!this.bootPromise) {
      this.bootPromise = this.bootOnce().catch((error: unknown) => {
        this.bootPromise = null
        throw error
      })
    }
    return this.bootPromise
  }

  private ns(namespace: string): NamespaceDB {
    let db = this.namespaces.get(namespace)
    if (!db) {
      db = new NamespaceDB(namespace)
      this.namespaces.set(namespace, db)
    }
    return db
  }

  private async bootOnce(): Promise<BootSnapshot> {
    await this.meta.open()
    await this.meta.transaction(
      'rw',
      this.meta.settings,
      this.meta.identities,
      this.meta.themes,
      this.meta.presets,
      async () => {
        const existing = await this.meta.settings.get('global')
        if (existing) return
        const identity: Identity = {
          id: uid('id'),
          name: '我',
          avatar: '🙂',
          persona: '一个会在这台小手机里打字的人。',
          namespace: 'mellow_main',
          defaultForApps: {},
          perAppOverride: {},
          createdAt: Date.now(),
        }
        const settings = normalizeSettings({ activeIdentityId: identity.id })
        await this.meta.identities.add(identity)
        await this.meta.themes.bulkAdd(BUNDLED_THEMES)
        await this.meta.presets.bulkAdd(OFFICIAL_PRESETS)
        await this.meta.settings.add(settings)
      },
    )
    if (needsDataUpgrade()) await this.runDataUpgrade()
    await this.ensureBundled()
    markBuildCurrent()
    return this.snapshot()
  }

  private async runDataUpgrade(): Promise<void> {
    await this.migratePersistedContent()
    await this.purgeEphemeralCaches()
    const settings = await this.meta.settings.get('global')
    if (settings) {
      const normalized = normalizeSettings(settings)
      if (JSON.stringify(normalized) !== JSON.stringify(settings)) {
        await this.meta.settings.put(normalized)
      }
    }
  }

  private async migratePersistedContent(): Promise<void> {
    const identities = await this.meta.identities.toArray()
    for (const identity of identities) {
      await this.migrateNamespaceContent(identity.namespace, identity.name)
      await this.migrateNamespaceContent(`${identity.namespace}__side`, identity.name)
    }
  }

  private async migrateNamespaceContent(namespace: string, playerName: string): Promise<void> {
    const db = this.ns(namespace)
    const starFeedRow = await db.appData.get('star_feed')
    const legacyStarRow = await db.appData.get('star')
    let posts = normalizeFeedPosts(starFeedRow?.value)
    if (!posts.length && legacyStarRow?.value) {
      posts = normalizeFeedPosts(
        (legacyStarRow.value as Array<{ id?: string; text?: string; at?: number }>).map((item) => ({
          id: item.id,
          author: playerName,
          handle: '我',
          text: item.text,
          at: item.at,
          likes: 0,
          liked: false,
          comments: [],
          mine: true,
        })),
      )
      if (posts.length) await db.appData.delete('star')
    }
    if (posts.length && JSON.stringify(posts) !== JSON.stringify(starFeedRow?.value)) {
      await db.appData.put({ id: 'star_feed', value: posts })
    }

    const forumRow = await db.appData.get('forum')
    if (forumRow) {
      const threads = normalizeForumThreads(forumRow.value)
      if (JSON.stringify(threads) !== JSON.stringify(forumRow.value)) {
        await db.appData.put({ id: 'forum', value: threads })
      }
    }
  }

  private async purgeEphemeralCaches(): Promise<void> {
    const identities = await this.meta.identities.toArray()
    const namespaces = [...new Set(identities.flatMap((item) => [item.namespace, `${item.namespace}__side`]))]
    for (const namespace of namespaces) {
      const db = this.ns(namespace)
      const rows = await db.appData.toArray()
      const stale = rows.filter((row) => isEphemeralBag(row.id)).map((row) => row.id)
      if (stale.length > 0) await db.appData.bulkDelete(stale)
    }
  }

  private async ensureBundled(): Promise<void> {
    const themes = await this.meta.themes.toArray()
    const themeIds = new Set(themes.map((item) => item.id))
    const missingThemes = BUNDLED_THEMES.filter((item) => !themeIds.has(item.id))
    if (missingThemes.length > 0) await this.meta.themes.bulkAdd(missingThemes)

    for (const official of OFFICIAL_PRESETS) {
      const existing = await this.meta.presets.get(official.id)
      if (!existing || existing.type === 'system' || existing.author === 'mellow') {
        await this.meta.presets.put(official)
      }
    }
  }

  private async snapshot(): Promise<BootSnapshot> {
    const settings = await this.getSettings()
    const identities = await this.meta.identities.orderBy('createdAt').toArray()
    if (identities.length === 0) throw new Error('至少需要一个身份')
    const apiProfiles = await this.listApiProfiles()
    const active = apiProfiles.find((item) => item.id === settings.activeApiId) ?? apiProfiles.find((item) => item.ready) ?? apiProfiles[0]
    return {
      identities,
      settings,
      themes: await this.meta.themes.toArray(),
      presets: await this.meta.presets.toArray(),
      apiProfiles,
      apiMeta: active
        ? { provider: 'openai', id: active.id, name: active.name, endpoint: active.endpoint, model: active.model, hasKey: active.hasKey, ready: active.ready }
        : EMPTY_API,
    }
  }

  async listIdentities(): Promise<Identity[]> {
    return this.meta.identities.orderBy('createdAt').toArray()
  }

  async createIdentity(input: { name: string; persona: string; avatar: string }): Promise<Identity> {
    const identity: Identity = {
      id: uid('id'),
      name: input.name.trim(),
      avatar: input.avatar,
      persona: input.persona.trim(),
      namespace: `mellow_${uid('ns')}`,
      defaultForApps: {},
      perAppOverride: {},
      createdAt: Date.now(),
    }
    await this.meta.identities.add(identity)
    return identity
  }

  async updateIdentity(identity: Identity): Promise<void> {
    await this.meta.identities.put(identity)
  }

  async deleteIdentity(id: string): Promise<void> {
    const all = await this.listIdentities()
    if (all.length <= 1) throw new Error('最后一张手机不能拆掉')
    const target = all.find((item) => item.id === id)
    if (!target) return
    const db = this.namespaces.get(target.namespace)
    if (db) {
      db.close()
      this.namespaces.delete(target.namespace)
    }
    await Dexie.delete(target.namespace)
    await this.meta.identities.delete(id)
    for (const identity of all) {
      if (identity.id === id) continue
      const perAppOverride = { ...identity.perAppOverride }
      const defaultForApps = { ...identity.defaultForApps }
      let changed = false
      for (const [appId, value] of Object.entries(perAppOverride)) {
        if (value === id) {
          delete perAppOverride[appId]
          changed = true
        }
      }
      for (const [appId, value] of Object.entries(defaultForApps)) {
        if (value === id) {
          delete defaultForApps[appId]
          changed = true
        }
      }
      if (changed) await this.meta.identities.put({ ...identity, perAppOverride, defaultForApps })
    }
    const settings = await this.meta.settings.get('global')
    if (settings?.activeIdentityId === id) {
      const next = all.find((item) => item.id !== id)
      if (next) await this.meta.settings.put({ ...settings, activeIdentityId: next.id })
    }
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await this.meta.settings.put(settings)
  }

  async getSettings(): Promise<AppSettings> {
    const settings = await this.meta.settings.get('global')
    if (!settings) throw new Error('设置丢失了')
    return normalizeSettings(settings)
  }

  async saveTheme(theme: Theme): Promise<void> {
    await this.meta.themes.put(theme)
  }

  async listThemes(): Promise<Theme[]> {
    return this.meta.themes.toArray()
  }

  async savePreset(preset: Preset): Promise<void> {
    await this.meta.presets.put(preset)
  }

  async listPresets(): Promise<Preset[]> {
    return this.meta.presets.toArray()
  }

  async listApiProfiles(): Promise<ApiProfileView[]> {
    const rows = await this.meta.apiConfig.toArray()
    return rows.map((row) => viewOf(asProfile(row))).sort((a, b) => a.name.localeCompare(b.name, 'zh'))
  }

  async saveApiProfile(input: { id?: string; name: string; endpoint: string; model: string; key?: string; ready: boolean }): Promise<ApiProfileView> {
    const id = input.id || uid('api')
    const current = await this.meta.apiConfig.get(id)
    let encryptedKey = current?.encryptedKey ?? ''
    if (typeof input.key === 'string') {
      encryptedKey = input.key.trim() ? await encryptSecret(input.key.trim()) : ''
    }
    const next = asProfile({
      id,
      name: input.name.trim() || '未命名接口',
      endpoint: input.endpoint.trim(),
      model: input.model.trim(),
      encryptedKey,
      ready: input.ready && Boolean(input.model.trim()),
      updatedAt: Date.now(),
      provider: 'openai',
    })
    await this.meta.apiConfig.put(next)
    return viewOf(next)
  }

  async deleteApiProfile(id: string): Promise<void> {
    await this.meta.apiConfig.delete(id)
    const settings = await this.getSettings()
    if (settings.activeApiId === id) await this.saveSettings({ ...settings, activeApiId: '' })
  }

  async readApiKey(id?: string): Promise<string> {
    const profile = await this.readApi(id)
    if (!profile?.encryptedKey) return ''
    return decryptSecret(profile.encryptedKey)
  }

  async readApi(id?: string): Promise<ApiProfile | undefined> {
    const settings = await this.getSettings()
    const chosen = id || settings.activeApiId
    if (chosen) {
      const row = await this.meta.apiConfig.get(chosen)
      return row ? asProfile(row) : undefined
    }
    const rows = await this.meta.apiConfig.toArray()
    const ready = rows.map((row) => asProfile(row)).find((row) => row.ready && row.model)
    return ready
  }

  async listCharacters(namespace: string): Promise<Character[]> {
    return this.ns(namespace).chars.orderBy('createdAt').toArray()
  }

  async putCharacter(namespace: string, character: Character): Promise<void> {
    const db = this.ns(namespace)
    await db.chars.put(character)
    const state = await db.charState.get(character.id)
    if (!state) await db.charState.put(defaultCharState(character.id))
  }

  async getCharState(namespace: string, charId: string): Promise<CharacterInternalState | undefined> {
    return this.ns(namespace).charState.get(charId)
  }

  async saveCharState(namespace: string, state: CharacterInternalState): Promise<void> {
    await this.ns(namespace).charState.put(state)
  }

  async getCharacter(namespace: string, id: string): Promise<Character | undefined> {
    return this.ns(namespace).chars.get(id)
  }

  async deleteCharacter(namespace: string, id: string): Promise<void> {
    await purgeCharacterBindings(namespace, id)
    await purgeCharacterBindings(`${namespace}__side`, id)
    const db = this.ns(namespace)
    const chats = await db.chats.filter((chat) => chat.memberIds.includes(id)).toArray()
    await db.permissions.where('charId').equals(id).delete()
    await db.transaction('rw', db.chars, db.chats, db.messages, db.charState, db.notifyPrefs, async () => {
      await db.chars.delete(id)
      await db.charState.delete(id)
      await db.notifyPrefs.delete(id)
      for (const chat of chats) {
        if (chat.kind === 'dm') {
          await db.messages.where('chatId').equals(chat.id).delete()
          await db.chats.delete(chat.id)
          continue
        }
        await db.chats.put({ ...chat, memberIds: chat.memberIds.filter((memberId) => memberId !== id), updatedAt: Date.now() })
        const groupMessages = await db.messages.where('chatId').equals(chat.id).toArray()
        for (const message of groupMessages.filter((item) => item.charId === id)) {
          await db.messages.delete(message.id)
        }
      }
    })
  }

  async listChats(namespace: string): Promise<Chat[]> {
    const chats = await this.ns(namespace).chats.toArray()
    return sortChats(chats)
  }

  async getChat(namespace: string, id: string): Promise<Chat | undefined> {
    return this.ns(namespace).chats.get(id)
  }

  async putChat(namespace: string, chat: Chat): Promise<void> {
    await this.ns(namespace).chats.put(chat)
  }

  async listMessages(namespace: string, chatId: string): Promise<ChatMessage[]> {
    const messages = await this.ns(namespace).messages.where('chatId').equals(chatId).toArray()
    messages.sort((a, b) => a.createdAt - b.createdAt)
    return messages
  }

  async putMessage(namespace: string, message: ChatMessage): Promise<void> {
    await this.ns(namespace).messages.put(message)
  }

  async markChatRead(namespace: string, chatId: string): Promise<void> {
    const db = this.ns(namespace)
    const chat = await db.chats.get(chatId)
    if (!chat) return
    if (chat.unread === 0) return
    await db.chats.put({ ...chat, unread: 0, updatedAt: Date.now() })
  }

  async updateMessage(namespace: string, message: ChatMessage): Promise<void> {
    await this.ns(namespace).messages.put(message)
  }

  async deleteMessage(namespace: string, messageId: string): Promise<void> {
    await this.ns(namespace).messages.delete(messageId)
  }

  async deleteMessages(namespace: string, chatId: string, messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return
    await this.ns(namespace).messages.bulkDelete(messageIds)
    await this.refreshChatPreview(namespace, chatId)
  }

  async refreshChatPreview(namespace: string, chatId: string): Promise<void> {
    const db = this.ns(namespace)
    const chat = await db.chats.get(chatId)
    if (!chat) return
    const messages = await this.listMessages(namespace, chatId)
    const visible = messages.filter((item) => !item.hidden && item.kind !== 'system')
    const last = visible[visible.length - 1]
    if (last) {
      await db.chats.put({
        ...chat,
        lastMessage: messagePreview(last.content, last.kind),
        lastMessageAt: last.createdAt,
        updatedAt: Date.now(),
      })
      return
    }
    await db.chats.put({ ...chat, lastMessage: '', updatedAt: Date.now() })
  }

  async getSpace(namespace: string): Promise<IdentitySpaceState> {
    return (await this.ns(namespace).spaceState.get('current')) ?? emptySpace()
  }

  async saveSpace(namespace: string, space: IdentitySpaceState): Promise<void> {
    await this.ns(namespace).spaceState.put(space)
  }

  async getNotifyPref(namespace: string, charId: string): Promise<NotifyPref | undefined> {
    return this.ns(namespace).notifyPrefs.get(charId)
  }

  async saveNotifyPref(namespace: string, pref: NotifyPref): Promise<void> {
    await this.ns(namespace).notifyPrefs.put(pref)
  }

  async addEvent(namespace: string, event: PlayerEvent): Promise<void> {
    await this.ns(namespace).events.put(event)
  }

  async listEvents(namespace: string, limit = 12): Promise<PlayerEvent[]> {
    const events = await this.ns(namespace).events.orderBy('time').reverse().limit(limit).toArray()
    return events
  }

  async clearChat(namespace: string, chatId: string): Promise<void> {
    const db = this.ns(namespace)
    await db.messages.where('chatId').equals(chatId).delete()
    const chat = await db.chats.get(chatId)
    if (!chat) return
    await db.chats.put({ ...chat, lastMessage: '', unread: 0, updatedAt: Date.now() })
  }

  async getBag<T>(namespace: string, id: string): Promise<T | null> {
    const row = await this.ns(namespace).appData.get(id)
    return row ? (row.value as T) : null
  }

  async setBag(namespace: string, id: string, value: unknown): Promise<void> {
    await this.ns(namespace).appData.put({ id, value })
  }

  async deleteBag(namespace: string, id: string): Promise<void> {
    await this.ns(namespace).appData.delete(id)
  }

  async exportBundle(): Promise<Record<string, unknown>> {
    const identities = await this.listIdentities()
    const names = [...new Set(identities.flatMap((item) => [item.namespace, `${item.namespace}__side`]))]
    const worlds = []
    for (const namespace of names) {
      const db = this.ns(namespace)
      worlds.push({
        namespace,
        chars: await db.chars.toArray(),
        chats: await db.chats.toArray(),
        messages: await db.messages.toArray(),
        spaceState: await db.spaceState.toArray(),
        appData: await db.appData.toArray(),
        charState: await db.charState.toArray(),
        events: await db.events.toArray(),
        notifyPrefs: await db.notifyPrefs.toArray(),
      })
    }
    return {
      kind: 'mellow-backup',
      version: 1,
      exportedAt: Date.now(),
      identities,
      settings: await this.getSettings(),
      themes: await this.listThemes(),
      presets: await this.listPresets(),
      apis: (await this.meta.apiConfig.toArray()).map((row) => asProfile(row)),
      worlds,
    }
  }

  async importBundle(raw: unknown): Promise<void> {
    if (!isBackup(raw)) throw new Error('这不是半糖的备份文件')
    for (const identity of raw.identities) await this.meta.identities.put(identity)
    for (const theme of raw.themes) await this.meta.themes.put(theme)
    for (const preset of raw.presets) await this.meta.presets.put(preset)
    for (const api of raw.apis) await this.meta.apiConfig.put(asProfile(api))
    await this.saveSettings(normalizeSettings(raw.settings))
    for (const world of raw.worlds) {
      const db = this.ns(world.namespace)
      await db.chars.bulkPut(world.chars ?? [])
      await db.chats.bulkPut(world.chats ?? [])
      await db.messages.bulkPut(world.messages ?? [])
      await db.spaceState.bulkPut(world.spaceState ?? [])
      await db.appData.bulkPut(world.appData ?? [])
      await db.charState.bulkPut(world.charState ?? [])
      await db.events.bulkPut(world.events ?? [])
      await db.notifyPrefs.bulkPut(world.notifyPrefs ?? [])
    }
  }
}

function isBackup(raw: unknown): raw is {
  kind: 'mellow-backup'
  identities: Identity[]
  settings: AppSettings
  themes: Theme[]
  presets: Preset[]
  apis: ApiProfile[]
  worlds: Array<{
    namespace: string
    chars: Character[]
    chats: Chat[]
    messages: ChatMessage[]
    spaceState: IdentitySpaceState[]
    appData: Array<{ id: string; value: unknown }>
    charState: CharacterInternalState[]
    events: PlayerEvent[]
    notifyPrefs: NotifyPref[]
  }>
} {
  if (!raw || typeof raw !== 'object') return false
  const row = raw as { kind?: string; worlds?: unknown; identities?: unknown }
  return row.kind === 'mellow-backup' && Array.isArray(row.worlds) && Array.isArray(row.identities)
}

export const storage = new StorageService()
