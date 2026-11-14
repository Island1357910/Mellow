import { moduleAdapter, moduleAi, readJson } from './ask.ts'
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
  title: string
  blurb: string
  body: string
  withName: string
  createdAt: number
  seed: number
}

const DEFAULT_PREFS: StagePrefs = { enabled: false, every: 6, turns: 0, lastError: '', kinds: STAGE_KINDS.map((item) => item.id) }
const tails = new Map<string, Promise<void>>()

export function clampStageEvery(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PREFS.every
  return Math.max(2, Math.min(20, Math.round(value)))
}

function knownKinds(value: unknown): string[] {
  const known = new Set(STAGE_KINDS.map((item) => item.id))
  if (!Array.isArray(value)) return [...known]
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
  return {
    id: item.id,
    kindId: known?.id ?? (typeof item.kindId === 'string' ? item.kindId : 'sleeve-note'),
    kindName: typeof item.kindName === 'string' && item.kindName ? item.kindName : known?.name ?? '一场小剧场',
    category: typeof item.category === 'string' && item.category ? item.category : known?.category ?? '纸上',
    title: item.title.slice(0, item.kindId === 'custom' ? 80 : 16),
    blurb: typeof item.blurb === 'string' ? item.blurb.slice(0, 48) : '',
    body: item.body.slice(0, item.kindId === 'custom' ? 8000 : 800),
    withName: typeof item.withName === 'string' ? item.withName.slice(0, 24) : '',
    createdAt: typeof item.createdAt === 'number' ? item.createdAt : 0,
    seed: typeof item.seed === 'number' ? item.seed : 0,
  }
}

export async function loadStagePlays(namespace: string): Promise<StagePlay[]> {
  const saved = await storage.getBag<unknown[]>(namespace, PLAYS_KEY)
  if (!Array.isArray(saved)) return []
  return saved.map(asPlay).filter((item): item is StagePlay => item !== null)
}

export async function draftStage(wish: string): Promise<StagePlay> {
  const raw = readJson(await moduleAi('create').askJson(
    '按玩家的情节、风格和篇幅要求写一场可独立阅读的小剧场。只输出 JSON 对象 {"title":"","blurb":"","body":""}，正文使用自然段。',
    wish, 6000,
  )) as Partial<StagePlay> | null
  if (typeof raw?.title !== 'string' || !raw.title.trim() || typeof raw.body !== 'string' || !raw.body.trim()) throw new Error('没有生成完整剧场')
  return {
    id: uid('stage'), kindId: 'custom', kindName: '自定义', category: '自定义',
    title: raw.title.trim(), blurb: typeof raw.blurb === 'string' ? raw.blurb.trim() : '',
    body: raw.body.trim(), withName: '', createdAt: Date.now(), seed: Math.floor(Math.random() * 100),
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
  const cleaned = raw.replace(/```json|```/gi, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const data = JSON.parse(cleaned.slice(start, end + 1)) as { title?: unknown; blurb?: unknown; body?: unknown }
    const title = typeof data.title === 'string' ? data.title.trim() : ''
    const blurb = typeof data.blurb === 'string' ? data.blurb.trim() : ''
    const body = typeof data.body === 'string' ? data.body.trim() : ''
    if (title.length < 2 || blurb.length < 4 || body.length < 20) return null
    return { title: title.slice(0, 16), blurb: blurb.slice(0, 48), body: body.slice(0, 800) }
  } catch {
    return null
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
人物叫${input.character.name}。下面只作气质参考，不要复述原文，也不要添上露骨内容：
性格：${clip(input.character.personality || '', 120)}
设定：${clip(input.character.description || '', 120)}
严格返回 JSON，不要代码块：{"title":"不超过12个字的名字","blurb":"不超过30个字的简介","body":"120到280字的正文，有画面，可以有一两句对话"}`,
        },
        {
          role: 'user',
          content: `刚才对方说：${clip(input.playerLine, 180)}\n${input.character.name}回了：${clip(input.reply, 180)}\n请按「${kind.name}」的气氛，写成一场和这次对话有关、但不是复述原话的小场景。`,
        },
      ],
    })
    const parsed = readStageJson(response.content || '')
    if (!parsed) {
      await saveStagePrefs(input.namespace, { ...prefs, turns: 0, lastError: '这场没写成，可以再聊几次' })
      return
    }
    const play: StagePlay = {
      id: uid('stage'),
      kindId: kind.id,
      kindName: kind.name,
      category: kind.category,
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
