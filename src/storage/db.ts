import Dexie, { type Table } from 'dexie'
import type {
  ApiConfig,
  AppPermission,
  AppSettings,
  Character,
  CharacterInternalState,
  Chat,
  ChatMessage,
  Group,
  Identity,
  IdentitySpaceState,
  NotifyPref,
  PlayerEvent,
  Preset,
  Theme,
} from '../types/index.ts'

export class MetaDB extends Dexie {
  identities!: Table<Identity, string>
  themes!: Table<Theme, string>
  presets!: Table<Preset, string>
  apiConfig!: Table<ApiConfig, string>
  settings!: Table<AppSettings, string>

  constructor() {
    super('mellow_meta')
    this.version(1).stores({
      identities: 'id, namespace, createdAt',
      themes: 'id, name',
      presets: 'id, type, name',
      apiConfig: 'id',
      settings: 'id',
    })
  }
}

export class NamespaceDB extends Dexie {
  chars!: Table<Character, string>
  chats!: Table<Chat, string>
  messages!: Table<ChatMessage, string>
  groups!: Table<Group, string>
  spaceState!: Table<IdentitySpaceState, string>
  permissions!: Table<AppPermission, string>
  events!: Table<PlayerEvent, string>
  charState!: Table<CharacterInternalState, string>
  appData!: Table<{ id: string; value: unknown }, string>
  notifyPrefs!: Table<NotifyPref, string>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      chars: 'id, name, createdAt',
      chats: 'id, lastMessageAt, updatedAt',
      messages: 'id, chatId, createdAt',
      groups: 'id',
      spaceState: 'id',
      permissions: 'id, charId, appId',
      events: 'id, type, time',
      charState: 'charId',
      appData: 'id',
      notifyPrefs: 'charId',
    })
  }
}
