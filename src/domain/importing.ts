import { presetFromUnknown } from '../data/officialPresets.ts'
import { eventBus } from '../engine/EventBus.ts'
import { uid } from '../lib/id.ts'
import { resolveImportJson } from '../lib/cardTextImport.ts'
import { looksLikeCharacter, parseCharacterCards } from '../lib/sillytavern.ts'
import type { CardDraft } from '../lib/sillytavern.ts'
import { importCharacterRegex } from '../engine/story.ts'
import { importCharacterWorld } from '../lib/worldbook.ts'
import { storage } from '../storage/StorageService.ts'
import { themeFromUnknown } from '../theme/themes.ts'
import type { Character, Identity } from '../types/index.ts'
import { ensureDirectChat } from './messaging.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('头像没有读出来'))
    reader.readAsDataURL(file)
  })
}

export async function characterFromDraft(
  namespace: string,
  draft: CardDraft,
  avatar = '',
  options?: { skipChat?: boolean; allowProactive?: boolean },
): Promise<Character> {
  const now = Date.now()
  const character: Character = {
    id: uid('char'),
    name: draft.name,
    avatar,
    description: draft.description,
    personality: draft.personality,
    scenario: draft.scenario,
    firstMes: draft.firstMes,
    mesExample: draft.mesExample,
    creatorNotes: draft.creatorNotes,
    systemPrompt: draft.systemPrompt,
    postHistoryInstructions: draft.postHistoryInstructions,
    alternateGreetings: draft.alternateGreetings,
    tags: draft.tags,
    creator: draft.creator,
    characterVersion: draft.characterVersion,
    characterBook: draft.characterBook,
    extensions: draft.extensions,
    rawCard: draft.rawCard,
    presetId: null,
    createdAt: now,
    updatedAt: now,
  }
  await storage.putCharacter(namespace, character)
  await importCharacterWorld(namespace, character)
  await importCharacterRegex(namespace, character)
  if (!options?.skipChat) await ensureDirectChat(namespace, character, { allowProactive: options?.allowProactive })
  return character
}

export async function importCardFile(file: File, identity: Identity): Promise<Character[]> {
  const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')
  let avatar = ''
  const raw = await resolveImportJson(file, 'character')
  const drafts = parseCharacterCards(raw)
  if (isPng && file.size < 1_500_000) avatar = await fileToDataUrl(file)
  const characters: Character[] = []
  for (const draft of drafts) {
    characters.push(await characterFromDraft(identity.namespace, draft, avatar))
  }
  eventBus.emit({
    type: 'import_char',
    app: 'messages',
    identityId: identity.id,
    meta: { count: characters.length, name: characters[0]?.name ?? '' },
  })
  return characters
}

export type DropKind = 'character' | 'preset' | 'theme'

export async function importDroppedJson(
  file: File,
  identity: Identity,
): Promise<{ kind: DropKind; name: string; id: string }> {
  if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
    const characters = await importCardFile(file, identity)
    return { kind: 'character', name: characters.map((item) => item.name).join('、'), id: characters[0]?.id ?? '' }
  }
  const raw = JSON.parse(await file.text()) as unknown
  const theme = themeFromUnknown(raw)
  if (theme) {
    await storage.saveTheme(theme)
    return { kind: 'theme', name: theme.name, id: theme.id }
  }
  const preset = presetFromUnknown(raw)
  if (preset) {
    await storage.savePreset(preset)
    return { kind: 'preset', name: preset.name, id: preset.id }
  }
  if (looksLikeCharacter(raw) || (Array.isArray(raw) && raw.some((item) => looksLikeCharacter(item)))) {
    const characters = await importCardFile(file, identity)
    return { kind: 'character', name: characters.map((item) => item.name).join('、'), id: characters[0]?.id ?? '' }
  }
  if (isRecord(raw) && (raw.entries || raw.character_book)) {
    throw new Error('这像一本世界书。这一版请把它放进角色卡再导入。')
  }
  throw new Error('这个 JSON 不是角色卡、预设或主题。')
}

export async function loadSampleFile(): Promise<File> {
  const response = await fetch('/samples/xiaoman.json')
  if (!response.ok) throw new Error('示例角色没有找到')
  const blob = await response.blob()
  return new File([blob], 'xiaoman.json', { type: 'application/json' })
}

export async function saveCard(identity: Identity, draft: CardDraft): Promise<Character> {
  const character = await characterFromDraft(identity.namespace, draft)
  eventBus.emit({
    type: 'import_char',
    app: 'messages',
    identityId: identity.id,
    meta: { count: 1, name: character.name },
  })
  return character
}

export async function writeCharacter(input: {
  identity: Identity
  name: string
  personality: string
  description: string
  firstMes: string
}): Promise<Character> {
  const name = input.name.trim()
  if (!name) throw new Error('先写一个名字')
  const description = input.description.trim() || input.personality.trim()
  const draft: CardDraft = {
    name,
    avatar: '',
    description,
    personality: input.personality.trim(),
    scenario: '你们在短信里说话。',
    firstMes: input.firstMes.trim(),
    mesExample: '',
    creatorNotes: '',
    systemPrompt: '',
    postHistoryInstructions: '',
    alternateGreetings: [],
    tags: ['手写'],
    creator: 'player',
    characterVersion: '1.0.0',
    characterBook: null,
    extensions: {},
    rawCard: null,
  }
  const character = await characterFromDraft(input.identity.namespace, draft)
  eventBus.emit({
    type: 'import_char',
    app: 'messages',
    identityId: input.identity.id,
    meta: { count: 1, name: character.name },
  })
  return character
}
