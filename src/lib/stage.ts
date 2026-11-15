import { moduleAdapter, readJson } from './ask.ts'
import { STAGE_KINDS, stageKind, type StageKind } from '../data/stageKinds.ts'
import { uid } from './id.ts'
import { storage } from '../storage/StorageService.ts'
import { useMellow } from '../store/useMellow.ts'
import type { Character } from '../types/index.ts'

const PREFS_KEY = 'stage_prefs_v1'
const PLAYS_KEY = 'stage_plays_v1'
const MAX_PLAYS = 60

export interface StagePrefs {
  enabled: boolean
  every: number
  turns: number
  lastError: string
  kinds: string[]
}

export interface StagePlay {
  id: string
  kindId: string
  kindName: string
  category: string
  /** scene 是已经写成的一场；brief 是给番外用的写作指令。 */
  form: 'scene' | 'brief'
  title: string
  blurb: string
  body: string
  withName: string
  createdAt: number
  seed: number
}

const QUIET_KINDS = STAGE_KINDS.filter((item) => item.category !== '世界AU').map((item) => item.id)
const DEFAULT_PREFS: StagePrefs = { enabled: false, every: 6, turns: 0, lastError: '', kinds: QUIET_KINDS }
const tails = new Map<string, Promise<void>>()

export function clampStageEvery(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PREFS.every
  return Math.max(2, Math.min(20, Math.round(value)))
}

function knownKinds(value: unknown): string[] {
  const known = new Set(STAGE_KINDS.map((item) => item.id))
  if (!Array.isArray(value)) return [...QUIET_KINDS]
  return value.filter((item): item is string => typeof item === 'string' && known.has(item))
}

export async function loadStagePrefs(namespace: string): Promise<StagePrefs> {
  const saved = await storage.getBag<Partial<StagePrefs>>(namespace, PREFS_KEY)
  return {
    enabled: saved?.enabled === true,
    every: clampStageEvery(saved?.every ?? DEFAULT_PREFS.every),
    turns: Math.max(0, Math.min(40, Math.round(saved?.turns ?? 0))),
    lastError: typeof saved?.lastError === 'string' ? saved.lastError.slice(0, 48) : '',
    kinds: knownKinds(saved?.kinds),
  }
}

export async function saveStagePrefs(namespace: string, prefs: StagePrefs): Promise<void> {
  await storage.setBag(namespace, PREFS_KEY, {
    enabled: prefs.enabled === true,
    every: clampStageEvery(prefs.every),
    turns: Math.max(0, Math.min(40, Math.round(prefs.turns))),
    lastError: prefs.lastError.slice(0, 48),
    kinds: knownKinds(prefs.kinds),
  })
}

function asPlay(value: unknown): StagePlay | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Partial<StagePlay>
  if (typeof item.id !== 'string' || typeof item.title !== 'string' || typeof item.body !== 'string') return null
  const known = typeof item.kindId === 'string' ? stageKind(item.kindId) : undefined
  const brief = item.form === 'brief' || item.kindId === 'brief'
  const long = brief || item.kindId === 'custom'
  return {
    id: item.id,
    kindId: known?.id ?? (typeof item.kindId === 'string' ? item.kindId : 'sleeve-note'),
    kindName: typeof item.kindName === 'string' && item.kindName ? item.kindName : known?.name ?? '一场小剧场',
    category: typeof item.category === 'string' && item.category ? item.category : known?.category ?? '纸上',
    form: brief ? 'brief' : 'scene',
    title: item.title.slice(0, long ? 80 : 16),
    blurb: typeof item.blurb === 'string' ? item.blurb.slice(0, 48) : '',
    body: item.body.slice(0, long ? 8000 : 800),
    withName: typeof item.withName === 'string' ? item.withName.slice(0, 80) : '',
    createdAt: typeof item.createdAt === 'number' ? item.createdAt : 0,
    seed: typeof item.seed === 'number' ? item.seed : 0,
  }
}

export async function loadStagePlays(namespace: string): Promise<StagePlay[]> {
  const saved = await storage.getBag<unknown[]>(namespace, PLAYS_KEY)
  if (!Array.isArray(saved)) return []
  return saved.map(asPlay).filter((item): item is StagePlay => item !== null)
}

const ROLE_TOP = /总攻|年下攻|年上攻|强攻|弱攻|攻方|上位|左位|纯1|(?:^|[\s,，、/])攻(?:$|[\s,，、/])|\bseme\b|\btop\b/i
const ROLE_BOTTOM = /总受|年下受|年上受|强受|弱受|受方|下位|右位|纯0|(?:^|[\s,，、/])受(?:$|[\s,，、/])|\buke\b|\bbottom\b/i
const ROLE_SWITCH = /互攻|可逆|不固定|攻受不明|\bswitch\b/i
const TAG_TOP = /^(?:攻|1|top|seme)$/i
const TAG_BOTTOM = /^(?:受|0|bottom|uke)$/i

/** 从标签和设定里认出上下位。认不出就明确不许自行指定，更不许对调。 */
export function stageRoleNote(person: Pick<Character, 'name' | 'tags' | 'description' | 'personality' | 'creatorNotes'>): string {
  const tags = person.tags ?? []
  const bag = [tags.join(' '), person.description, person.personality, person.creatorNotes].join('\n')
  const stated = bag.match(/(?:定位|属性|攻受|位置|性向)\s*[:：=]\s*([^\n，。；;]{1,16})/)
  const statedText = stated?.[1] ?? ''
  const verse = ROLE_SWITCH.test(bag)
  const top = ROLE_TOP.test(bag) || tags.some((tag) => TAG_TOP.test(tag.trim())) || (/攻|上位|左位|^1$/.test(statedText) && !/受|下位|右位|0/.test(statedText))
  const bottom = ROLE_BOTTOM.test(bag) || tags.some((tag) => TAG_BOTTOM.test(tag.trim())) || (/受|下位|右位|^0$/.test(statedText) && !/攻|上位|左位|1/.test(statedText))
  if (verse || (top && bottom)) {
    return `${person.name}的上下位按原文${stated ? `「${stated[1]}」` : ''}，不要对调。`
  }
  if (top) return `${person.name}是上位（攻）。不要写成下位或受。`
  if (bottom) return `${person.name}是下位（受）。不要写成上位或攻。`
  if (stated) return `${person.name}的关系位按原文「${stated[1]}」，不要对调。`
  return `${person.name}的原文没有写上下位。不要自行指定攻受，更不要中途对调。`
}

export function stageCanonBlock(people: Character[]): string {
  return people.map((person) => {
    const tags = person.tags.slice(0, 12).join('、')
    return [
      `【${person.name}】`,
      tags ? `标签：${tags}` : '',
      person.personality.trim() ? `性格大趋势：${clip(person.personality, 180)}` : '',
      person.description.trim() ? `设定：${clip(person.description, 220)}` : '',
      stageRoleNote(person),
      '可以换场景和身份外壳，不可以把性格写成相反的人。',
    ].filter(Boolean).join('\n')
  }).join('\n\n')
}

function stringField(data: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = data[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (Array.isArray(value)) {
      const text = value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).join('\n').trim()
      if (text) return text
    }
  }
  return ''
}

/** 模型常把指令写成带换行的 JSON，或直接写成一段话。两种都要能读出来。 */
export function readStageBriefText(raw: string): { title: string; blurb: string; body: string } | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  let data: Record<string, unknown> | null = null
  try {
    const parsed = readJson(trimmed)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed as Record<string, unknown>
  } catch {
    const bodyField = trimmed.match(/"(?:body|text|content|instruction|prompt|指令|正文)"\s*:\s*"([\s\S]*?)"\s*(?:,|\})/)
    const titleField = trimmed.match(/"(?:title|标题)"\s*:\s*"([^"\n]{1,80})"/)
    const blurbField = trimmed.match(/"(?:blurb|summary|简介)"\s*:\s*"([^"\n]{1,80})"/)
    const loose = bodyField?.[1]?.replace(/\\n/g, '\n').replace(/\\"/g, '"').trim() ?? ''
    if (loose.length >= 20) {
      return {
        title: (titleField?.[1] || loose.split('\n')[0] || '番外指令').slice(0, 40),
        blurb: (blurbField?.[1] || '').slice(0, 48),
        body: loose,
      }
    }
  }
  if (data) {
    const body = stringField(data, ['body', 'text', 'content', 'instruction', 'prompt', '指令', '正文'])
    if (body.length >= 20) {
      const title = stringField(data, ['title', '标题', 'name']) || body.split('\n')[0] || '番外指令'
      return { title: title.slice(0, 40), blurb: stringField(data, ['blurb', 'summary', '简介']).slice(0, 48), body }
    }
  }
  const plain = trimmed.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
  if (plain.length < 20) return null
  const lines = plain.split(/\n+/).map((line) => line.trim()).filter(Boolean)
  const heading = lines[0]?.replace(/^#+\s*/, '') ?? ''
  const title = heading.length > 0 && heading.length <= 40 ? heading : '番外指令'
  const body = heading.length > 0 && heading.length <= 40 ? lines.slice(1).join('\n').trim() || plain : plain
  if (body.length < 20) return null
  return { title: title.slice(0, 40), blurb: '', body }
}

export async function draftStageBrief(input: { wish: string; people: Character[]; kind?: StageKind | null }): Promise<StagePlay> {
  const theme = input.kind
    ? `世界框架：${input.kind.name}。${input.kind.hint} 世界只换外壳，不改性格和上下位。`
    : '没有指定世界框架。没有要求就贴近角色原本的生活，不要另起一个会改性格的世界。'
  const cast = input.people.length ? stageCanonBlock(input.people) : '没有指定角色。不要编造固定上下位，也不要凭空造一个性格相反的人。'
  const adapter = await moduleAdapter('create')
  const response = await adapter.complete({
    temperature: 0.4,
    maxTokens: 4000,
    messages: [
      {
        role: 'system',
        content: `你在写一份小剧场番外的写作指令，不是写小说正文，不是写对话，也不是把情节演完。
指令给之后的写作者用，让他们按角色原设写一场番外。
${theme}
性格的大趋势必须守住，不要 OOC，不要写成相反的人。上下位和攻受不要对调；原文没写的不要自行指定。
只输出 JSON {"title":"指令标题","blurb":"一句话说明这场番外","body":"写作指令本身"}。
body 用短的说明段落，写清：谁出场、世界怎么套、关系怎么走、性格哪几条不能动、上下位怎么守、不要写什么。不要写成分镜小说。`,
      },
      { role: 'user', content: `玩家的额外要求：${input.wish.trim() || '没有额外要求，按角色和世界框架量身写。'}\n\n${cast}` },
    ],
  })
  const parsed = readStageBriefText(response.content) ?? (response.reasoning ? readStageBriefText(response.reasoning) : null)
  if (!parsed) throw new Error('没有生成指令')
  const kind = input.kind
  return {
    id: uid('stage'),
    kindId: kind?.id ?? 'brief',
    kindName: kind?.name ?? '番外指令',
    category: kind?.category ?? '指令',
    form: 'brief',
    title: parsed.title,
    blurb: parsed.blurb,
    body: parsed.body,
    withName: input.people.map((person) => person.name).join('、'),
    createdAt: Date.now(),
    seed: Math.floor(Math.random() * 100),
  }
}

export async function saveStagePlay(namespace: string, play: StagePlay): Promise<void> {
  await storage.changeAppBags(namespace, [PLAYS_KEY], bags => ({
    [PLAYS_KEY]: [play, ...((bags[PLAYS_KEY] as StagePlay[] | null) ?? []).filter(item => item.id !== play.id)].slice(0, MAX_PLAYS),
  }))
  window.dispatchEvent(new CustomEvent('mellow-stage'))
}

function pickKind(enabled: string[], previous?: string): StageKind | null {
  const allow = new Set(enabled)
  const pool = STAGE_KINDS.filter((item) => allow.has(item.id) && item.id !== previous)
  const list = pool.length ? pool : STAGE_KINDS.filter((item) => allow.has(item.id))
  if (!list.length) return null
  return list[Math.floor(Math.random() * list.length)] ?? null
}

function clip(text: string, max: number): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, max)
}

function readStageJson(raw: string): { title: string; blurb: string; body: string } | null {
  const parsed = readStageBriefText(raw)
  if (!parsed || parsed.body.length < 20) return null
  return {
    title: parsed.title.slice(0, 16),
    blurb: (parsed.blurb || parsed.body).slice(0, 48),
    body: parsed.body.slice(0, 800),
  }
}

async function writeStage(input: { namespace: string; character: Character; playerLine: string; reply: string }): Promise<void> {
  const installed = useMellow.getState().settings.installedApps.includes('stage')
  if (!installed) return
  const prefs = await loadStagePrefs(input.namespace)
  if (!prefs.enabled) return
  const turns = prefs.turns + 1
  if (turns < prefs.every) {
    await saveStagePrefs(input.namespace, { ...prefs, turns })
    return
  }
  await saveStagePrefs(input.namespace, { ...prefs, turns: 0 })
  const plays = await loadStagePlays(input.namespace)
  const kind = pickKind(prefs.kinds, plays[0]?.kindId)
  if (!kind) {
    await saveStagePrefs(input.namespace, { ...prefs, turns: 0, lastError: '还没有选要生成的种类' })
    window.dispatchEvent(new CustomEvent('mellow-stage'))
    return
  }
  try {
    const adapter = await moduleAdapter('messages')
    const response = await adapter.complete({
      temperature: 0.9,
      maxTokens: 700,
      messages: [
        {
          role: 'system',
          content: `你在写一场很短的原创小场景，题材叫「${kind.name}」。气氛：${kind.hint}
只写这一场。不要写成聊天记录，不要写列表，不要出现「玩家」「小剧场」「用户」这几个词。
人物叫${input.character.name}。世界框架只换场景，不改这个人。性格大趋势必须保留，不要写成相反的人，不要 OOC，也不要添上露骨内容。
${stageRoleNote(input.character)}
${input.character.tags.length ? `标签：${clip(input.character.tags.slice(0, 8).join('、'), 80)}` : ''}
性格：${clip(input.character.personality || '', 180)}
设定：${clip(input.character.description || '', 180)}
严格返回 JSON，不要代码块：{"title":"不超过12个字的名字","blurb":"不超过30个字的简介","body":"120到280字的正文，有画面，可以有一两句对话"}`,
        },
        {
          role: 'user',
          content: `刚才对方说：${clip(input.playerLine, 180)}\n${input.character.name}回了：${clip(input.reply, 180)}\n请按「${kind.name}」的气氛，写成一场和这次对话有关、但不是复述原话的小场景。`,
        },
      ],
    })
    const parsed = readStageJson(response.content || '') ?? (response.reasoning ? readStageJson(response.reasoning) : null)
    if (!parsed) {
      await saveStagePrefs(input.namespace, { ...prefs, turns: 0, lastError: '这场没写成，可以再聊几次' })
      return
    }
    const play: StagePlay = {
      id: uid('stage'),
      kindId: kind.id,
      kindName: kind.name,
      category: kind.category,
      form: 'scene',
      title: parsed.title,
      blurb: parsed.blurb,
      body: parsed.body,
      withName: input.character.name,
      createdAt: Date.now(),
      seed: Math.floor(Math.random() * 997),
    }
    await saveStagePlay(input.namespace, play)
    await saveStagePrefs(input.namespace, { ...prefs, turns: 0, lastError: '' })
    const identity = useMellow.getState().identities.find((item) => item.namespace === input.namespace)
    if (identity) {
      void useMellow.getState().pushNotice({
        kind: 'toast',
        title: '写成了一场小剧场',
        body: `${play.title} · ${kind.name}`,
        appId: 'stage',
        identityId: identity.id,
        priority: 3,
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '这场没写成'
    await saveStagePrefs(input.namespace, { ...prefs, turns: 0, lastError: message.slice(0, 42) || '这场没写成' })
    window.dispatchEvent(new CustomEvent('mellow-stage'))
  }
}

export function maybeWriteStage(input: { namespace: string; character: Character; playerLine: string; reply: string }): void {
  const previous = tails.get(input.namespace) ?? Promise.resolve()
  const next = previous.then(() => writeStage(input)).catch(() => undefined)
  tails.set(input.namespace, next)
}
