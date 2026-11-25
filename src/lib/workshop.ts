import { importChatBackground } from './wallpaper.ts'

export type WorkType = 'character' | 'dlc'
export const workshopKinds = { character: '角色卡', world: '大世界', simulator: '模拟器', mod: 'MOD' } as const
export type WorkCategory = keyof typeof workshopKinds
export const workshopCategories = Object.keys(workshopKinds) as WorkCategory[]
export type WorkContent = {
  version: 1
  persona?: string
  world?: string
  greeting?: string
  app?: 'oracle'
  theme_color?: string
  system_prompt_addon?: string
  custom_buttons?: { label: string; instruction: string }[]
}

export interface Draft {
  title: string
  summary: string
  endpoints: string[]
  content: WorkContent
  cover?: string
}

export interface OwnWork extends Draft {
  id: string
  type: WorkType
  category: WorkCategory
  status: 'draft' | 'pending' | 'approved' | 'rejected'
  revision: number
  reviewNote: string
  published: boolean
  hasCover?: boolean
}

export interface PublicWork {
  id: string
  type: WorkType
  category: WorkCategory
  creatorId: number
  creatorName: string
  title: string
  summary: string
  endpoints: string[]
  display: { app?: 'oracle'; theme_color?: string; buttons?: string[]; greeting?: string; usesModel?: boolean }
  launchExample?: boolean
  protectedPlayReady?: boolean
  enabled?: boolean
  mine?: boolean
  installedAt?: number
  hasCover?: boolean
}

export interface CreatorProfile {
  id: number
  name: string
  bio: string
  followers: number
  following: boolean
  reminders: boolean
  avatarVersion?: number | null
}

export interface WorkshopActivity {
  unread: number
  items: { kind: 'comment' | 'like' | 'update'; workId: string; title: string; ref: number; time: number; body?: string; unread: boolean }[]
}

export interface WorkshopUser {
  id: number
  email: string
  reviewer: boolean
  warnings: { id: number; message: string; createdAt: number }[]
}

export const accountSessionChanged = 'mellow-account-session-changed'

export const workshopURL = (import.meta.env?.VITE_WORKSHOP_API as string | undefined)?.replace(/\/+$/, '')

export function workshopImageSource(image: string) {
  return image.startsWith('data:') ? image : 'data:image/jpeg;base64,' + image
}

export function readWorkshopImage(file: File, maxBytes: number, limit: string): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || !file.size || file.size > maxBytes) {
    return Promise.reject(new Error('请选择 ' + limit + ' 以内的 JPG、PNG 或 WebP 图片。'))
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('图片读取失败。'))
    reader.onerror = () => reject(new Error('图片读取失败。'))
    reader.readAsDataURL(file)
  })
}

export async function readWorkshopCover(file: File): Promise<HTMLImageElement> {
  const source = await readWorkshopImage(file, 2 * 1024 * 1024, '2 MB')
  const image = new Image()
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('无法打开这张封面。'))
    image.src = source
  })
  if (image.naturalWidth < 3 || image.naturalHeight < 4) throw new Error('图片太小，无法裁成 3:4。')
  return image
}

export async function readWorkshopAvatar(file: File): Promise<string> {
  const avatar = await importChatBackground(file, { maxBytes: 512 * 1024, maxEdge: 384 })
  if (!/^data:image\/(?:jpeg|png|webp);base64,/.test(avatar)) {
    throw new Error('请选择 JPG、PNG 或 WebP 头像。')
  }
  return avatar
}

export async function workshop<T = void>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  if (!workshopURL) throw new Error('工坊暂未接通')
  const response = await fetch(workshopURL + path, {
    method, credentials: 'include', redirect: 'error', signal,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    const result = await response.json().catch(() => null)
    if (!path.startsWith('/auth/') && response.status === 401) window.dispatchEvent(new Event(accountSessionChanged))
    throw new Error(result?.error || '工坊暂时不可用')
  }
  if (response.status === 204 || response.status === 202) return undefined as T
  return response.json()
}

export async function workshopWithTimeout<T>(path: string, method = 'GET', body?: unknown, controller = new AbortController()): Promise<T> {
  let timer = 0
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = window.setTimeout(() => {
        reject(new Error('连接超时，请检查网络后重试。'))
        controller.abort()
      }, 15_000)
    })
    return await Promise.race([workshop<T>(path, method, body, controller.signal), timeout])
  } finally {
    window.clearTimeout(timer)
  }
}

export function modelEndpoint(base: string) {
  return base.replace(/\/+$/, '').replace(/(?:\/chat\/completions)?$/, '/chat/completions')
}

/** null means unrestricted; an empty intersection means incompatible explicit whitelists. */
export function workshopEndpointPolicy(works: Pick<PublicWork, 'endpoints'>[]): string[] | null {
  const restricted = works.filter(work => work.endpoints.length).map(work => work.endpoints.map(modelEndpoint))
  if (!restricted.length) return null
  return [...new Set(restricted[0])].filter(url => restricted.every(list => list.includes(url)))
}

