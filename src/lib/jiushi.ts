import { importCharacterRegex } from '../engine/story.ts'
import { pickPreset } from '../engine/prompt.ts'
import { characterFromDraft } from '../domain/importing.ts'
import { moduleAi, readJson } from './ask.ts'
import { resolveImportJson } from './cardTextImport.ts'
import { modePresetId } from './defaults.ts'
import { directivePrompt } from './directives.ts'
import { jiushiStoryBridgeForLetter } from './jiushiBridge.ts'
import { jiushiWorldNs } from './jiushiPhone.ts'
import { fillCharacterPrompt, renderPresetPrompt } from './presetPrompt.ts'
import { parseCharacterCards, type CardDraft } from './sillytavern.ts'
import { migrateJiushiCardWorld, storyWorldText } from './worldbook.ts'
import { storage } from '../storage/StorageService.ts'
import type { Character, Identity } from '../types/index.ts'
import { uid } from './id.ts'

const { askLine } = moduleAi('jiushi')

export const JIUSHI_TAGS = ['旧世', '古风'] as const

export interface JiushiConfig {
  fontStyle?: 'modern' | 'song' | 'kai'
  fontSize?: number
  setupDone: boolean
  /** 是否保留穿书前的现代记忆 */
  hasMemory: boolean
  /** 穿书后的身份名 */
  roleName: string
  /** 在此世的称呼 / 来历 */
  roleStory: string
  /** 所入之书或世界名 */
  worldTitle: string
  updatedAt: number
}

export interface JiushiLetterLine {
  role: 'user' | 'assistant'
  content: string
  at: number
}

export interface JiushiLetter {
  id: string
  charId: string
  charName: string
  lines: JiushiLetterLine[]
  updatedAt: number
}

export function defaultJiushiConfig(): JiushiConfig {
  return {
    fontStyle: 'modern',
    fontSize: 16,
    setupDone: false,
    hasMemory: false,
    roleName: '',
    roleStory: '',
    worldTitle: '',
    updatedAt: Date.now(),
  }
}

export async function loadJiushiConfig(namespace: string): Promise<JiushiConfig> {
  const row = await storage.getBag<JiushiConfig>(namespace, 'jiushi_config')
  return row ? { ...defaultJiushiConfig(), ...row } : defaultJiushiConfig()
}

export async function saveJiushiConfig(namespace: string, patch: Partial<JiushiConfig>): Promise<JiushiConfig> {
  const prev = await loadJiushiConfig(namespace)
  const next = { ...prev, ...patch, updatedAt: Date.now() }
  await storage.setBag(namespace, 'jiushi_config', next)
  return next
}

export function isJiushiCharacter(character: Character): boolean {
  if (character.tags.some((tag) => JIUSHI_TAGS.includes(tag as (typeof JIUSHI_TAGS)[number]))) return true
  const ext = character.extensions?.jiushi
  return ext === true || (typeof ext === 'object' && ext !== null)
}

export function jiushiPromptBlock(config: JiushiConfig): string {
  const memory = config.hasMemory
    ? '玩家穿书而来，仍记得现代的事，但在此世生活；不要每句都提现代，用到才说。'
    : '玩家在此世醒来，没有现代记忆，只有当前身份与经历；不要提手机、网络、穿书等概念。'
  const role = [config.roleName, config.roleStory].filter(Boolean).join('，') || '此世土生土长的古代居民'
  const world = config.worldTitle.trim() || '此世'
  return [
    '【旧世 · 穿书】',
    `所入：${world}。`,
    `玩家身份：${role}。`,
    memory,
    '玩家在此世具有古代身份；现代手机身份、职业、社交关系不得覆盖此世身份。此世使用书信、银钱、驿站、铺面与古代制度。现代记忆只能是内心知识，不能凭空产生现代设备、网络、外卖或现代应用。旧世角色不得读取现代短信、星博、购物、地图和现代日程。用古风/半文白叙事，角色认知受时代和各自见闻限制。',
  ].join('')
}

function tagJiushiDraft(draft: CardDraft): CardDraft {
  const tags = Array.from(new Set([...JIUSHI_TAGS, ...draft.tags.filter(Boolean)]))
  return {
    ...draft,
    tags,
    extensions: { ...draft.extensions, jiushi: { importedAt: Date.now() } },
    creator: draft.creator || 'jiushi',
  }
}

export async function importJiushiCardFile(file: File, identity: Identity): Promise<Character[]> {
  const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')
  let avatar = ''
  const { card: raw } = await resolveImportJson(file, 'character')
  const drafts = parseCharacterCards(raw).map(tagJiushiDraft)
  if (isPng) avatar = await fileToDataUrl(file)
  const characters: Character[] = []
  for (const draft of drafts) {
    const character = await characterFromDraft(identity.namespace, draft, avatar, { skipChat: true, worldNamespace: jiushiWorldNs(identity.namespace) })
    await importCharacterRegex(identity.namespace, character)
    characters.push(character)
  }
  return characters
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('头像没有读出来'))
    reader.readAsDataURL(file)
  })
}

export async function listJiushiLetters(namespace: string): Promise<JiushiLetter[]> {
  return (await storage.getBag<JiushiLetter[]>(namespace, 'jiushi_letters')) ?? []
}

async function saveJiushiLetters(namespace: string, rows: JiushiLetter[]): Promise<void> {
  await storage.setBag(namespace, 'jiushi_letters', rows)
}

export async function getJiushiLetter(namespace: string, charId: string): Promise<JiushiLetter | undefined> {
  return (await listJiushiLetters(namespace)).find((item) => item.charId === charId)
}

export async function appendJiushiLetterLine(
  namespace: string,
  character: Character,
  role: 'user' | 'assistant',
  content: string,
): Promise<JiushiLetter> {
  const trimmed = content.trim()
  if (!trimmed) throw new Error('空笺写不出去')
  const rows = await listJiushiLetters(namespace)
  const now = Date.now()
  const existing = rows.find((item) => item.charId === character.id)
  const line: JiushiLetterLine = { role, content: trimmed, at: now }
  if (existing) {
    existing.lines.push(line)
    existing.updatedAt = now
    await saveJiushiLetters(namespace, rows)
    return existing
  }
  const created: JiushiLetter = {
    id: uid('let'),
    charId: character.id,
    charName: character.name,
    lines: [line],
    updatedAt: now,
  }
  await saveJiushiLetters(namespace, [...rows, created])
  return created
}

export async function replyJiushiLetter(input: {
  namespace: string
  character: Character
  config: JiushiConfig
  userText: string
}): Promise<string> {
  const character = await storage.getCharacter(input.namespace, input.character.id) ?? input.character
  const letter = (await getJiushiLetter(input.namespace, character.id)) ?? {
    id: uid('let'),
    charId: character.id,
    charName: character.name,
    lines: [],
    updatedAt: Date.now(),
  }
  const history = [...letter.lines, { role: 'user' as const, content: input.userText.trim(), at: Date.now() }]
    .slice(-16)
    .map((item) => `${item.role === 'user' ? '来者' : character.name}：${item.content}`)
    .join('\n')

  const worldNs = jiushiWorldNs(input.namespace)
  const userName = input.config.roleName.trim() || '无名旅人'
  await migrateJiushiCardWorld(input.namespace, [character.id])
  const [storyBridge, settings, presets, writing, world] = await Promise.all([
    jiushiStoryBridgeForLetter(input.namespace, character),
    storage.getSettings(),
    storage.listPresets(),
    directivePrompt(worldNs, [character.id]),
    storyWorldText(worldNs, [character], history, { userName }),
  ])
  const preset = pickPreset(presets, modePresetId(settings, 'jiushi'), character.presetId, null)
  const fill = (text: string) => fillCharacterPrompt(text, userName, character)
  const system = [
    fill('你是{{char}}。\n人物设定：{{description}}\n性格：{{personality}}\n处境：{{scenario}}'),
    jiushiPromptBlock(input.config),
    renderPresetPrompt(preset, userName, character),
    character.systemPrompt.trim() && fill(character.systemPrompt),
    world && `【世界书】\n${world}`,
    character.postHistoryInstructions.trim() && fill(character.postHistoryInstructions),
    writing.text && fill(writing.text),
    writing.cot,
    '当前是「传书」。用书信口吻回应，未指定长短时写一到两段。只返回 JSON 对象 {"letter":""}，信中不用 HTML、状态栏，也不代写来信者的行动或回信。',
  ].filter(Boolean).join('\n\n')
  const raw = await askLine(
    system,
    [storyBridge, `此前传书：\n${history || '（尚无）'}`, `来者新笺：${input.userText.trim()}`].filter(Boolean).join('\n\n'),
    320,
  )
  const parsed = readJson(raw) as { letter?: unknown }
  const text = typeof parsed.letter === 'string' ? parsed.letter.trim() : ''
  if (!text) throw new Error('回信是空的')
  await appendJiushiLetterLine(input.namespace, character, 'user', input.userText)
  await appendJiushiLetterLine(input.namespace, character, 'assistant', text)
  return text
}
