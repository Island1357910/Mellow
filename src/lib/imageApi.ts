import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { storage } from '../storage/StorageService.ts'
import { decryptSecret, encryptSecret } from '../storage/crypto.ts'
import { readFileBytes } from './fileSnapshot.ts'

const namespace = 'mellow_image_api'
const cloudflareModel = '@cf/black-forest-labs/flux-1-schnell'
const cloudflareRun = /^\/client\/v4\/accounts\/[0-9a-f]{32}\/ai\/run\/(@cf\/black-forest-labs\/flux-1-schnell)\/?$/i
type Profile = { endpoint: string; model: string; encryptedKey: string }

function isSiliconFlow(hostname: string) {
  return hostname === 'api.siliconflow.cn' || hostname === 'api.siliconflow.com'
}

export function imageEndpoint(input: string) {
  const trimmed = input.trim().replace(/^['"`]+|['"`]+$/g, '')
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error('请填写以 https:// 开头的图片接口地址')
  }
  if (url.protocol !== 'https:') throw new Error('图片接口只接受 HTTPS 地址')
  if (url.username || url.password || [...url.searchParams.keys()].some(name => /^(api[_-]?key|key|token|access[_-]?token|secret)$/i.test(name))) {
    throw new Error('请把密钥填在下方，不要写进接口地址')
  }
  url.hash = ''
  url.search = ''
  if (url.origin === 'https://api.cloudflare.com') {
    if (!cloudflareRun.test(url.pathname)) throw new Error('请填写 Cloudflare FLUX.1 schnell 的完整运行地址')
    return url.href.replace(/\/$/, '')
  }
  const path = url.pathname.replace(/\/+$/, '').replace(/\/(images\/generations|chat\/completions|models)$/, '')
  url.pathname = `${path || '/v1'}/images/generations`
  return url.href
}

async function readProfile() {
  return storage.getBag<Profile>(namespace, 'profile')
}

export async function imageApiSettings() {
  const profile = await readProfile()
  return { endpoint: profile?.endpoint ?? '', model: profile?.model ?? '', hasKey: Boolean(profile?.encryptedKey) }
}

export async function listImageModels(endpoint: string, key = '', signal?: AbortSignal): Promise<string[]> {
  const normalized = imageEndpoint(endpoint)
  const url = new URL(normalized)
  const cloudflare = url.hostname === 'api.cloudflare.com'
  if (cloudflare) {
    url.pathname = url.pathname.replace(/\/run\/.*$/, '/models/search')
    url.searchParams.set('search', cloudflareModel)
  } else {
    url.pathname = url.pathname.replace(/\/images\/generations$/, '/models')
    if (isSiliconFlow(url.hostname)) {
      url.searchParams.set('sub_type', 'text-to-image')
    }
  }
  const profile = key.trim() ? undefined : await readProfile()
  const token = key.trim() || (profile?.endpoint === normalized ? await decryptSecret(profile.encryptedKey) : '')
  if (!token) throw new Error('先填写此图片接口的密钥，再拉取模型')
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  let status: number
  let data: unknown
  try {
    if (signal?.aborted) throw new Error()
    if (Capacitor.isNativePlatform()) {
      const response = await CapacitorHttp.request({
        url: url.href, method: 'GET', headers, responseType: 'json', disableRedirects: true,
        connectTimeout: 10_000, readTimeout: 20_000,
      })
      status = response.status
      data = response.data
    } else {
      const response = await fetch(url.href, { headers, signal, credentials: 'omit', redirect: 'error' })
      status = response.status
      if (response.ok) data = await response.json().catch(() => null)
    }
  } catch {
    if (signal?.aborted) throw new Error('拉取模型已取消或超时')
    throw new Error('无法连接模型列表。请检查接口地址、网络和浏览器跨域设置，也可以手动填写模型 ID。')
  }
  if (signal?.aborted) throw new Error('拉取模型已取消或超时')
  if (status < 200 || status >= 300) {
    throw new Error(status === 401 || status === 403
      ? `拉取模型失败（HTTP ${status}），请检查密钥和权限`
      : `拉取模型失败（HTTP ${status}），请检查接口地址或手动填写模型 ID`)
  }
  const envelope = data as { data?: unknown; models?: unknown; result?: unknown } | null
  const rows = Array.isArray(data) ? data : envelope?.data ?? envelope?.models ?? envelope?.result
  if (!Array.isArray(rows)) throw new Error('接口没有返回可读取的模型列表，可以手动填写模型 ID')
  const ids = rows.flatMap(row => {
    const id = typeof row === 'string' ? row : cloudflare ? row?.name : row?.id
    return typeof id === 'string' && id.trim() ? [id.trim()] : []
  })
  const models = [...new Set(cloudflare ? ids.filter(id => id === cloudflareModel) : ids)]
  if (!models.length) throw new Error('没有拉到可选模型，可以手动填写模型 ID')
  return models
}

export async function saveImageApi(endpoint: string, model: string, key: string) {
  const normalized = imageEndpoint(endpoint)
  if (!model.trim()) throw new Error('请填写生图模型')
  if (new URL(normalized).hostname === 'api.cloudflare.com' && model.trim() !== cloudflareModel) {
    throw new Error(`Cloudflare 模型请填写 ${cloudflareModel}`)
  }
  const previous = await readProfile()
  const encryptedKey = key.trim()
    ? await encryptSecret(key.trim())
    : previous?.endpoint === normalized ? previous.encryptedKey : ''
  if (!encryptedKey) throw new Error('请为此接口填写生图密钥')
  await storage.setBag(namespace, 'profile', { endpoint: normalized, model: model.trim(), encryptedKey })
}

export const IMAGE_SUBJECTS = {
  free: { label: '不限', prompt: '' },
  character: { label: '角色', prompt: '以描述中的人物为主体，保留已有的外貌、服装与标志性细节。' },
  scenery: { label: '场景', prompt: '以描述中的环境和空间氛围为主体。' },
  object: { label: '物件', prompt: '以描述中的物件为主体，表现形状与材质。' },
}

export const IMAGE_STYLES = {
  free: { label: '不限', prompt: '' },
  anime: { label: '二次元', prompt: '采用二次元插画画风。' },
  semiRealistic: { label: '半写实', prompt: '采用半写实插画画风。' },
  realistic: { label: '写实', prompt: '采用写实画风，呈现自然的光线和质感。' },
  watercolor: { label: '水彩', prompt: '采用水彩画风，保留透明色层和纸面笔触。' },
  pixel: { label: '像素', prompt: '采用像素画风，用清晰的像素块塑造轮廓和颜色。' },
}

export type ImageSubject = keyof typeof IMAGE_SUBJECTS
export type ImageStyle = keyof typeof IMAGE_STYLES

export function buildImagePrompt(description: string, subject: ImageSubject, style: ImageStyle) {
  return [IMAGE_SUBJECTS[subject].prompt, IMAGE_STYLES[style].prompt, description.trim()].filter(Boolean).join('\n\n')
}

export async function generateImage(prompt: string, signal: AbortSignal, subject: ImageSubject = 'free', style: ImageStyle = 'free'): Promise<Blob> {
  const profile = await readProfile()
  if (!profile) throw new Error('请先保存图片 API 设置')
  const text = prompt.trim()
  if (!text || text.length > 6000) throw new Error('请输入 1 至 6000 字的画面描述')
  const provider = new URL(profile.endpoint).hostname
  const cloudflare = provider === 'api.cloudflare.com'
  const fullPrompt = buildImagePrompt(text, subject, style)
  if (cloudflare && fullPrompt.length > 2048) throw new Error('请缩短画面描述，Cloudflare 模型的完整提示词最多 2048 字符')
  const headers = { Authorization: `Bearer ${await decryptSecret(profile.encryptedKey)}`, 'Content-Type': 'application/json' }
  const data = cloudflare ? { prompt: fullPrompt } : {
    model: profile.model,
    prompt: fullPrompt,
    ...(isSiliconFlow(provider) ? {
      image_size: profile.model.startsWith('Qwen/Qwen-Image') ? '1328x1328' : '1024x1024',
    } : { n: 1 }),
  }
  const response = await requestImage(profile.endpoint, signal, { headers, data })
  const result = response instanceof Blob ? undefined : response as ImageResponse | null
  const first = cloudflare ? { b64_json: result?.result?.image } : result?.data?.[0] ?? result?.images?.[0]
  let blob: Blob
  if (response instanceof Blob) {
    blob = response
  } else if (typeof first?.b64_json === 'string') {
    blob = decodeImage(first.b64_json)
  } else if (typeof first?.url === 'string' && new URL(first.url).protocol === 'https:') {
    const image = await requestImage(first.url, signal)
    if (!(image instanceof Blob)) throw new Error('图片下载地址没有返回图片')
    blob = image
  } else {
    throw new Error('接口没有返回可读取的图片')
  }
  if (blob.size === 0 || blob.size > 9 * 1024 * 1024) {
    throw new Error('图片须为 PNG、JPEG 或 WebP，且不超过 9 MB')
  }
  const mime = imageMime(await readFileBytes(blob.slice(0, 12)))
  if (!mime) throw new Error('图片格式无法识别，请使用 PNG、JPEG 或 WebP')
  return blob.type === mime ? blob : blob.slice(0, blob.size, mime)
}

function decodeImage(encoded: string): Blob {
  if (encoded.length > 12 * 1024 * 1024) throw new Error('生成的图片超过 9 MB，请降低输出尺寸')
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: imageMime(bytes) })
}

function imageMime(bytes: Uint8Array) {
  return bytes[0] === 0xff && bytes[1] === 0xd8 ? 'image/jpeg'
    : bytes[0] === 0x89 && String.fromCharCode(...bytes.subarray(1, 4)) === 'PNG' ? 'image/png'
      : String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP' ? 'image/webp' : ''
}

async function requestImage(url: string, signal: AbortSignal, post?: {
  headers: Record<string, string>
  data: Record<string, unknown>
}): Promise<unknown> {
  const native = Capacitor.isNativePlatform()
  const checkStatus = (status: number) => {
    if (status >= 200 && status < 300) return
    if (!post) throw new Error(`图片已生成，但下载失败（HTTP ${status}）`)
    if (status >= 300 && status < 400) throw new Error('生图接口发生跳转，请填写服务商最终的 HTTPS 接口地址')
    throw new Error(`生图失败（HTTP ${status}），请检查接口、密钥、模型与额度`)
  }
  let status: number
  let contentType: string
  let browser: Response | undefined
  let data: unknown
  try {
    if (signal.aborted) throw new Error('请求已取消')
    if (native) {
      const request = (target: string) => CapacitorHttp.request({
        url: target, ...post, method: post ? 'POST' : 'GET', responseType: 'blob',
        disableRedirects: true, connectTimeout: 15_000, readTimeout: post ? 100_000 : 20_000,
      })
      let target = url
      let response = await request(target)
      for (let redirects = 0; !post && !signal.aborted && redirects < 3 && [301, 302, 303, 307, 308].includes(response.status); redirects++) {
        const location = responseHeader(response.headers, 'location')
        if (!location) break
        const next = new URL(location, target)
        if (next.protocol !== 'https:' || next.username || next.password) break
        target = next.href
        response = await request(target)
      }
      status = response.status
      contentType = responseHeader(response.headers, 'content-type')
      data = response.data
    } else {
      browser = await fetch(url, {
        method: post ? 'POST' : 'GET', headers: post?.headers, body: post ? JSON.stringify(post.data) : undefined,
        credentials: 'omit', redirect: post ? 'error' : 'follow', signal,
      })
      status = browser.status
      contentType = browser.headers.get('content-type') ?? ''
    }
  } catch {
    if (signal.aborted) throw new Error('图片请求已取消或超时，请先核对服务商生成记录')
    const reason = native ? '请检查网络和服务商接口地址' : '请检查网络及接口地址，网页版还要求服务商允许跨域访问。也可在 Android 应用里尝试'
    throw new Error(`${post ? '无法连接图片 API' : '图片已生成，但无法连接图片下载地址'}。${reason}。`)
  }
  if (signal.aborted) throw new Error('图片请求已取消或超时，请先核对服务商生成记录')
  checkStatus(status)
  if (/^(image\/|application\/octet-stream)/i.test(contentType) || !post) {
    if (browser) return browser.blob()
    if (typeof data === 'string') return decodeImage(data)
  }
  if (browser) return browser.json().catch(() => { throw new Error('生图接口没有返回有效的 JSON 或图片，请核对接口地址') })
  if (typeof data === 'string') {
    try { return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(data), char => char.charCodeAt(0)))) as unknown }
    catch { throw new Error('生图接口没有返回有效的 JSON 或图片，请核对接口地址') }
  }
  return data
}

function responseHeader(headers: Record<string, string>, name: string): string {
  return Object.entries(headers).find(([key]) => key.toLowerCase() === name)?.[1] ?? ''
}

type ImageResult = { url?: string; b64_json?: string }
type ImageResponse = { data?: ImageResult[]; images?: ImageResult[]; result?: { image?: string } }
