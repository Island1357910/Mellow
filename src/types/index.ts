/** 半糖的数据合同。设定是数据，这些接口是存储和引擎之间的边界。 */

export interface Identity {
  id: string
  name: string
  avatar: string
  persona: string
  /** 独立 IndexedDB 库名，前缀 mellow_ */
  namespace: string
  /** appId -> identityId，这个 App 没被手动指定时用谁 */
  defaultForApps: Record<string, string>
  /** appId -> identityId，App 内手动选择，优先级最高 */
  perAppOverride: Record<string, string>
  createdAt: number
}

export interface UnspokenItem {
  event: string
  emotion: string
  weight: number
  ts: number
}

export interface Grudge {
  reason: string
  weight: number
  ts: number
}

export interface ScheduleSlot {
  time: string
  activity: string
}

/** 角色内部状态。这一版只建档，变化留到活人感阶段。 */
export interface CharacterInternalState {
  charId: string
  mood: string
  moodDecay: number
  unspoken: UnspokenItem[]
  grudges: Grudge[]
  pendingOutburst: number
  energy: number
  location: string
  schedule: ScheduleSlot[]
  /** 亲密度、信任、亏欠。先占位，不在这一版自动变化。 */
  bond: {
    intimacy: number
    trust: number
    debt: number
  }
  updatedAt: number
}

export interface LorebookEntry {
  keys?: string[]
  content: string
  enabled?: boolean
  disable?: boolean
  constant?: boolean
  insertion_order?: number
  name?: string
  /** SillyTavern 里条目的显示名，常写在 comment */
  comment?: string
}

export interface Lorebook {
  name?: string
  entries: LorebookEntry[] | Record<string, LorebookEntry>
}

export interface Character {
  id: string
  name: string
  avatar: string
  description: string
  personality: string
  scenario: string
  firstMes: string
  mesExample: string
  creatorNotes: string
  systemPrompt: string
  postHistoryInstructions: string
  alternateGreetings: string[]
  tags: string[]
  creator: string
  characterVersion: string
  characterBook: Lorebook | null
  extensions: Record<string, unknown>
  /** 导入时的原始卡，导出时尽量保留未识别字段 */
  rawCard: unknown
  /** 单角色预设。空则跟随全局 */
  presetId: string | null
  /** MiniMax 音色 id。空则跟随全局默认角色音色 */
  voiceId?: string | null
  /** 个性签名，聊天页名称下方的小字 */
  signature?: string
  /** 角色自己起的昵称，聊天里显示它，设定里仍用 name */
  nickname?: string
  remark?: string
  folderId?: string
  blocked?: boolean
  createdAt: number
  updatedAt: number
}

export type BubbleStyle = 'soft' | 'square' | 'line'

export interface Chat {
  id: string
  kind: 'dm' | 'group'
  title: string
  memberIds: string[]
  lastMessage: string
  lastMessageAt: number
  unread: number
  /** 单会话预设。空则看角色，再看全局 */
  presetId: string | null
  pinned?: boolean
  muted?: boolean
  blocked?: boolean
  specialCare?: boolean
  remark?: string
  background?: string
  /** 玩家上传的聊天背景图，优先于 background 纯色 */
  backgroundImage?: string
  bubble?: BubbleStyle
  /** 玩家写的气泡 CSS 声明，分别作用于自己和对方的气泡 */
  bubbleCss?: { mine?: string; theirs?: string }
  /** 玩家补充的与对方的过往与关系，写进提示词 */
  backstory?: string
  /** 带进模型的历史条数 */
  contextLimit?: number
  /** 一次回复最少 / 最多几条消息 */
  replyMin?: number
  replyMax?: number
  allowProactive?: boolean
  /** 这条会话：玩家多少分钟没回，角色会主动发消息；空则用全局设置 */
  proactiveMinutes?: number
  /** 上次主动发消息的时间，避免重复触发 */
  proactiveLastAt?: number
  /** 把现实时间写进提示词 */
  realTime?: boolean
  voiceEnabled?: boolean
  /** 本短信会话里不注入的世界书条目 id（仅影响短信，不改世界书 App 里的总开关） */
  smsWorldOff?: string[]
  ownerId?: string
  adminIds?: string[]
  titles?: Record<string, string>
  /** 玩家自定义群头像。空则用成员头像拼接 */
  groupAvatar?: string
  createdAt: number
  updatedAt: number
}

export interface ContactFolder {
  id: string
  name: string
  charIds: string[]
}

export type MessageRole = 'user' | 'assistant' | 'system'
export type MessageKind = 'text' | 'system' | 'image' | 'sticker' | 'redpacket' | 'transfer' | 'party' | 'anon' | 'music' | 'call' | 'voice' | 'gift'

export interface ChatMessage {
  id: string
  chatId: string
  role: MessageRole
  kind: MessageKind
  content: string
  charId: string | null
  createdAt: number
  status: 'sent' | 'read' | 'failed'
  /** 引用的消息 id */
  quoteOf?: string | null
  /** 引用预览文案 */
  quoteText?: string | null
  /** 收藏 */
  starred?: boolean
  /** 软删除 */
  hidden?: boolean
}

export interface Group {
  id: string
  name: string
  memberIds: string[]
  createdAt: number
}

export type SceneLocation =
  | 'home'
  | 'cafe'
  | 'street'
  | 'station'
  | 'school'
  | 'office'
  | 'other'

export interface Scene {
  id: string
  location: SceneLocation | string
  present: string[]
  mode: 'together'
  startedAt: number
  /** 包含 'user' */
  participants: string[]
}

export interface IdentitySpaceState {
  id: 'current'
  currentScene: Scene | null
  /** 正在远程聊天的角色 */
  remoteChats: string[]
  history: Scene[]
}

export interface AppPermission {
  id: string
  charId: string
  appId: string
  granted: boolean
  canSee: boolean
  canRead: boolean
  canInteract: boolean
  grantedAt: number
  revokedAt: number | null
}

export type NotifyLevel = 'all' | 'important' | 'mute'

export interface NotifyPref {
  charId: string
  level: NotifyLevel
}

export type PlayerEventType =
  | 'search'
  | 'open_app'
  | 'close_app'
  | 'read_message'
  | 'send_message'
  | 'delete_char'
  | 'view_moment'
  | 'screenshot'
  | 'change_remark'
  | 'block'
  | 'transfer'
  | 'switch_identity'
  | 'import_char'
  | 'permission_revoked'
  | 'fourth_wall'

export interface PlayerEvent {
  id: string
  type: PlayerEventType
  app: string
  time: number
  identityId: string
  query?: string
  duration?: number
  meta?: Record<string, string | number | boolean | null>
}

export interface PromptBlock {
  identifier: string
  name: string
  role: 'system' | 'user' | 'assistant'
  content: string
  enabled: boolean
}

export interface PresetData {
  temperature: number
  top_p: number
  frequency_penalty: number
  presence_penalty: number
  prompts: PromptBlock[]
}

export interface Preset {
  id: string
  name: string
  description: string
  author: string
  version: string
  type: 'character' | 'world' | 'system' | 'theme'
  data: PresetData
  tags: string[]
}

export interface ThemeColors {
  primary: string
  secondary: string
  background: string
  surface: string
  text: string
  textSecondary: string
  accent: string
  success: string
  warning: string
  error: string
}

export interface Theme {
  id: string
  name: string
  colors: ThemeColors
  radius: { sm: string; md: string; lg: string; xl: string }
  shadow: { sm: string; md: string; lg: string }
  font: { body: string; display: string }
}

export type AIProvider = 'openai' | 'claude' | 'ollama' | 'webllm'

/** 只走 OpenAI 兼容接口。旧数据里可能还留着 provider。 */
export interface ApiProfile {
  id: string
  name: string
  endpoint: string
  model: string
  /** AES-GCM 密文，不明文落库 */
  encryptedKey: string
  /** 拉取并选择模型、保存之后才为 true */
  ready: boolean
  updatedAt: number
  provider?: AIProvider
}

export type ApiConfig = ApiProfile

export interface ApiProfileView {
  id: string
  name: string
  endpoint: string
  model: string
  hasKey: boolean
  ready: boolean
}

export type ProactiveLevel = 'off' | 'low' | 'mid' | 'high'

export interface PrivacySettings {
  enabled: boolean
  /** 锁屏密码哈希，不明文 */
  hash: string
  appLocks: Record<string, boolean>
  /** 各应用独立密码哈希 */
  appHashes: Record<string, string>
}

export interface BackupSettings {
  enabled: boolean
  /** 每隔多少小时提醒备份一次 */
  intervalHours: number
  lastSavedAt: number
  lastRemindedAt: number
}

export type DecorCorner = 'tl' | 'tr' | 'bl' | 'br'

export interface DecorCard {
  id: string
  page: 1 | 2 | 3 | 4
  corner: DecorCorner
  image: string
  tilt: number
}

export interface HomeLayout {
  page3: boolean
  page4: boolean
  decors: DecorCard[]
}

export interface MinimaxVoice {
  id: string
  name: string
}

export interface MinimaxSettings {
  endpoint: string
  groupId: string
  encryptedKey: string
  model: string
  /** 默认角色音色 */
  voiceId: string
  /** 我的音色（用户语音条） */
  userVoiceId: string
  /** 拉取到的平台音色列表 */
  fetchedVoices: MinimaxVoice[]
  /** 音色列表对应的账号（endpoint|groupId|密钥尾） */
  voiceAccountTag?: string
  ready: boolean
}

export type PresetMode = 'sms' | 'offline' | 'side' | 'create' | 'table' | 'star' | 'forum'

export interface AppSettings {
  id: 'global'
  activeIdentityId: string
  themeId: string
  activePresetId: string
  /** 短信、线下、番外、创作、桌游等各自用哪一套 */
  modePresets: Record<PresetMode, string>
  fourthWall: boolean
  /** @deprecated 旧版档位，迁移到 proactiveMinutes */
  proactive?: ProactiveLevel
  /** 玩家多少分钟没回消息，角色会主动发一条；0 表示关闭 */
  proactiveMinutes: number
  /** 手动免打扰 */
  dnd: boolean
  /** 是否启用免打扰时段 */
  quietHours: boolean
  dndStart: string
  dndEnd: string
  banner: boolean
  sound: boolean
  vibration: boolean
  activeApiId: string
  installedApps: string[]
  /** appId -> emoji 或图片 data URL */
  appIcons: Record<string, string>
  privacy: PrivacySettings
  backup: BackupSettings
  home: HomeLayout
  minimax: MinimaxSettings
}

export type AppCategory = 'life' | 'create' | 'social' | 'fun' | 'explore' | 'story'

export interface AppManifest {
  id: string
  name: string
  icon: string
  category: AppCategory
  version: string
  description: string
  permissions: string[]
  dataSchema: Record<string, unknown>
  ui: Record<string, unknown>
  charHooks: {
    onOpen?: string
    onRecord?: string
    onClose?: string
  }
  interactions: Array<{
    trigger: string
    charReaction: string
  }>
}

export interface MarketListing {
  id: string
  name: string
  category: AppCategory
  description: string
  status: 'soon' | 'ready'
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIRequest {
  messages: AIMessage[]
  temperature?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  maxTokens?: number
  timeoutMs?: number
}

export interface AIResponse {
  content: string
  model: string
  provider: AIProvider
}

export interface Notice {
  id: string
  kind: 'toast' | 'message'
  title: string
  body: string
  appId: string
  identityId: string
  chatId?: string
  charId?: string
  priority: number
  createdAt: number
}

export interface ApiMeta {
  provider: 'openai'
  id: string
  name: string
  endpoint: string
  model: string
  hasKey: boolean
  ready: boolean
}
