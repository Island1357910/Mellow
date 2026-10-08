import { loreEntries } from '../lib/sillytavern.ts'
import { uid } from '../lib/id.ts'
import { storage } from '../storage/StorageService.ts'
import type { AIMessage, Character, Identity, Lorebook, LorebookEntry, Preset } from '../types/index.ts'
import { AIAdapter } from './AIAdapter.ts'

export type StoryMode = 'offline' | 'side'

export interface StoryLine {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
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
}

export const DEFAULT_CONFIG: StoryConfig = {
  activeSaveId: '',
  reading: DEFAULT_READING,
  regex: [],
  useCardRegex: true,
  renderHtml: true,
  statusPrompt: '',
  keepRounds: 12,
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

function card(character: Character): string {
  const parts = [`【${character.name}】${character.nickname ? `（昵称 ${character.nickname}）` : ''}`]
  if (character.description.trim()) parts.push(character.description.trim())
  if (character.personality.trim()) parts.push(`性格：${character.personality.trim()}`)
  if (character.scenario.trim()) parts.push(`情境：${character.scenario.trim()}`)
  if (character.mesExample.trim()) parts.push(`说话的样子（参考，不照抄）：\n${character.mesExample.trim().slice(0, 600)}`)
  return parts.join('\n')
}

function fill(text: string, charName: string, userName: string): string {
  return text.replaceAll('{{char}}', charName).replaceAll('{{user}}', userName)
}

/** 线下：最近几条里被提到的角色，就把他们的完整设定连上。 */
export function focusChars(chars: Character[], save: StorySave, extra = ''): Character[] {
  const recent = `${save.lines.slice(-6).map((item) => item.content).join('\n')}\n${extra}`
  return chars.filter((item) => [item.name, item.nickname, item.remark].some((name) => name && name.trim().length > 0 && recent.includes(name.trim())))
}

function memoryBlock(save: StorySave): { text: string; covered: number } {
  const big = [...save.summaries].reverse().find((item) => item.kind === 'big')
  const smalls = save.summaries.filter((item) => item.kind === 'small' && item.upTo > (big?.upTo ?? 0))
  const covered = Math.max(big?.upTo ?? 0, ...smalls.map((item) => item.upTo), 0)
  const bits: string[] = []
  if (big) bits.push(`【前情大总结】\n${big.text}`)
  if (smalls.length) bits.push(`【之后的小总结】\n${smalls.map((item) => `- ${item.text}`).join('\n')}`)
  return { text: bits.join('\n\n'), covered }
}

export function contextStart(save: StorySave, keepRounds: number): number {
  const { covered } = memoryBlock(save)
  return Math.min(covered, Math.max(0, save.lines.length - keepRounds * 2))
}

const OFFLINE_RULE = `这是线下：面对面的真实场景，不是手机聊天。
你是这个世界的叙述者，同时扮演玩家遇到或想找的每一个角色。玩家说要找谁、去哪里、做什么，就让场景顺着发生；被提到的角色按各自的设定出场、说话、行动。
用第三人称叙述加角色对白，对白用“”。可以写动作、神态、环境。不要替 {{user}} 说话或替 {{user}} 做决定，停在把选择交还给 {{user}} 的地方。`

const SIDE_RULE = `这是番外：一条独立的世界线，和主线手机里的事无关，不要提主线。
你扮演 {{char}}，也可以描写场景和其他路人。用第三人称叙述加对白，对白用“”。不要替 {{user}} 说话或替 {{user}} 做决定。`

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
}): AIMessage[] {
  const { mode, save, config, chars, identity } = input
  const lead = mode === 'side' ? chars.find((item) => item.id === save.charId) : undefined
  const userName = mode === 'side' ? save.persona?.name || identity.name : identity.name
  const userPersona = mode === 'side' ? save.persona?.persona ?? identity.persona : identity.persona
  const charName = lead?.name ?? '角色们'
  const recent = save.lines.slice(-6).map((item) => item.content).join('\n')
  const systems: string[] = []
  const blocks = (input.preset?.data.prompts ?? []).filter((item) => item.enabled && item.content.trim())
  if (blocks.length) {
    systems.push(
      blocks
        .map((item) =>
          fill(item.content, lead?.name ?? charName, userName)
            .replaceAll('{{description}}', lead?.description || '（没有写）')
            .replaceAll('{{personality}}', lead?.personality || '（没有写）')
            .replaceAll('{{scenario}}', lead?.scenario || '（没有写）'),
        )
        .join('\n\n'),
    )
  }
  if (input.world?.trim()) systems.push(input.world.trim())
  if (input.smsBridge?.trim()) systems.push(input.smsBridge.trim())
  systems.push(fill(mode === 'side' ? SIDE_RULE : OFFLINE_RULE, charName, userName))
  const range = storyCharRange(config.replyCharsMin, config.replyCharsMax)
  systems.push(
    `本次回复纯正文（HTML 标签不计入）目标 ${range.min}～${range.max} 汉字，可上下浮动 10%（约 ${range.lo}～${range.hi} 字）。不要为凑字数重复，也不要只写一两句敷衍。`,
  )
  if (mode === 'side' && lead) {
    systems.push(card(lead))
    if (lead.systemPrompt.trim()) systems.push(fill(lead.systemPrompt, lead.name, userName))
  }
  systems.push(userPersona.trim() ? `玩家扮演 ${userName}。关于 ${userName}：${userPersona.trim()}` : `玩家扮演 ${userName}。`)
  let books: Lorebook[] = []
  if (mode === 'offline') {
    const roster = chars.map((item) => `${item.name}${item.nickname ? `（${item.nickname}）` : ''}：${(item.personality || item.description).split(/[。\n]/)[0]?.slice(0, 40) ?? ''}`)
    if (roster.length) systems.push(`这个世界里的人（玩家可能会找他们）：\n${roster.join('\n')}`)
    const focus = focusChars(chars, save)
    if (focus.length) systems.push(`此刻相关的人的完整设定：\n\n${focus.map(card).join('\n\n')}`)
    books = focus.map((item) => item.characterBook).filter((item): item is Lorebook => Boolean(item))
  } else {
    const picked = chars.filter((item) => (save.bookCharIds ?? []).includes(item.id)).map((item) => item.characterBook)
    books = [...picked.filter((item): item is Lorebook => Boolean(item)), ...(save.books ?? [])]
  }
  const lore = loreText(books, recent, 2400)
  if (lore) systems.push(`世界书（用到才写，不要逐条复述）：\n${lore}`)
  const memory = memoryBlock(save)
  if (memory.text) systems.push(memory.text)
  if (mode === 'side' && config.statusPrompt.trim()) systems.push(fill(config.statusPrompt.trim(), charName, userName))
  if (mode === 'offline') systems.push('不要输出状态栏，不要写 <status> 标签，不要 HTML 卡片式状态信息。')
  if (lead?.postHistoryInstructions.trim()) systems.push(fill(lead.postHistoryInstructions, lead.name, userName))

  const scoped = config.regex.filter((rule) => !rule.charId || rule.charId === save.charId)
  const rules = [...scoped, ...(config.useCardRegex ? (mode === 'side' ? cardRegex(lead) : focusChars(chars, save).flatMap(cardRegex)) : [])]
  const messages: AIMessage[] = [{ role: 'system', content: systems.join('\n\n') }]
  for (const item of save.lines.slice(contextStart(save, config.keepRounds))) {
    messages.push({ role: item.role, content: applyRegex(item.content, rules, 'prompt', item.role) })
  }
  if (input.nudge) messages.push({ role: 'user', content: input.nudge })
  return messages
}

export function displayRules(mode: StoryMode, config: StoryConfig, chars: Character[], save: StorySave): RegexRule[] {
  const scoped = config.regex.filter((rule) => !rule.charId || rule.charId === save.charId)
  if (!config.useCardRegex) return scoped
  const extra = mode === 'side' ? cardRegex(chars.find((item) => item.id === save.charId)) : chars.flatMap(cardRegex)
  return [...scoped, ...extra]
}

export async function writeSummary(save: StorySave, kind: 'small' | 'big', keepRounds: number): Promise<StorySave> {
  const adapter = await AIAdapter.fromStored(await storage.readApi(), await storage.readApiKey())
  const start = memoryBlock(save).covered
  if (kind === 'small') {
    const end = Math.max(start, save.lines.length - keepRounds * 2)
    const chunk = save.lines.slice(start, end > start ? end : save.lines.length)
    if (chunk.length === 0) throw new Error('还没有需要总结的内容')
    const response = await adapter.complete({
      messages: [
        { role: 'system', content: '把下面这段剧情压缩成一段 150 字以内的小总结。只写发生了什么、人物关系有什么变化、留下了什么悬念。不加标题，不评价。' },
        { role: 'user', content: chunk.map((item) => `${item.role === 'user' ? '玩家' : '剧情'}：${item.content.replace(/<[^>]+>/g, '')}`).join('\n') },
      ],
      temperature: 0.3,
      maxTokens: 400,
    })
    const upTo = end > start ? end : save.lines.length
    return { ...save, summaries: [...save.summaries, { id: uid('sum'), kind, text: response.content.trim(), upTo, createdAt: Date.now() }] }
  }
  if (save.summaries.length === 0) throw new Error('先有几条小总结，才能合成大总结')
  const response = await adapter.complete({
    messages: [
      { role: 'system', content: '把下面按时间排列的总结合并成一份 400 字以内的前情大总结。保留关键事件、人物关系和未解决的线索，按时间顺序写成一段。' },
      { role: 'user', content: save.summaries.map((item) => `${item.kind === 'big' ? '【大总结】' : '-'} ${item.text}`).join('\n') },
    ],
    temperature: 0.3,
    maxTokens: 900,
  })
  const upTo = Math.max(...save.summaries.map((item) => item.upTo))
  return { ...save, summaries: [{ id: uid('sum'), kind: 'big', text: response.content.trim(), upTo, createdAt: Date.now() }] }
}

export function needsSummary(save: StorySave, config: StoryConfig): boolean {
  if (!config.autoSummary) return false
  const covered = memoryBlock(save).covered
  return save.lines.length - config.keepRounds * 2 - covered >= config.summaryEvery * 2
}

export async function generate(messages: AIMessage[], preset: Preset | null, maxTokens?: number): Promise<string> {
  const adapter = await AIAdapter.fromStored(await storage.readApi(), await storage.readApiKey())
  const response = await adapter.complete({
    messages,
    temperature: preset?.data.temperature ?? 0.9,
    topP: preset?.data.top_p ?? 0.95,
    frequencyPenalty: preset?.data.frequency_penalty ?? 0,
    presencePenalty: preset?.data.presence_penalty ?? 0,
    ...(maxTokens != null ? { maxTokens } : {}),
  })
  return response.content
}

export async function generateStoryReply(input: {
  messages: AIMessage[]
  preset: Preset | null
  charsMin: number
  charsMax: number
}): Promise<string> {
  const range = storyCharRange(input.charsMin, input.charsMax)
  let content = await generate(input.messages, input.preset)
  let len = plainStoryLength(content)
  if (len >= range.lo && len <= range.hi) return content

  let rounds = 0
  while (len < range.lo && rounds < 3) {
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
    )
    content = `${content.trimEnd()}\n${tail.trim()}`
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
    .map((part) => (part.startsWith('<') || part.trim() === '' ? part : part.replace(/\n/g, '<br>')))
    .join('')
  return body.replace(/@@MELLOW(\d+)@@/g, (_, index: string) => kept[Number(index)] ?? '')
}

export function frameDoc(id: string, html: string, reading: ReadingStyle, color: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0!important;padding:0!important;background:transparent!important;overflow:hidden!important;min-height:0!important;height:auto!important;line-height:0}body{font-family:${FONT_STACK[reading.font]};font-size:${reading.fontSize}px;line-height:${reading.lineHeight};color:${color};word-break:break-word}body>*:first-child{margin-top:0!important;padding-top:0!important}body>*:last-child{margin-bottom:0!important;padding-bottom:0!important}body>*{max-width:100%;vertical-align:top}img{max-width:100%;height:auto;display:block;vertical-align:top}</style></head><body>${htmlBody(html)}<script>(function(){var id=${JSON.stringify(id)};function strip(){['html','body'].forEach(function(tag){var el=document.getElementsByTagName(tag)[0];if(!el)return;el.style.margin='0';el.style.padding='0';el.style.minHeight='auto';el.style.height='auto';});document.querySelectorAll('body *').forEach(function(el){if(!el.style)return;var mh=el.style.minHeight||'';var h=el.style.height||'';var pt=el.style.paddingTop||'';var pb=el.style.paddingBottom||'';if(/100vh|100%/.test(mh))el.style.minHeight='auto';if(/100vh|100%/.test(h))el.style.height='auto';if(/\\d+vh/.test(pt))el.style.paddingTop='0';if(/\\d+vh/.test(pb))el.style.paddingBottom='0';if(el.style.position==='fixed'||el.style.position==='absolute'){el.style.position='relative';el.style.inset='auto';}});}function measure(){strip();var kids=Array.from(document.body.children);if(!kids.length)return Math.ceil(document.body.scrollHeight||24);var top=kids[0].getBoundingClientRect().top;var bottom=top;kids.forEach(function(el){var r=el.getBoundingClientRect();if(r.height>0){top=Math.min(top,r.top);bottom=Math.max(bottom,r.bottom);}});return Math.max(24,Math.ceil(bottom-top));}function m(){var h=Math.min(measure(),2400);parent.postMessage({mellowFrame:id,h:h},'*');}new ResizeObserver(function(){requestAnimationFrame(m);}).observe(document.body);window.addEventListener('load',m);m();})()</script></body></html>`
}
