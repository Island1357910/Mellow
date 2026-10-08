import { defaultSettings } from '../lib/defaults.ts'
import { BUNDLED_THEMES } from '../theme/themes.ts'
import { eventBus } from '../engine/EventBus.ts'
import { findIdentity, resolveIdentityId } from '../engine/identity.ts'
import { uid } from '../lib/id.ts'
import { shouldSuppressMessage } from '../lib/quietHours.ts'
import { maybeReactToSearch } from '../lib/searchReaction.ts'
import { storage } from '../storage/StorageService.ts'
import type { ApiMeta, ApiProfileView, AppSettings, Chat, Identity, Notice, PlayerEvent, Preset, Theme } from '../types/index.ts'
import { create } from 'zustand'

interface OpenChatRequest {
  chatId: string
  identityId: string
  token: string
}

interface MellowState {
  ready: boolean
  bootError: string
  locked: boolean
  activeApp: string | null
  appOpenedAt: number | null
  controlOpen: boolean
  identitySheet: boolean
  brightness: number
  veil: string
  viewingChatId: string | null
  pendingReplyChatId: string | null
  dataRevision: number
  openChatRequest: OpenChatRequest | null
  identities: Identity[]
  activeIdentityId: string
  settings: AppSettings
  themes: Theme[]
  presets: Preset[]
  apiMeta: ApiMeta
  apiProfiles: ApiProfileView[]
  sessionApps: string[]
  inbox: Chat[]
  inboxIdentityId: string
  notices: Notice[]
  recentEvents: PlayerEvent[]
  boot: () => Promise<void>
  unlock: () => void
  openApp: (id: string) => void
  closeApp: () => void
  setControl: (open: boolean) => void
  setIdentitySheet: (open: boolean) => void
  setBrightness: (value: number) => void
  setViewingChat: (chatId: string | null) => void
  beginReply: (chatId: string) => void
  endReply: () => void
  refreshInbox: () => Promise<void>
  refreshEvents: () => Promise<void>
  reloadLibraries: () => Promise<void>
  switchIdentity: (id: string) => Promise<void>
  createIdentity: (input: { name: string; persona: string; avatar: string }) => Promise<void>
  deleteIdentity: (id: string) => Promise<void>
  updateIdentity: (identity: Identity) => Promise<void>
  setAppOverride: (appId: string, identityId: string | null) => Promise<void>
  setAppDefault: (appId: string, identityId: string | null) => Promise<void>
  patchSettings: (patch: Partial<AppSettings>) => Promise<void>
  reloadApis: () => Promise<void>
  grantApp: (id: string) => void
  pushNotice: (input: Omit<Notice, 'id' | 'createdAt'>) => Promise<void>
  dismissNotice: (id: string) => void
  requestOpenChat: (request: Omit<OpenChatRequest, 'token'>) => void
  consumeOpenChat: () => void
  touchData: () => void
}

const fallbackTheme = BUNDLED_THEMES[0]

let bootFlight: Promise<void> | null = null
let eventsWired = false

function wireEvents(): void {
  if (eventsWired) return
  eventsWired = true
  eventBus.subscribe((event) => {
    const state = useMellow.getState()
    const identity = state.identities.find((item) => item.id === event.identityId)
    if (!identity) return
    if (event.type === 'search' && event.query?.trim()) {
      void maybeReactToSearch(identity.namespace, event.identityId, event.query)
    }
    void storage.addEvent(identity.namespace, event).then(() => {
      if (useMellow.getState().activeIdentityId === event.identityId) {
        void useMellow.getState().refreshEvents()
      }
    })
  })
}

export const useMellow = create<MellowState>((set, get) => ({
  ready: false,
  bootError: '',
  locked: true,
  activeApp: null,
  appOpenedAt: null,
  controlOpen: false,
  identitySheet: false,
  brightness: 1,
  veil: '',
  viewingChatId: null,
  pendingReplyChatId: null,
  dataRevision: 0,
  openChatRequest: null,
  identities: [],
  activeIdentityId: '',
  settings: defaultSettings(''),
  themes: BUNDLED_THEMES,
  presets: [],
  apiMeta: { provider: 'openai', id: '', name: '', endpoint: '', model: '', hasKey: false, ready: false },
  apiProfiles: [],
  sessionApps: [],
  inbox: [],
  inboxIdentityId: '',
  notices: [],
  recentEvents: [],

  boot: () => {
    if (!bootFlight) {
      bootFlight = (async () => {
        try {
          wireEvents()
          const snap = await storage.boot()
          set({
            ready: true,
            bootError: '',
            identities: snap.identities,
            activeIdentityId: snap.settings.activeIdentityId,
            settings: snap.settings,
            themes: snap.themes,
            presets: snap.presets,
            apiMeta: snap.apiMeta,
            apiProfiles: snap.apiProfiles,
          })
          void get().refreshInbox()
          void get().refreshEvents()
        } catch (error) {
          bootFlight = null
          set({
            ready: true,
            bootError: error instanceof Error ? error.message : '这台手机没有启动',
          })
        }
      })()
    }
    return bootFlight
  },

  unlock: () => set({ locked: false }),

  openApp: (id) => {
    const current = get()
    if (current.activeApp && current.activeApp !== id && current.appOpenedAt) {
      eventBus.emit({
        type: 'close_app',
        app: current.activeApp,
        identityId: current.activeIdentityId,
        duration: Date.now() - current.appOpenedAt,
      })
    }
    eventBus.emit({ type: 'open_app', app: id, identityId: current.activeIdentityId })
    set({ activeApp: id, appOpenedAt: Date.now(), controlOpen: false, identitySheet: false, locked: false })
  },

  closeApp: () => {
    const current = get()
    if (current.activeApp && current.appOpenedAt) {
      eventBus.emit({
        type: 'close_app',
        app: current.activeApp,
        identityId: current.activeIdentityId,
        duration: Date.now() - current.appOpenedAt,
      })
    }
    set({ activeApp: null, appOpenedAt: null, viewingChatId: null })
  },

  setControl: (open) => set({ controlOpen: open, identitySheet: open ? false : get().identitySheet }),
  setIdentitySheet: (open) => set({ identitySheet: open, controlOpen: open ? false : get().controlOpen }),
  setBrightness: (value) => set({ brightness: Math.min(1, Math.max(0.45, value)) }),
  setViewingChat: (chatId) => set({ viewingChatId: chatId }),
  beginReply: (chatId) => set({ pendingReplyChatId: chatId }),
  endReply: () => set({ pendingReplyChatId: null }),

  refreshInbox: async () => {
    const state = get()
    if (!state.activeIdentityId) return
    const phone = findIdentity(state.identities, state.activeIdentityId)
    const resolved = findIdentity(state.identities, resolveIdentityId(phone, 'messages', state.identities))
    const inbox = await storage.listChats(resolved.namespace)
    set({ inbox, inboxIdentityId: resolved.id })
  },

  refreshEvents: async () => {
    const state = get()
    const phone = state.identities.find((item) => item.id === state.activeIdentityId)
    if (!phone) return
    const recentEvents = await storage.listEvents(phone.namespace, 12)
    set({ recentEvents })
  },

  reloadLibraries: async () => {
    const [themes, presets] = await Promise.all([storage.listThemes(), storage.listPresets()])
    set({ themes, presets })
  },

  switchIdentity: async (id) => {
    const identity = findIdentity(get().identities, id)
    set({ veil: identity.name })
    const settings = { ...get().settings, activeIdentityId: id }
    await Promise.all([
      storage.saveSettings(settings),
      new Promise((resolve) => window.setTimeout(resolve, 280)),
    ])
    set({ settings, activeIdentityId: id, activeApp: null, viewingChatId: null, identitySheet: false })
    eventBus.emit({ type: 'switch_identity', app: 'map', identityId: id, meta: { name: identity.name } })
    await get().refreshInbox()
    await get().refreshEvents()
    set((current) => ({ veil: '', dataRevision: current.dataRevision + 1 }))
  },

  createIdentity: async (input) => {
    const identity = await storage.createIdentity(input)
    set((current) => ({ identities: [...current.identities, identity] }))
    await get().switchIdentity(identity.id)
  },

  deleteIdentity: async (id) => {
    await storage.deleteIdentity(id)
    const identities = await storage.listIdentities()
    const settings = await storage.getSettings()
    set({ identities, settings, activeIdentityId: settings.activeIdentityId, activeApp: null })
    await get().refreshInbox()
    await get().refreshEvents()
    set((current) => ({ dataRevision: current.dataRevision + 1 }))
  },

  updateIdentity: async (identity) => {
    await storage.updateIdentity(identity)
    set((current) => ({
      identities: current.identities.map((item) => (item.id === identity.id ? identity : item)),
    }))
  },

  setAppOverride: async (appId, identityId) => {
    const phone = findIdentity(get().identities, get().activeIdentityId)
    const perAppOverride = { ...phone.perAppOverride }
    if (!identityId || identityId === phone.id) delete perAppOverride[appId]
    else perAppOverride[appId] = identityId
    await get().updateIdentity({ ...phone, perAppOverride })
    await get().refreshInbox()
    set((current) => ({ dataRevision: current.dataRevision + 1 }))
  },

  setAppDefault: async (appId, identityId) => {
    const phone = findIdentity(get().identities, get().activeIdentityId)
    const defaultForApps = { ...phone.defaultForApps }
    if (!identityId || identityId === phone.id) delete defaultForApps[appId]
    else defaultForApps[appId] = identityId
    await get().updateIdentity({ ...phone, defaultForApps })
    await get().refreshInbox()
    set((current) => ({ dataRevision: current.dataRevision + 1 }))
  },

  patchSettings: async (patch) => {
    const prev = get().settings
    const settings: AppSettings = { ...prev, ...patch, id: 'global' }
    await storage.saveSettings(settings)
    set({ settings, activeIdentityId: settings.activeIdentityId })
    if (typeof patch.fourthWall === 'boolean' && patch.fourthWall !== prev.fourthWall) {
      eventBus.emit({
        type: 'fourth_wall',
        app: 'settings',
        identityId: settings.activeIdentityId,
        meta: { enabled: patch.fourthWall },
      })
    }
  },

  reloadApis: async () => {
    const settings = await storage.getSettings()
    const apiProfiles = await storage.listApiProfiles()
    const active = apiProfiles.find((item) => item.id === settings.activeApiId) ?? apiProfiles.find((item) => item.ready)
    set({
      settings,
      apiProfiles,
      apiMeta: active
        ? { provider: 'openai', id: active.id, name: active.name, endpoint: active.endpoint, model: active.model, hasKey: active.hasKey, ready: active.ready }
        : { provider: 'openai', id: '', name: '', endpoint: '', model: '', hasKey: false, ready: false },
    })
  },

  grantApp: (id) => set((current) => ({ sessionApps: current.sessionApps.includes(id) ? current.sessionApps : [...current.sessionApps, id] })),

  pushNotice: async (input) => {
    if (input.kind === 'message') {
      if (shouldSuppressMessage(get().settings)) return
      if (input.chatId && input.chatId === get().viewingChatId) return
      if (input.charId && input.identityId) {
        const identity = get().identities.find((item) => item.id === input.identityId)
        if (identity) {
          const pref = await storage.getNotifyPref(identity.namespace, input.charId)
          if (pref?.level === 'mute') return
          if (pref?.level === 'important' && input.priority < 4) return
        }
      }
    }
    const notice: Notice = { ...input, id: uid('ntc'), createdAt: Date.now() }
    set((current) => ({ notices: [notice, ...current.notices].slice(0, 3) }))
    window.setTimeout(() => {
      useMellow.getState().dismissNotice(notice.id)
    }, 4600)
  },

  dismissNotice: (id) => set((current) => ({ notices: current.notices.filter((item) => item.id !== id) })),

  requestOpenChat: (request) => {
    set({ openChatRequest: { ...request, token: uid('open') }, locked: false })
    get().openApp('messages')
  },

  consumeOpenChat: () => set({ openChatRequest: null }),
  touchData: () => set((current) => ({ dataRevision: current.dataRevision + 1 })),
}))

export function phoneIdentity(state: Pick<MellowState, 'identities' | 'activeIdentityId'>): Identity | undefined {
  return state.identities.find((item) => item.id === state.activeIdentityId)
}

export function themeOf(state: Pick<MellowState, 'themes' | 'settings'>): Theme {
  return state.themes.find((item) => item.id === state.settings.themeId) ?? state.themes[0] ?? fallbackTheme
}
