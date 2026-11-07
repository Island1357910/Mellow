import { ALL_SMS_STICKERS, type Sticker } from '../data/stickers.ts'
import { storage } from '../storage/StorageService.ts'

const KEY = 'sms_stickers_v1'
const ACCOUNT = 'mellow_account_rewards'
const MAX_ADDED = 300
const MAX_LABEL = 60

export interface StickerLibrary {
  added: Sticker[]
  hidden: string[]
}

function isUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value) && value.length <= 500
}

function asSticker(value: unknown): Sticker | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Partial<Sticker>
  if (typeof item.url !== 'string' || typeof item.label !== 'string') return null
  const url = item.url.trim()
  const label = item.label.trim().slice(0, MAX_LABEL)
  if (!isUrl(url) || !label) return null
  return { url, label }
}

export function parseStickerBatch(raw: string): { stickers: Sticker[]; error: string } {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (!lines.length) return { stickers: [], error: '先写网址，下一行写这个表情的意思' }
  if (lines.length % 2 !== 0) return { stickers: [], error: '网址和意思要成对。最后一条还缺一行。' }
  const stickers: Sticker[] = []
  const seen = new Set<string>()
  for (let index = 0; index < lines.length; index += 2) {
    const url = lines[index] ?? ''
    const label = lines[index + 1] ?? ''
    const row = index / 2 + 1
    if (!isUrl(url)) return { stickers: [], error: `第 ${row} 个的第一行不是图片网址` }
    if (isUrl(label) || !label.trim()) return { stickers: [], error: `第 ${row} 个的第二行要写意思，不要再写网址` }
    if (seen.has(url)) {
      const existing = stickers.findIndex((item) => item.url === url)
      if (existing >= 0) stickers[existing] = { url, label: label.trim().slice(0, MAX_LABEL) }
      continue
    }
    seen.add(url)
    stickers.push({ url, label: label.trim().slice(0, MAX_LABEL) })
  }
  if (stickers.length > 40) return { stickers: [], error: '一次最多录入 40 个' }
  return { stickers, error: '' }
}

function normalizeLibrary(saved: Partial<StickerLibrary> | null): StickerLibrary {
  const added = Array.isArray(saved?.added) ? saved.added.map(asSticker).filter((item): item is Sticker => item !== null).slice(0, MAX_ADDED) : []
  const hidden = Array.isArray(saved?.hidden) ? saved.hidden.filter((item): item is string => typeof item === 'string' && isUrl(item)).slice(0, 800) : []
  return { added, hidden }
}

function mergeLibraries(base: StickerLibrary, extra: StickerLibrary): StickerLibrary {
  const hidden = new Set(base.hidden)
  const added = [...base.added]
  for (const url of extra.hidden) {
    hidden.add(url)
    const index = added.findIndex((item) => item.url === url)
    if (index >= 0) added.splice(index, 1)
  }
  for (const item of extra.added) {
    if (hidden.has(item.url) && extra.hidden.includes(item.url)) continue
    hidden.delete(item.url)
    const index = added.findIndex((row) => row.url === item.url)
    if (index >= 0) added[index] = item
    else added.push(item)
  }
  return { added: added.slice(0, MAX_ADDED), hidden: [...hidden].slice(0, 800) }
}

async function storedNamespaces(): Promise<string[]> {
  try {
    if (typeof indexedDB.databases !== 'function') return []
    const listed = await indexedDB.databases()
    return listed.map((item) => item.name).filter((name): name is string => Boolean(name))
  } catch {
    return []
  }
}

/** 表情包存在账号库，所有身份看到同一份。旧的按身份保存的记录会并进来。 */
export async function loadStickerLibrary(): Promise<StickerLibrary> {
  let library = normalizeLibrary(await storage.getBag<Partial<StickerLibrary>>(ACCOUNT, KEY))
  const identities = await storage.listIdentities()
  const existing = new Set(await storedNamespaces())
  const names = identities.flatMap((item) => [item.namespace, `${item.namespace}__side`]).filter((name) => existing.has(name))
  let moved = false
  for (const name of names) {
    const saved = await storage.getBag<Partial<StickerLibrary>>(name, KEY)
    if (!saved) continue
    const local = normalizeLibrary(saved)
    if (local.added.length || local.hidden.length) {
      library = mergeLibraries(library, local)
      moved = true
    }
    await storage.deleteBag(name, KEY)
  }
  if (moved) await storage.setBag(ACCOUNT, KEY, library)
  return library
}

export function visibleStickers(library: StickerLibrary): Sticker[] {
  const hidden = new Set(library.hidden)
  const overrides = new Map(library.added.map((item) => [item.url, item.label]))
  const known = new Set(ALL_SMS_STICKERS.map((item) => item.url))
  const custom = library.added.filter((item) => !known.has(item.url) && !hidden.has(item.url))
  const built = ALL_SMS_STICKERS.filter((item) => !hidden.has(item.url)).map((item) => ({
    url: item.url,
    label: overrides.get(item.url) || item.label,
  }))
  return [...custom, ...built]
}

async function saveLibrary(library: StickerLibrary): Promise<Sticker[]> {
  const next = {
    added: library.added.slice(0, MAX_ADDED),
    hidden: library.hidden.slice(0, 800),
  }
  await storage.setBag(ACCOUNT, KEY, next)
  return visibleStickers(next)
}

export async function addStickers(incoming: Sticker[]): Promise<Sticker[]> {
  const library = await loadStickerLibrary()
  const added = [...library.added]
  const hidden = new Set(library.hidden)
  for (const item of incoming) {
    hidden.delete(item.url)
    const index = added.findIndex((row) => row.url === item.url)
    if (index >= 0) added[index] = item
    else added.push(item)
  }
  return saveLibrary({ added, hidden: [...hidden] })
}

export async function removeSticker(url: string): Promise<Sticker[]> {
  const library = await loadStickerLibrary()
  return saveLibrary({
    added: library.added.filter((item) => item.url !== url),
    hidden: library.hidden.includes(url) ? library.hidden : [...library.hidden, url],
  })
}
