import { SCENE_HOLD } from '../data/officialPresets.ts'
import { loreEntries } from '../lib/sillytavern.ts'
import { uid } from '../lib/id.ts'
import { storage } from '../storage/StorageService.ts'
import type { AIMessage, Character, Identity, Lorebook, LorebookEntry, Preset } from '../types/index.ts'
import { moduleAdapter } from '../lib/ask.ts'
import { stripReasoning } from '../lib/reasoning.ts'

export type StoryMode = 'offline' | 'side' | 'jiushi'

export interface StoryLine {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  /** 本段在场角色，供主线短信读取；旧存档按场景中的明确姓名推断。 */
  participantIds?: string[]
}

export interface StorySummary {
  id: string
  kind: 'small' | 'big'
  text: string
  /** 覆盖到第几条（不含） */
  upTo: number
  createdAt: number
}

export interface StoryPersona {
  name: string
  persona: string
}

export interface StorySave {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  lines: StoryLine[]
  summaries: StorySummary[]
  /** 番外：这一档的主角 */
  charId?: string
  charIds?: string[]
  summaryError?: string
  /** 番外：这一档里玩家是谁，不跟主线身份走 */
  persona?: StoryPersona
  /** 番外：选中哪些角色的世界书 */
  bookCharIds?: string[]
  /** 番外：单独导入进这一档的世界书 */
  books?: Lorebook[]
}

export interface SaveIndexRow {
  id: string
  name: string
  updatedAt: number
  charId?: string
  preview: string
  count: number
}

export interface RegexRule {
  id: string
  name: string
  find: string
  flags: string
  replace: string
  /** display 只改显示，prompt 只改发给模型的内容 */
  target: 'display' | 'prompt' | 'both'
  roles: 'assistant' | 'user' | 'all'
  enabled: boolean
  /** 绑定角色；空则对该模式全局生效 */
  charId?: string
  /** 从角色卡导入，重新同步时会替换同角色的导入项 */
  cardImport?: boolean
}

export interface ReadingStyle {
  layout: 'bubble' | 'novel'
  font: 'sans' | 'serif' | 'kai'
  fontSize: number
  lineHeight: number
  background: string
  backgroundImage: string
  quoteColor: string
  paper: string
  /** 自定义 CSS，作用于线下/番外界面选择器 */
  customCss: string
}

export interface StoryConfig {
  activeSaveId: string
  reading: ReadingStyle
  regex: RegexRule[]
  useCardRegex: boolean
  renderHtml: boolean
  statusPrompt: string
  /** 最近多少轮保留原文，更早的只读摘要 */
  keepRounds: number
  /** 线下额外发送开场、示例对白和角色卡指令；默认不扩大这部分请求范围。 */
  includeCardExtras: boolean
  autoSummary: boolean
  /** 攒够多少轮旧对话自动写一条小总结 */
  summaryEvery: number
  /** 单次回复正文字数下限（不计 HTML 标签） */
  replyCharsMin: number
  /** 单次回复正文字数上限 */
  replyCharsMax: number
}

export const FONT_STACK: Record<ReadingStyle['font'], string> = {
  sans: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
  serif: '"Songti SC", "Noto Serif SC", "SimSun", serif',
  kai: '"Kaiti SC", "STKaiti", "KaiTi", serif',
}

export const DEFAULT_READING: ReadingStyle = {
  layout: 'novel',
  font: 'sans',
  fontSize: 15,
  lineHeight: 1.85,
  background: '',
  backgroundImage: '',
  quoteColor: '#C76B86',
  paper: 'rgba(255,255,255,0.86)',
  customCss: '',
}

export const STORY_CSS_PREFIX: Record<StoryMode, string> = {
  offline: 'offline',
  side: 'side',
  jiushi: 'side',
}

/** 生成线下/番外各自的 CSS 类名 */
export function storyCssClass(mode: StoryMode, part: string, extra = ''): string {
  const base = `${STORY_CSS_PREFIX[mode]}-${part}`
  return extra ? `${base} ${extra}` : base
}

/** 线下专用选择器（前缀 offline-） */
export const OFFLINE_CSS_SELECTORS = [
  { selector: '.offline-shell', desc: '线下整页外层（含背景）' },
  { selector: '.offline-header', desc: '顶部标题栏' },
  { selector: '.offline-scroll', desc: '消息滚动区域' },
  { selector: '.offline-msg', desc: '单条消息外层' },
  { selector: '.offline-msg.is-mine', desc: '玩家发送的消息' },
  { selector: '.offline-msg.is-theirs', desc: '剧情/角色回复' },
  { selector: '.offline-bubble', desc: '消息气泡容器' },
  { selector: '.offline-bubble.is-mine', desc: '玩家气泡' },
  { selector: '.offline-bubble.is-theirs', desc: '剧情气泡' },
  { selector: '.offline-prose', desc: '纯文本段落' },
  { selector: '.offline-html-frame', desc: 'HTML 渲染 iframe' },
  { selector: '.offline-empty', desc: '空状态提示卡片' },
  { selector: '.offline-composer', desc: '底部输入区' },
  { selector: '.offline-composer-input', desc: '输入框' },
  { selector: '.offline-send', desc: '发送按钮' },
] as const

/** 番外专用选择器（前缀 side-） */
export const SIDE_CSS_SELECTORS = [
  { selector: '.side-shell', desc: '番外整页外层（含背景）' },
  { selector: '.side-header', desc: '顶部标题栏' },
  { selector: '.side-scroll', desc: '消息滚动区域' },
  { selector: '.side-msg', desc: '单条消息外层' },
  { selector: '.side-msg.is-mine', desc: '玩家发送的消息' },
  { selector: '.side-msg.is-theirs', desc: '剧情/角色回复' },
  { selector: '.side-bubble', desc: '消息气泡容器' },
  { selector: '.side-bubble.is-mine', desc: '玩家气泡' },
  { selector: '.side-bubble.is-theirs', desc: '剧情气泡' },
  { selector: '.side-prose', desc: '纯文本段落' },
  { selector: '.side-html-frame', desc: 'HTML 渲染 iframe' },
  { selector: '.side-empty', desc: '空状态提示卡片' },
  { selector: '.side-composer', desc: '底部输入区' },
  { selector: '.side-composer-input', desc: '输入框' },
  { selector: '.side-send', desc: '发送按钮' },
] as const

export const STORY_CSS_SELECTORS: Record<StoryMode, readonly { selector: string; desc: string }[]> = {
  offline: OFFLINE_CSS_SELECTORS,
  side: SIDE_CSS_SELECTORS,
  jiushi: SIDE_CSS_SELECTORS,
}

export const STORY_CSS_TEMPLATES: Record<StoryMode, { name: string; css: string }> = {
  offline: {
    name: '线下 · 半糖薄荷',
    css: `.offline-shell {
  background: linear-gradient(180deg, #F4FBF7 0%, #FBF7F4 55%, #E7F4EE 100%) !important;
}
.offline-header {
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 6px 16px rgba(95, 174, 147, 0.08);
  border-radius: 0 0 22px 22px;
  margin: 0 8px;
}
.offline-bubble.is-theirs {
  background: rgba(255, 255, 255, 0.9) !important;
  border: 1px solid rgba(95, 174, 147, 0.2);
  box-shadow: 0 8px 20px rgba(120, 80, 100, 0.06);
  border-radius: 22px 22px 22px 8px !important;
}
.offline-bubble.is-mine {
  background: linear-gradient(135deg, #D5F0E4, #F4FBF7) !important;
  box-shadow: 0 6px 14px rgba(95, 174, 147, 0.22);
  border-radius: 20px 20px 6px 20px !important;
}
.offline-empty {
  background: rgba(255, 255, 255, 0.92) !important;
  border: 1px dashed rgba(95, 174, 147, 0.35);
  box-shadow: 0 10px 24px rgba(120, 80, 100, 0.07);
}
.offline-composer {
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(8px);
  border-radius: 24px 24px 0 0;
  box-shadow: 0 -8px 24px rgba(95, 174, 147, 0.06);
}
.offline-composer-input {
  background: #fff;
  border-radius: 18px;
  padding: 8px 12px;
  box-shadow: 0 4px 10px rgba(120, 80, 100, 0.06);
}
.offline-send {
  background: #F3A8BA !important;
  box-shadow: 0 4px 12px rgba(243, 168, 186, 0.45) !important;
}`,
  },
  side: {
    name: '番外 · 半糖薰衣草',
    css: `.side-shell {
  background: linear-gradient(180deg, #F6F3FC 0%, #FBF7F4 48%, #FFF1F5 100%) !important;
}
.side-header {
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 6px 16px rgba(138, 114, 196, 0.1);
  border-radius: 0 0 22px 22px;
  margin: 0 8px;
}
.side-bubble.is-theirs {
  background: rgba(255, 255, 255, 0.94) !important;
  border: 1px solid rgba(201, 182, 232, 0.35);
  box-shadow: 0 8px 22px rgba(138, 114, 196, 0.12);
  border-radius: 22px 22px 8px 22px !important;
}
.side-bubble.is-mine {
  background: linear-gradient(135deg, #F8D0DC, #E6DDF8) !important;
  color: #5a3a4a;
  box-shadow: 0 6px 14px rgba(243, 168, 186, 0.28);
  border-radius: 20px 20px 6px 20px !important;
}
.side-empty {
  background: linear-gradient(135deg, rgba(255,255,255,0.94), rgba(246,243,252,0.96)) !important;
  border: 1px solid rgba(201, 182, 232, 0.32);
  box-shadow: 0 10px 24px rgba(138, 114, 196, 0.1);
}
.side-composer {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(8px);
  border-radius: 24px 24px 0 0;
  box-shadow: 0 -8px 24px rgba(138, 114, 196, 0.08);
}
.side-composer-input {
  background: #fff;
  border-radius: 18px;
  padding: 8px 12px;
  box-shadow: 0 4px 10px rgba(138, 114, 196, 0.08);
}
.side-send {
  background: linear-gradient(135deg, #F3A8BA, #C9B6E8) !important;
  box-shadow: 0 4px 12px rgba(138, 114, 196, 0.35) !important;
}`,
  },
  jiushi: {
    name: '旧世 · 宣纸',
    css: `.side-shell {
  background: linear-gradient(180deg, #F5F0E6 0%, #FBF7F0 50%, #EDE4D3 100%) !important;
}
.side-header {
  backdrop-filter: blur(10px);
  background: rgba(255, 252, 245, 0.88);
  box-shadow: 0 6px 16px rgba(120, 90, 60, 0.08);
}
.side-bubble.is-theirs {
  background: rgba(255, 252, 245, 0.95) !important;
  border: 1px solid rgba(120, 90, 60, 0.15);
  border-radius: 20px 20px 20px 6px !important;
}
.side-bubble.is-mine {
  background: linear-gradient(135deg, #E8DCC8, #F5F0E6) !important;
  border-radius: 18px 18px 6px 18px !important;
}
.side-prose {
  font-family: "Songti SC", "Noto Serif SC", "SimSun", serif !important;
}`,
  },
}

export const DEFAULT_CONFIG: StoryConfig = {
  activeSaveId: '',
  reading: DEFAULT_READING,
  regex: [],
  useCardRegex: true,
  renderHtml: true,
  statusPrompt: '',
  keepRounds: 12,
  includeCardExtras: false,
  autoSummary: true,
  summaryEvery: 8,
  replyCharsMin: 800,
  replyCharsMax: 1500,
}

export const STATUS_EXAMPLE = {
  prompt: '每次回复的最后，另起一行输出状态栏，格式固定为：\n<status>时间|地点|在场的人|{{user}}此刻的心情</status>\n状态栏只写短词，不要解释。',
  rule: {
    name: '状态栏美化',
    find: '<status>([^|<]*)\\|([^|<]*)\\|([^|<]*)\\|([^<]*)</status>',
    flags: 'g',
    replace:
      '<style>.st{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:10px;font-size:12px}.st div{background:linear-gradient(135deg,#FFE3EE,#EFE6FF);border-radius:14px;padding:6px 10px;color:#6b4a5a}.st b{display:block;font-size:10px;opacity:.6;font-weight:500}</style><div class="st"><div><b>时间</b>$1</div><div><b>地点</b>$2</div><div><b>在场</b>$3</div><div><b>心情</b>$4</div></div>',
    target: 'display' as const,
    roles: 'assistant' as const,
  },
}

function bagKeys(id: string) {
  return { index: 'story_index', config: 'story_config', save: `story_save_${id}` }
}

export async function loadConfig(namespace: string): Promise<StoryConfig> {
  const raw = await storage.getBag<
    Partial<StoryConfig & { maxTokens?: number; maxTokensMin?: number; maxTokensMax?: number }>
  >(namespace, 'story_config')
  let replyCharsMin = raw?.replyCharsMin ?? DEFAULT_CONFIG.replyCharsMin
  let replyCharsMax = raw?.replyCharsMax ?? DEFAULT_CONFIG.replyCharsMax
  if (replyCharsMin > replyCharsMax) [replyCharsMin, replyCharsMax] = [replyCharsMax, replyCharsMin]
  const { maxTokens: _legacy, maxTokensMin: _tokMin, maxTokensMax: _tokMax, ...rest } = raw ?? {}
  return {
    ...DEFAULT_CONFIG,
    ...rest,
    replyCharsMin,
    replyCharsMax,
    reading: { ...DEFAULT_READING, ...(raw?.reading ?? {}) },
  }
}

export async function saveConfig(namespace: string, config: StoryConfig): Promise<void> {
  await storage.setBag(namespace, 'story_config', config)
}

export async function listSaves(namespace: string): Promise<SaveIndexRow[]> {
  const rows = (await storage.getBag<SaveIndexRow[]>(namespace, 'story_index')) ?? []
  return [...rows].sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function loadSave(namespace: string, id: string): Promise<StorySave | null> {
  return storage.getBag<StorySave>(namespace, bagKeys(id).save)
}

export async function putSave(namespace: string, save: StorySave): Promise<StorySave> {
  const next = { ...save, updatedAt: Date.now() }
  await storage.setBag(namespace, bagKeys(save.id).save, next)
  const rows = (await storage.getBag<SaveIndexRow[]>(namespace, 'story_index')) ?? []
  const last = next.lines[next.lines.length - 1]
  const row: SaveIndexRow = { id: next.id, name: next.name, updatedAt: next.updatedAt, charId: next.charId, preview: last ? last.content.replace(/<[^>]+>/g, '').slice(0, 60) : '', count: next.lines.length }
  await storage.setBag(namespace, 'story_index', [row, ...rows.filter((item) => item.id !== next.id)])
  return next
}

export async function deleteSave(namespace: string, id: string): Promise<void> {
  await storage.deleteBag(namespace, bagKeys(id).save)
  const rows = (await storage.getBag<SaveIndexRow[]>(namespace, 'story_index')) ?? []
  await storage.setBag(namespace, 'story_index', rows.filter((item) => item.id !== id))
}

export function newSave(name: string, extra: Partial<StorySave> = {}): StorySave {
  return { id: uid('save'), name, createdAt: Date.now(), updatedAt: Date.now(), lines: [], summaries: [], ...extra }
}

export function line(role: StoryLine['role'], content: string): StoryLine {
  return { id: uid('line'), role, content, createdAt: Date.now() }
}

/** 支持 `/pattern/flags` 和单独填 flags 两种写法。 */
function compile(rule: RegexRule): RegExp | null {
  try {
    const slashed = /^\/([\s\S]+)\/([dgimsuvy]*)$/.exec(rule.find.trim())
    if (slashed) return new RegExp(slashed[1] ?? '', slashed[2] || 'g')
    return new RegExp(rule.find, rule.flags || 'g')
  } catch {
    return null
  }
}

export function regexValid(rule: RegexRule): boolean {
  return Boolean(rule.find.trim()) && compile(rule) !== null
}

export function applyRegex(text: string, rules: RegexRule[], where: 'display' | 'prompt', role: StoryLine['role']): string {
  let out = text
  for (const rule of rules) {
    if (!rule.enabled || !rule.find.trim()) continue
    if (rule.target !== 'both' && rule.target !== where) continue
    if (rule.roles !== 'all' && rule.roles !== role) continue
    const pattern = compile(rule)
    if (!pattern) continue
    out = out.replace(pattern, rule.replace.replaceAll('{{match}}', '$&'))
  }
  return out
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 认 SillyTavern 导出的正则脚本，单个或数组都行。 */
export function regexFromUnknown(raw: unknown): RegexRule[] {
  const list = Array.isArray(raw) ? raw : isRecord(raw) && Array.isArray(raw.regex_scripts) ? raw.regex_scripts : [raw]
  const rules: RegexRule[] = []
  for (const item of list) {
    if (!isRecord(item)) continue
    const find = typeof item.findRegex === 'string' ? item.findRegex : typeof item.find === 'string' ? item.find : ''
    if (!find) continue
    const placement = Array.isArray(item.placement) ? item.placement : []
    const user = placement.includes(1)
    const ai = placement.includes(2) || placement.length === 0
    rules.push({
      id: uid('rx'),
      name: typeof item.scriptName === 'string' ? item.scriptName : typeof item.name === 'string' ? item.name : '导入的正则',
      find,
      flags: typeof item.flags === 'string' ? item.flags : '',
      replace: typeof item.replaceString === 'string' ? item.replaceString : typeof item.replace === 'string' ? item.replace : '',
      target: item.promptOnly === true ? 'prompt' : item.markdownOnly === true ? 'display' : 'both',
      roles: user && ai ? 'all' : user ? 'user' : 'assistant',
      enabled: item.disabled !== true && item.enabled !== false,
    })
  }
  return rules
}

/** 从角色卡 extensions / rawCard 里取出 regex_scripts */
export function regexScriptsFromCharacter(character: Character): unknown {
  const ext = character.extensions
  if (Array.isArray(ext.regex_scripts) && ext.regex_scripts.length > 0) return ext.regex_scripts
  const raw = character.rawCard
  if (isRecord(raw) && isRecord(raw.data) && isRecord(raw.data.extensions)) {
    const scripts = raw.data.extensions.regex_scripts
    if (Array.isArray(scripts) && scripts.length > 0) return scripts
  }
  if (isRecord(raw) && Array.isArray(raw.regex_scripts)) return raw.regex_scripts
  return []
}

export function cardRegex(character: Character | undefined): RegexRule[] {
  if (!character) return []
  return regexFromUnknown(regexScriptsFromCharacter(character)).map((rule) => ({
    ...rule,
    id: `card-${character.id}-${rule.name}`,
  }))
}

/** 导入角色时，把卡内正则写入线下/番外 story_config（绑定该角色） */
export async function importCharacterRegex(namespace: string, character: Character): Promise<number> {
  const rules = regexFromUnknown(regexScriptsFromCharacter(character)).map((rule) => ({
    ...rule,
    id: uid('rx'),
    charId: character.id,
    cardImport: true,
  }))
  if (rules.length === 0) return 0
  const config = await loadConfig(namespace)
  const kept = config.regex.filter((item) => !(item.charId === character.id && item.cardImport))
  await saveConfig(namespace, {
    ...config,
    regex: [...rules, ...kept],
    useCardRegex: config.useCardRegex !== false,
  })
  return rules.length
}

/** 认 SillyTavern 世界书（entries 为对象，字段 key / content / disable / order）。 */
export function lorebookFromUnknown(raw: unknown, fallbackName: string): Lorebook | null {
  if (!isRecord(raw)) return null
  const source = isRecord(raw.data) && raw.data.entries ? raw.data : raw
  const entries = source.entries
  const values = Array.isArray(entries) ? entries : isRecord(entries) ? Object.values(entries) : null
  if (!values) return null
  const out: LorebookEntry[] = []
  for (const item of values) {
    if (!isRecord(item) || typeof item.content !== 'string') continue
    const keys = Array.isArray(item.key) ? item.key : Array.isArray(item.keys) ? item.keys : []
    out.push({
      keys: keys.filter((key): key is string => typeof key === 'string'),
      content: item.content,
      enabled: item.disable !== true && item.enabled !== false,
      constant: item.constant === true,
      insertion_order: typeof item.order === 'number' ? item.order : typeof item.insertion_order === 'number' ? item.insertion_order : 100,
      name: typeof item.comment === 'string' ? item.comment : typeof item.name === 'string' ? item.name : undefined,
    })
  }
  if (out.length === 0) return null
  return { name: typeof source.name === 'string' && source.name ? source.name : fallbackName, entries: out }
}

function loreText(books: Lorebook[], recent: string, limit: number): string {
  const haystack = recent.toLowerCase()
  return books
    .flatMap((book) => loreEntries(book))
    .filter((entry) => entry.enabled !== false && entry.content.trim())
    .filter((entry) => entry.constant || (entry.keys ?? []).some((key) => key && haystack.includes(key.toLowerCase())))
    .sort((a, b) => (a.insertion_order ?? 0) - (b.insertion_order ?? 0))
    .map((entry) => entry.content.trim())
    .join('\n')
    .slice(0, limit)
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\u0000/g, '').trim()
  if (clean.length <= max) return clean
  return `${clean.slice(0, max)}…`
}

function clipTail(text: string, max: number): string {
  const clean = text.replace(/\u0000/g, '').trim()
  if (clean.length <= max) return clean
  return `…\n${clean.slice(-max)}`
}

function promptLine(text: string, limit = 0): string {
  const plain = text
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!limit || plain.length <= limit) return plain || '……'
  const head = Math.floor(limit / 3)
  return `${plain.slice(0, head)}\n（中段省略，以下为本段结尾）\n${plain.slice(-(limit - head))}`
}

function card(character: Character, extras = true): string {
  const parts = [`【${character.name} · 角色ID：${character.id}】${character.nickname ? `（昵称 ${character.nickname}，与 ${character.name} 是同一人）` : ''}`]
  if (character.description.trim()) parts.push(character.description.trim())
  if (character.personality.trim()) parts.push(`性格：${character.personality.trim()}`)
  if (extras && character.scenario.trim()) parts.push(`背景情境（不是每轮必须重演的开场）：${character.scenario.trim()}`)
  if (extras && character.mesExample.trim()) parts.push(`说话的样子（仅供参考，不是本次已经发生的对话，不照抄）：\n${character.mesExample.trim()}`)
  return parts.join('\n')
}

function fill(text: string, charName: string, userName: string): string {
  return text.replaceAll('{{char}}', charName).replaceAll('{{user}}', userName)
}

/** Resolve aliases without treating a shorter name or a shared nickname as another person. */
function namedStoryChars(chars: Character[], text: string): Character[] {
  const owners = new Map<string, Character[]>()
  for (const person of chars) for (const alias of new Set([person.name, person.nickname, person.remark].map(name => name?.trim()).filter((name): name is string => Boolean(name)))) {
    owners.set(alias, [...(owners.get(alias) ?? []), person])
  }
  const hits: Array<{ start: number; end: number; person: Character }> = []
  for (const [alias, people] of owners) {
    if (people.length !== 1) continue
    let start = text.indexOf(alias)
    while (start !== -1) {
      const before = text.slice(Math.max(0, start - 16), start)
      // Mentioning someone in a conversation or on the phone does not bring them into the room.
      if (!/(?:提到|说起|想起|听说|聊起|关于|给|收到|知道|认识).{0,4}$/.test(before) || /(?:叫|邀请|找|见).{0,4}$/.test(before)) hits.push({ start, end: start + alias.length, person: people[0]! })
      start = text.indexOf(alias, start + alias.length)
    }
  }
  const longest = hits.filter(hit => !hits.some(other => other !== hit && other.start <= hit.start && other.end >= hit.end && other.end - other.start > hit.end - hit.start))
  return [...new Map(longest.sort((a, b) => a.start - b.start).map(hit => [hit.person.id, hit.person])).values()]
}

/** Continue the recorded cast; references and dialogue examples are not scene changes. */
export function focusChars(chars: Character[], save: StorySave, extra = ''): Character[] {
  let cast: Character[] = []
  for (const item of [...save.lines, ...(extra ? [{ role: 'user' as const, content: extra }] : [])]) {
    if ('participantIds' in item && item.participantIds !== undefined) {
      cast = item.participantIds.map(id => chars.find(person => person.id === id)).filter((person): person is Character => Boolean(person))
      continue
    }
    const plain = promptLine(item.content)
    const text = item.role === 'assistant' ? plain.replace(/[“「"][^”」"\n]*[”」"]/g, '') : plain
    const people = namedStoryChars(chars, text)
    if (item.role === 'user' && people.length) {
      const changedScene = /(?:去找|去见|来到|走进|只剩|单独|转场|场景切换|和.{0,30}(?:去|回))/.test(text)
      const entering = /(?:来了|来啦|进来|进门|走来|到场|加入|邀请|叫.{0,20}来|一起坐)/.test(text)
      cast = changedScene || !cast.length ? people : entering ? [...new Map([...cast, ...people].map(person => [person.id, person])).values()] : cast
    } else if (!cast.length) cast = people
    if (item.role === 'user') cast = cast.filter(person => {
      const escaped = person.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return !new RegExp(`${escaped}(?:已经|已|先|就)?(?:离开了|离开现场|走了|回去了|不在场|没来)`).test(text)
    })
  }
  return cast
}

function memoryBlock(save: StorySave): { text: string; covered: number } {
  const big = [...save.summaries].reverse().find((item) => item.kind === 'big')
  const smalls = save.summaries.filter((item) => item.kind === 'small' && item.upTo > (big?.upTo ?? 0))
  const covered = Math.max(big?.upTo ?? 0, ...smalls.map((item) => item.upTo), 0)
  const bits: string[] = []
  if (big) bits.push(`【前情大总结】\n${stripReasoning(big.text)}`)
  if (smalls.length) bits.push(`【之后的小总结】\n${smalls.map((item) => `- ${stripReasoning(item.text)}`).join('\n')}`)
  return { text: bits.join('\n\n'), covered }
}

export function contextStart(save: StorySave, keepRounds: number): number {
  const rounds = Number.isFinite(keepRounds) ? Math.max(1, Math.floor(keepRounds)) : DEFAULT_CONFIG.keepRounds
  return Math.max(0, save.lines.length - rounds * 2)
}

const OFFLINE_RULE = `这是线下：面对面的真实场景，不是手机聊天。
你是这个世界的叙述者，同时扮演玩家实际遇到的角色。角色姓名、昵称、ID、人设分别对应同一个人，不能串换外貌、性格、身份、经历或对白归属。仅仅提到、想起、聊天讨论某人，或给某人发短信，不代表这个人已在现场。只有明确见面、入场或玩家主动转换场景时才改变在场人物。
严格从上一段末尾的时间、地点、人物和动作结果继续。已经完成的送达、进门、上车、吃饭、交接物品、拥抱、解释等不是待办，不要再次安排同一事件；除非玩家明确要求回忆、重来或再次执行。角色背景情境、开场和示例对白只是设定，不能覆盖当前剧情进度。尚未完成的动作和约定保持未完成，不要擅自补成事实。
用第三人称叙述加角色对白，对白用“”。可以写动作、神态、环境。不要替 {{user}} 说话或替 {{user}} 做决定，停在把选择交还给 {{user}} 的地方。`

const SIDE_RULE = `这是番外：一条独立的世界线，和主线手机里的事无关，不要提主线。
你扮演 {{char}}，也可以描写场景和其他路人。用第三人称叙述加对白，对白用“”。不要替 {{user}} 说话或替 {{user}} 做决定。`

const JIUSHI_RULE = `这是旧世入幕：玩家穿书在此世演绎，和主线现代短信无关，不要提手机、微信、App。
你扮演 {{char}}，也可写场景与路人。用古风/半文白，第三人称叙述加对白，对白用“”。不要替 {{user}} 说话或替 {{user}} 做决定。`

export function sideLike(mode: StoryMode): boolean {
  return mode === 'side' || mode === 'jiushi'
}

export function plainStoryLength(text: string): number {
  return unwrapHtmlFence(text).replace(/<[^>]+>/g, '').replace(/\s+/g, '').length
}

export function storyCharRange(charsMin: number, charsMax: number): { lo: number; hi: number; min: number; max: number } {
  const min = Math.min(charsMin, charsMax)
  const max = Math.max(charsMin, charsMax)
  return { lo: Math.floor(min * 0.9), hi: Math.ceil(max * 1.1), min, max }
}

export function buildStoryPrompt(input: {
  mode: StoryMode
  save: StorySave
  config: StoryConfig
  chars: Character[]
  identity: Identity
  preset: Preset | null
  /** 本次额外的指令，比如“继续” */
  nudge?: string
  world?: string
  /** 手机短信互通上下文 */
  smsBridge?: string
  /** 旧世穿书设定等额外系统块 */
  jiushiBlock?: string
}): AIMessage[] {
  const { mode, save, config, chars, identity } = input
  const lead = sideLike(mode) ? chars.find((item) => item.id === save.charId) : undefined
  const userName = sideLike(mode) ? save.persona?.name || identity.name : identity.name
  const userPersona = sideLike(mode) ? save.persona?.persona ?? identity.persona : identity.persona
  const charName = lead?.name ?? '角色们'
  const recent = save.lines.slice(-6).map((item) => item.content).join('\n')
  const systems: string[] = []
  const blocks = (input.preset?.data.prompts ?? []).filter((item) => item.enabled && item.content.trim())
  const renderBlocks = (items: typeof blocks) =>
    items
      .map((item) =>
        fill(item.content, lead?.name ?? charName, userName)
          .replaceAll('{{description}}', clip(lead?.description || '（没有写）', 800))
          .replaceAll('{{personality}}', clip(lead?.personality || '（没有写）', 400))
          .replaceAll('{{scenario}}', clip(lead?.scenario || '（没有写）', 400)),
      )
      .join('\n\n')
  const keptWhole = new Set(['living_people_v2', 'scene_hold'])
  const style = blocks.filter((item) => keptWhole.has(item.identifier))
  const voice = blocks.filter((item) => !keptWhole.has(item.identifier))
  if (voice.length) systems.push(clip(renderBlocks(voice), 1500))
  if (style.length) systems.push(renderBlocks(style))
  if (input.world?.trim()) systems.push(mode === 'offline' ? input.world.trim() : clip(input.world, 800))
  if (input.smsBridge?.trim() && mode !== 'offline') systems.push(clipTail(input.smsBridge, 1200))
  if (input.jiushiBlock?.trim()) systems.push(input.jiushiBlock.trim())
  systems.push(
    fill(mode === 'jiushi' ? JIUSHI_RULE : mode === 'side' ? SIDE_RULE : OFFLINE_RULE, charName, userName),
  )
  const range = storyCharRange(config.replyCharsMin, config.replyCharsMax)
  systems.push(
    `本次回复纯正文（HTML 标签不计入）目标 ${range.min}～${range.max} 汉字，可上下浮动 10%（约 ${range.lo}～${range.hi} 字）。不要为凑字数重复，也不要只写一两句敷衍。`,
  )
  systems.push('正文按自然段书写，段与段之间空一行，对白单独成段。不要把整篇挤在同一行。')
  if (sideLike(mode)) {
    const cast = chars.filter(c => (save.charIds?.length ? save.charIds : [save.charId]).includes(c.id))
    for (const person of cast) {
      systems.push(card(person))
      if (person.systemPrompt.trim()) systems.push(fill(person.systemPrompt, person.name, userName))
    }
    systems.push('参与角色各有独立视角、目的和表达，不必每轮全部发言；不共享未亲眼看见或未获知的信息。')
  }
  systems.push(userPersona.trim() ? `玩家扮演 ${userName}。关于 ${userName}：${clip(userPersona, 400)}` : `玩家扮演 ${userName}。`)
  let books: Lorebook[] = []
  if (mode === 'offline') {
    const roster = chars.map((item) => `${item.name}${item.nickname ? `（昵称 ${item.nickname}）` : ''} · ID：${item.id}`)
    if (roster.length) systems.push(`可供玩家寻找的人物名录（不代表已经在场，不要自动加入现场）：\n${roster.join('\n')}`)
    const focus = focusChars(chars, save, input.nudge)
    if (focus.length) systems.push(`此刻相关的人的完整人物描述与性格：\n\n${focus.map(person => card(person, config.includeCardExtras)).join('\n\n')}`)
    if (focus.length) systems.push(`【本幕人物对应】\n${focus.map(person => `${person.id} = ${person.name}${person.nickname ? ` = ${person.nickname}` : ''}`).join('\n')}\n上述设定各归本人，不把一个人的习惯、关系或秘密挪给另一个人。未明确入场的人不自动出现。`)
    if (config.includeCardExtras) for (const person of focus) if (person.systemPrompt.trim()) systems.push(`【${person.name} 的角色指令，仅适用于本人】\n${fill(person.systemPrompt, person.name, userName)}`)
    books = focus.map((item) => item.characterBook).filter((item): item is Lorebook => Boolean(item))
  } else {
    const picked = chars.filter((item) => (save.bookCharIds ?? []).includes(item.id)).map((item) => item.characterBook)
    books = [...picked.filter((item): item is Lorebook => Boolean(item)), ...(save.books ?? [])]
  }
  const lore = loreText(books, recent, mode === 'offline' ? Number.MAX_SAFE_INTEGER : 800)
  if (lore) systems.push(`世界书（用到才写，不要逐条复述）：\n${lore}`)
  const memory = memoryBlock(save)
  if (memory.text) systems.push(mode === 'offline' ? memory.text : clip(memory.text, 800))
  if (sideLike(mode) && config.statusPrompt.trim()) systems.push(fill(config.statusPrompt.trim(), charName, userName))
  if (mode === 'offline') systems.push('不要输出状态栏，不要写 <status> 标签，不要 HTML 卡片式状态信息。')
  if (mode === 'jiushi') systems.push('可输出 HTML 状态栏（若卡内正则需要）；叙事正文仍用古风/半文白。')
  if (lead?.postHistoryInstructions.trim()) systems.push(fill(lead.postHistoryInstructions, lead.name, userName))
  if (mode === 'offline' && config.includeCardExtras) for (const person of focusChars(chars, save, input.nudge)) {
    if (person.postHistoryInstructions.trim()) systems.push(`【${person.name} 的后置设定，仅适用于本人】\n${fill(person.postHistoryInstructions, person.name, userName)}`)
  }
  if (mode === 'offline' && input.smsBridge?.trim()) systems.push(input.smsBridge.trim())
  systems.push(SCENE_HOLD)

  const scoped = config.regex.filter(rule => !rule.charId || (save.charIds ?? [save.charId]).includes(rule.charId))
  const rules = [...scoped, ...(config.useCardRegex ? (sideLike(mode) ? chars.filter(c => (save.charIds ?? [save.charId]).includes(c.id)).flatMap(cardRegex) : focusChars(chars, save).flatMap(cardRegex)) : [])]
  const messages: AIMessage[] = [{ role: 'system', content: systems.join('\n\n') }]
  for (const item of save.lines.slice(contextStart(save, config.keepRounds))) {
    const content = item.role === 'assistant' ? stripReasoning(item.content) : item.content
    const recentFull = mode === 'offline' && save.lines.indexOf(item) >= save.lines.length - 8
    if (content.trim()) messages.push({ role: item.role, content: promptLine(applyRegex(content, rules, 'prompt', item.role), recentFull ? 0 : 1600) })
  }
  if (input.nudge) messages.push({ role: 'user', content: input.nudge })
  if (mode === 'offline') {
    const last = messages[messages.length - 1]
    if (last?.role === 'user') last.content += '\n\n（叙事接续要求，不写入正文：从上一段最后的动作结果之后推进；已完成的事情不要再次开场重演。按本幕人物对应保持每个人自己的设定和视角，不替玩家行动。）'
  }
  if (mode === 'offline' && input.smsBridge?.trim()) {
    const last = messages[messages.length - 1]
    if (last?.role === 'user') {
      last.content = `${last.content}\n\n（不要写进正文：接续各角色自己知道的短信与线下经历，同一事件以时间较晚的结果为准。玩家刚刚的新动作仍要接住，不要退回已经结束的冲突，也不要共享其他人的私聊。）`
    }
  }
  return messages
}

export function displayRules(mode: StoryMode, config: StoryConfig, chars: Character[], save: StorySave): RegexRule[] {
  const scoped = config.regex.filter((rule) => !rule.charId || rule.charId === save.charId)
  if (!config.useCardRegex) return scoped
  const extra = sideLike(mode) ? chars.filter(c => (save.charIds ?? [save.charId]).includes(c.id)).flatMap(cardRegex) : chars.flatMap(cardRegex)
  return [...scoped, ...extra]
}

export async function writeSummary(save: StorySave, kind: 'small' | 'big', keepRounds: number, mode: StoryMode = 'offline'): Promise<StorySave> {
  void keepRounds
  const adapter = await moduleAdapter(mode)
  const start = memoryBlock(save).covered
  if (kind === 'small') {
    const end = save.lines.length
    const chunk = save.lines.slice(start, end > start ? end : save.lines.length)
    if (chunk.length === 0) throw new Error('还没有需要总结的内容')
    const response = await adapter.complete({
      messages: [
        { role: 'system', content: '把下面剧情整理为 800 字以内的连续性记录。逐一写清人物姓名与身份，谁对谁做了什么；明确区分已完成事件、未完成约定、当前地点与最后动作结果。保留人设相关事实、物品交接和关系变化，不能串换人物、把计划写成完成、把提到的人写成在场。不复述开场，不评价。' },
        { role: 'user', content: chunk.map((item) => `${item.role === 'user' ? '玩家' : '剧情'}：${(item.role === 'assistant' ? stripReasoning(item.content) : item.content).replace(/<[^>]+>/g, '')}`).join('\n') },
      ],
      temperature: 0.3,
      maxTokens: 1600,
    })
    const summary = stripReasoning(response.content)
    if (!summary) throw new Error('总结返回为空，将在下轮重试')
    const upTo = end > start ? end : save.lines.length
    return { ...save, summaries: [...save.summaries, { id: uid('sum'), kind, text: summary, upTo, createdAt: Date.now() }] }
  }
  if (save.summaries.length === 0) throw new Error('先有几条小总结，才能合成大总结')
  const response = await adapter.complete({
    messages: [
      { role: 'system', content: '把下面按时间排列的总结合并成 1600 字以内的前情记录。按人物姓名保留身份、关系和经历归属，区分已完成事件与未完成约定，保留最后地点和动作结果。旧状态被后续改变时以最新结果为准，不能串人、把已完成事项退回待办，或凭空增加事实。' },
      { role: 'user', content: save.summaries.map((item) => `${item.kind === 'big' ? '【大总结】' : '-'} ${stripReasoning(item.text)}`).join('\n') },
    ],
    temperature: 0.3,
    maxTokens: 3200,
  })
  const upTo = Math.max(...save.summaries.map((item) => item.upTo))
  const summary = stripReasoning(response.content)
  if (!summary) throw new Error('总结返回为空，将在下轮重试')
  return { ...save, summaries: [{ id: uid('sum'), kind: 'big', text: summary, upTo, createdAt: Date.now() }] }
}

export function needsSummary(save: StorySave, config: StoryConfig): boolean {
  if (!config.autoSummary) return false
  const covered = memoryBlock(save).covered
  return save.lines.slice(covered).filter(item => item.role === 'assistant').length >= Math.max(1, config.summaryEvery)
}

function storyTemperature(preset: Preset | null): number {
  const raw = preset?.data.temperature
  const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0.9
  return Math.min(0.9, Math.max(0.2, value))
}

/** Preserve assembled context instead of erasing cast and scene endings a second time. */
function fitStoryMessages(messages: AIMessage[]): AIMessage[] {
  const kept = messages.filter(item => item.content.trim()).map(item => ({ ...item, content: item.role === 'assistant' ? stripReasoning(item.content) : item.content }))
  if (kept.length === 0 || kept[kept.length - 1]?.role !== 'user') kept.push({ role: 'user', content: '请接着上一段末尾的动作结果向后推进，不要重新演出已完成的事情。' })
  return kept
}

export function mergeStoryContinuation(previous: string, next: string): string {
  const clean = next.trim()
  if (!clean || previous.includes(clean)) return previous
  for (let size = Math.min(previous.length, clean.length); size >= 12; size--) {
    if (previous.endsWith(clean.slice(0, size))) return `${previous}${clean.slice(size)}`.trimEnd()
  }
  const oldParagraphs = new Set(previous.split(/\n+/).map(text => text.trim()).filter(text => text.length >= 20))
  const fresh = clean.split(/\n+/).filter(text => !oldParagraphs.has(text.trim())).join('\n').trim()
  return fresh ? `${previous.trimEnd()}\n${fresh}` : previous
}

export async function generate(messages: AIMessage[], preset: Preset | null, maxTokens?: number, mode: StoryMode = 'offline'): Promise<string> {
  const adapter = await moduleAdapter(mode)
  const response = await adapter.complete({
    messages: fitStoryMessages(messages),
    temperature: storyTemperature(preset),
    maxTokens: maxTokens ?? 1024,
  })
  const content = ensureStoryBreaks(stripReasoning(response.content))
  if (!content) throw new Error('模型只返回了思考内容，没有剧情正文，请重试或增加输出长度')
  return content
}

/** 模型把整篇写成一行时，按句末补上换行，已经分段或含 HTML 的不动。 */
export function ensureStoryBreaks(text: string): string {
  if (hasHtml(text) || text.includes('\n') || text.length < 40) return text
  return text.replace(/([。！？][”」』]?)/g, '$1\n').replace(/[ \t]*\n[ \t]*/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

export async function generateStoryReply(input: {
  mode?: StoryMode
  messages: AIMessage[]
  preset: Preset | null
  charsMin: number
  charsMax: number
}): Promise<string> {
  const range = storyCharRange(input.charsMin, input.charsMax)
  const budget = Math.min(16384, Math.max(2048, Math.ceil(range.max * 2) + 512))
  let content = await generate(input.messages, input.preset, budget, input.mode)
  let len = plainStoryLength(content)
  if (len >= range.lo && len <= range.hi) return content

  const roundsCap = Math.min(8, Math.max(3, Math.ceil(range.min / 2500)))
  let rounds = 0
  while (len < range.lo && rounds < roundsCap) {
    rounds += 1
    const need = Math.max(120, range.min - len)
    const tail = await generate(
      [
        ...input.messages,
        { role: 'assistant', content },
        {
          role: 'user',
          content: `请紧接上一段末尾自然续写，不要重复已写内容，不要重写。再写约 ${need} 字，让整体接近 ${range.min}～${range.max} 字（可上下浮动 10%）。`,
        },
      ],
      input.preset,
      budget,
      input.mode,
    )
    const merged = mergeStoryContinuation(content, tail)
    if (merged === content) break
    content = merged
    len = plainStoryLength(content)
  }

  return content
}

/** 剥离 AI 回复里常见的 Markdown HTML 代码围栏 */
export function unwrapHtmlFence(text: string): string {
  const trimmed = text.trim()
  const fenced = /^```(?:html|htm)?\s*\r?\n([\s\S]*?)\r?\n```\s*$/i.exec(trimmed)
  if (fenced) return (fenced[1] ?? '').trim()
  return trimmed.replace(/^```(?:html|htm)?\s*\r?\n?/i, '').replace(/\r?\n?```\s*$/i, '').trim()
}

export function hasHtml(text: string): boolean {
  const body = unwrapHtmlFence(text)
  return /<\/?(div|span|p|style|table|details|summary|img|b|i|br|ul|ol|li|h\d|section|font|center|small|strong|em)\b[^>]*>/i.test(body)
}

/** 把夹在标签之间的换行变成 <br>，style / script 里的原样保留。 */
export function htmlBody(text: string): string {
  const kept: string[] = []
  const guarded = unwrapHtmlFence(text).replace(/<(style|script)\b[\s\S]*?<\/\1>/gi, (block) => {
    kept.push(block)
    return `@@MELLOW${kept.length - 1}@@`
  })
  const body = guarded
    .split(/(<[^>]+>)/)
    .map((part) => {
      if (part.startsWith('<')) return part
      const breaks = part.match(/\n/g)?.length ?? 0
      if (part.trim() === '') return breaks ? '<br>'.repeat(Math.min(breaks, 2)) : part
      return part.replace(/\n/g, '<br>')
    })
    .join('')
  return body.replace(/@@MELLOW(\d+)@@/g, (_, index: string) => kept[Number(index)] ?? '')
}

export function frameDoc(id: string, html: string, reading: ReadingStyle, color: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0!important;padding:0!important;background:transparent!important;overflow:hidden!important;min-height:0!important;height:auto!important}body{font-family:${FONT_STACK[reading.font]};font-size:${reading.fontSize}px;line-height:${reading.lineHeight};color:${color};word-break:break-word}body>*:first-child{margin-top:0!important;padding-top:0!important}body>*:last-child{margin-bottom:0!important;padding-bottom:0!important}body>*{max-width:100%;vertical-align:top}br{display:block;margin:0.45em 0}img{max-width:100%;height:auto;display:block;vertical-align:top}</style></head><body>${htmlBody(html)}<script>(function(){var id=${JSON.stringify(id)};function strip(){['html','body'].forEach(function(tag){var el=document.getElementsByTagName(tag)[0];if(!el)return;el.style.margin='0';el.style.padding='0';el.style.minHeight='auto';el.style.height='auto';});document.querySelectorAll('body *').forEach(function(el){if(!el.style)return;var mh=el.style.minHeight||'';var h=el.style.height||'';var pt=el.style.paddingTop||'';var pb=el.style.paddingBottom||'';if(/100vh|100%/.test(mh))el.style.minHeight='auto';if(/100vh|100%/.test(h))el.style.height='auto';if(/\\d+vh/.test(pt))el.style.paddingTop='0';if(/\\d+vh/.test(pb))el.style.paddingBottom='0';if(el.style.position==='fixed'||el.style.position==='absolute'){el.style.position='relative';el.style.inset='auto';}});}function measure(){strip();var kids=Array.from(document.body.children);if(!kids.length)return Math.ceil(document.body.scrollHeight||24);var top=kids[0].getBoundingClientRect().top;var bottom=top;kids.forEach(function(el){var r=el.getBoundingClientRect();if(r.height>0){top=Math.min(top,r.top);bottom=Math.max(bottom,r.bottom);}});return Math.max(24,Math.ceil(bottom-top));}function m(){parent.postMessage({mellowFrame:id,h:measure()},'*');}new ResizeObserver(function(){requestAnimationFrame(m);}).observe(document.body);window.addEventListener('load',m);m();})()</script></body></html>`
}
