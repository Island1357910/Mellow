import { importCharacterRegex } from '../engine/story.ts'
import { uid } from './id.ts'
import type { CardDraft } from './sillytavern.ts'
import type { SocialNearPerson } from './socialAi.ts'
import { importCharacterWorld } from './worldbook.ts'
import { storage, defaultCharState } from '../storage/StorageService.ts'
import type { Character, CharacterInternalState, ScheduleSlot } from '../types/index.ts'

export type NearPerson = SocialNearPerson

export interface NearbyMeta {
  city: string
  gender: string
  age: string
  likedAt: number
  enrichLevel: number
  lifeNote: string
  lastLifePingAt?: number
}

export function isNearbyCharacter(character: Character): boolean {
  return character.tags.includes('附近的人')
}

export function getNearbyMeta(character: Character): NearbyMeta | null {
  const row = character.extensions?.nearby
  if (!row || typeof row !== 'object') return null
  const data = row as Record<string, unknown>
  return {
    city: typeof data.city === 'string' ? data.city : '',
    gender: typeof data.gender === 'string' ? data.gender : '',
    age: typeof data.age === 'string' ? data.age : '',
    likedAt: typeof data.likedAt === 'number' ? data.likedAt : 0,
    enrichLevel: typeof data.enrichLevel === 'number' ? data.enrichLevel : 0,
    lifeNote: typeof data.lifeNote === 'string' ? data.lifeNote : '',
    lastLifePingAt: typeof data.lastLifePingAt === 'number' ? data.lastLifePingAt : undefined,
  }
}

export function findNearbyContact(chars: Character[], person: NearPerson): Character | undefined {
  return chars.find((item) => item.name === person.name && isNearbyCharacter(item))
}

function seedSchedule(person: NearPerson): ScheduleSlot[] {
  const hint = `${person.bio} ${person.signature}`.slice(0, 40)
  const work = /班|公司|实习|店|课/.test(hint)
  return [
    { time: '08:30', activity: work ? '出门上班' : '慢慢醒来' },
    { time: '12:30', activity: '吃午饭' },
    { time: '19:00', activity: work ? '下班路上' : '做自己的事' },
    { time: '23:00', activity: '准备休息' },
  ]
}

async function initNearbyLife(namespace: string, charId: string, person: NearPerson): Promise<void> {
  const state: CharacterInternalState = {
    ...defaultCharState(charId),
    location: person.city || '附近',
    mood: '平常',
    schedule: seedSchedule(person),
    energy: 0.55 + Math.random() * 0.35,
    updatedAt: Date.now(),
  }
  await storage.saveCharState(namespace, state)
}

function nearbyDraft(person: NearPerson, greet: boolean): CardDraft {
  const tags = Array.from(new Set(['附近的人', ...person.tags.filter(Boolean)]))
  const personality = [person.gender, person.age, person.city, ...person.tags].filter(Boolean).join('，')
  return {
    name: person.name,
    avatar: '',
    description: person.bio || person.signature || `${person.name} 是在附近认识的人。`,
    personality,
    scenario: '你们先在附近的人里认识，后来加了联系人，在短信里聊。',
    firstMes: greet ? person.signature.trim() || '嗨。' : '',
    mesExample: '',
    creatorNotes: '这是附近认识的人，会随着聊天慢慢变得更立体。',
    systemPrompt: '',
    postHistoryInstructions: '你有自己的日程和情绪，不必秒回，忙的时候可以简短说在干嘛。',
    alternateGreetings: [],
    tags,
    creator: 'nearby',
    characterVersion: '1.0.0',
    characterBook: null,
    extensions: {
      nearby: {
        city: person.city,
        gender: person.gender,
        age: person.age,
        likedAt: Date.now(),
        enrichLevel: 0,
        lifeNote: person.signature || person.bio.slice(0, 36),
      } satisfies NearbyMeta,
    },
    rawCard: null,
  }
}

async function saveDraft(namespace: string, draft: CardDraft): Promise<Character> {
  const now = Date.now()
  const character: Character = {
    id: uid('char'),
    name: draft.name,
    avatar: draft.avatar,
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
  return character
}

/** 附近的人「喜欢」或「聊天」时写入联系人。 */
export async function createNearbyContact(namespace: string, person: NearPerson, options?: { greet?: boolean }): Promise<Character> {
  const existing = findNearbyContact(await storage.listCharacters(namespace), person)
  if (existing) return existing

  const character = await saveDraft(namespace, nearbyDraft(person, Boolean(options?.greet)))
  const next: Character = {
    ...character,
    signature: person.signature || character.signature,
    nickname: person.name,
    updatedAt: Date.now(),
  }
  await storage.putCharacter(namespace, next)
  await initNearbyLife(namespace, next.id, person)
  return next
}

export function slotForNow(schedule: ScheduleSlot[]): string {
  if (schedule.length === 0) return '忙自己的事'
  const hour = new Date().getHours()
  let pick = schedule[0]?.activity ?? '忙自己的事'
  for (const item of schedule) {
    const h = Number.parseInt(item.time.split(':')[0] ?? '0', 10)
    if (hour >= h) pick = item.activity
  }
  return pick
}

export async function refreshNearbyLife(namespace: string, character: Character): Promise<CharacterInternalState> {
  const prev = (await storage.getCharState(namespace, character.id)) ?? defaultCharState(character.id)
  const moods = ['平常', '有点累', '心情不错', '发呆', '忙', '放松']
  const next: CharacterInternalState = {
    ...prev,
    mood: moods[Math.floor(Math.random() * moods.length)] ?? '平常',
    energy: Math.max(0.25, Math.min(1, prev.energy + (Math.random() - 0.5) * 0.2)),
    updatedAt: Date.now(),
  }
  const activity = slotForNow(prev.schedule)
  const meta = getNearbyMeta(character)
  if (meta) {
    await storage.putCharacter(namespace, {
      ...character,
      extensions: { ...character.extensions, nearby: { ...meta, lifeNote: activity } },
      updatedAt: Date.now(),
    })
  }
  await storage.saveCharState(namespace, next)
  return next
}

export async function nearbyLifeNote(namespace: string, character: Character): Promise<string> {
  if (!isNearbyCharacter(character)) return ''
  const state = (await storage.getCharState(namespace, character.id)) ?? defaultCharState(character.id)
  const meta = getNearbyMeta(character)
  const doing = meta?.lifeNote?.trim() || state.schedule.find((item) => item.activity)?.activity || '忙自己的'
  return [
    `【${character.nickname || character.name} 有自己的生活】`,
    `此刻大概在 ${state.location || '附近'}，心情${state.mood || '平常'}，${doing}。`,
    '你也有别的事，不必围着对方转；可以自然提起自己的行程，忙的时候简短回复也行。',
  ].join('')
}
