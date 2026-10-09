import { importCharacterRegex } from '../engine/story.ts'
import { characterFromDraft } from '../domain/importing.ts'
import { askLine, readJson } from './ask.ts'
import { parseCharacterCards, parsePngCharacterCard, type CardDraft } from './sillytavern.ts'
import { importCharacterWorld } from './worldbook.ts'
import { storage } from '../storage/StorageService.ts'
import type { Character, Identity } from '../types/index.ts'
import { uid } from './id.ts'

export const JIUSHI_TAGS = ['旧世', '古风'] as const

export interface JiushiConfig {
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
  const role = [config.roleName, config.roleStory].filter(Boolean).join('，') || '一个刚入此世的人'
  const world = config.worldTitle.trim() || '此世'
  return [
    '【旧世 · 穿书】',
    `所入：${world}。`,
    `玩家身份：${role}。`,
    memory,
    '用古风/半文白叙事，可第三人称加对白；不要写现代短信口吻，不要提「微信」「手机App」。',
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
  let drafts: CardDraft[]
  if (isPng) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    drafts = [tagJiushiDraft(parsePngCharacterCard(bytes))]
    if (file.size < 1_500_000) avatar = await fileToDataUrl(file)
  } else {
    const raw = JSON.parse(await file.text()) as unknown
    drafts = parseCharacterCards(raw).map(tagJiushiDraft)
  }
  const characters: Character[] = []
  for (const draft of drafts) {
    const character = await characterFromDraft(identity.namespace, draft, avatar, { skipChat: true })
    await importCharacterWorld(identity.namespace, character)
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
  const letter = (await getJiushiLetter(input.namespace, input.character.id)) ?? {
    id: uid('let'),
    charId: input.character.id,
    charName: input.character.name,
    lines: [],
    updatedAt: Date.now(),
  }
  const history = [...letter.lines, { role: 'user' as const, content: input.userText.trim(), at: Date.now() }]
    .slice(-16)
    .map((item) => `${item.role === 'user' ? '来者' : input.character.name}：${item.content}`)
    .join('\n')

  const raw = await askLine(
    `你是${input.character.name}。${input.character.description.slice(0, 200)}
${jiushiPromptBlock(input.config)}
当前是「传书」：像古人写信，半文白，一段到两段，不要 HTML，不要状态栏，不要替对方写。只返回 JSON：{"letter":""}`,
    `此前传书：\n${history || '（尚无）'}\n\n来者新笺：${input.userText.trim()}`,
    320,
  )
  const parsed = readJson(raw) as { letter?: unknown }
  const text = typeof parsed.letter === 'string' ? parsed.letter.trim() : ''
  if (!text) throw new Error('回信是空的')
  await appendJiushiLetterLine(input.namespace, input.character, 'user', input.userText)
  await appendJiushiLetterLine(input.namespace, input.character, 'assistant', text)
  return text
}
