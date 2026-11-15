import { generateImage, imageApiSettings, IMAGE_STYLES, type ImageStyle } from './imageApi.ts'
import { importChatBackground } from './wallpaper.ts'

export const APP_IMAGE_LABELS = {
  messages: '短信',
  moments: '朋友圈',
  star: '星博',
  duotao: '多淘',
  flash: '闪送',
}

export type AppImageChannel = keyof typeof APP_IMAGE_LABELS

const key = (app: AppImageChannel) => `mellow_app_images_${app}`

export function appImagesEnabled(app: AppImageChannel): boolean {
  try { return localStorage.getItem(key(app)) === '1' } catch { return false }
}

export function setAppImagesEnabled(app: AppImageChannel, enabled: boolean): void {
  localStorage.setItem(key(app), enabled ? '1' : '0')
}

export async function canGenerateAppImages(app: AppImageChannel): Promise<boolean> {
  if (!appImagesEnabled(app)) return false
  try { return (await imageApiSettings()).hasKey } catch { return false }
}

const styleGuide = '按图片实际来源选画风。角色随手拍、自拍、食物和真实商品通常选 realistic；漫画或同人画选 anime，需要半写实插画选 semiRealistic，水彩作品选 watercolor，像素画或像素游戏画面选 pixel。聊天或动态属于日常生活时也可以分享画作，画风跟着画面走。截图、海报等可用 free，并在描述里写清媒介。'
const imageDescription = '用「画风编号 | 一句可见画面描述」格式，省去对话原文、私人资料、链接和文件地址。'

export const OPTIONAL_IMAGE_FIELD = `仅当内容自然适合配图时提供 imagePrompt。${imageDescription}${styleGuide} 每批最多一条配图，其余省略 imagePrompt。`

export const SMS_IMAGE_RULE = `按你的性格和对话判断是否想发图。不愿意就自然拒绝，不加发图标记。答应发自拍或自己的照片时，在正文后另写【发图：selfie | 一句可见画面描述】；描述拍照的是你本人，写明人设已有的性别、外貌特征，以及对方要看的动作、部位或构图。对方要看你的腹肌、胸肌、脸、身材、全身或其他部位时，都写成你本人用手机拍到的对应近照，不要换成别人、风景或插画。发别的图用【发图：画风编号 | 一句可见画面描述】。${imageDescription}${styleGuide} 每次最多一张生成图片，文字应独立成立。`

export function appImageDirection(app: AppImageChannel, value: unknown): { prompt: string; style: ImageStyle } {
  const text = typeof value === 'string' ? value.trim() : ''
  const separator = text.indexOf('|')
  const tag = separator < 0 ? '' : text.slice(0, separator).trim()
  const matched = Object.keys(IMAGE_STYLES).find(style => style.toLowerCase() === tag.toLowerCase()) as ImageStyle | undefined
  const photoDefault = app === 'duotao' || app === 'flash' || app === 'moments'
  return {
    prompt: (matched ? text.slice(separator + 1).trim() : text).slice(0, 400),
    style: matched ?? (photoDefault ? 'realistic' : 'free'),
  }
}

export function takeSmsImage(text: string): { body: string; prompt: string } {
  let prompt = ''
  const body = text.replace(/【发图[：:]([^】]*)】/g, (_, description: string) => {
    if (!prompt) prompt = description.trim().slice(0, 440)
    return ''
  }).trim()
  return { body, prompt }
}

function asksForOwnPhoto(request: string): boolean {
  if (!request.trim()) return false
  if (/画|插画|漫画|同人|绘|壁纸|海报/.test(request)) return false
  if (/别[给发拍]|不要|不用|不想/.test(request)) return false
  if (/别人|其他人/.test(request)) return false
  if (!/发|拍|看|照|图|show|send|photo|selfie/i.test(request)) return false
  const directBody = /腹肌|马甲线|人鱼线|胸肌|胸膛|锁骨|素颜|正脸|侧脸|全身照|半身照|上身照|肌肉照|身材照|健身照|自拍|腿照|腰照|背影|\babs\b|\bselfie\b/i.test(request)
  const aboutSelf = /你的|你自己|你本人|本人/.test(request)
  const ownSubject = /腹肌|马甲线|人鱼线|胸肌|胸膛|肌肉|身材|健身|锁骨|肩膀|手臂|后背|背影|背部|腰线|腰|大腿|小腿|美腿|腿|脸|全身|半身|上身|照片|近照|自拍|\babs\b|\bselfie\b/i.test(request)
  return directBody || (aboutSelf && ownSubject)
}

function ownPhotoFrame(request: string): string {
  if (/腹肌|马甲线|人鱼线|\babs\b/i.test(request)) return 'The tight crop runs from chest to waist and centers the sender’s own clearly visible abdominal muscles.'
  if (/胸肌|胸膛/.test(request)) return 'The crop centers the sender’s own chest and pectoral muscles.'
  if (/锁骨/.test(request)) return 'The crop centers the sender’s own collarbones.'
  if (/手臂|肩膀|肩/.test(request)) return 'The photo shows the sender’s own shoulders and arms.'
  if (/后背|背影|背部/.test(request)) return 'The photo shows the sender’s own back.'
  if (/大腿|小腿|美腿|腿/.test(request)) return 'The photo shows the sender’s own legs.'
  if (/腰线|腰/.test(request)) return 'The crop centers the sender’s own waist.'
  if (/肌肉|身材|健身/.test(request)) return 'A mirror or gym phone photo shows the sender’s own physique.'
  if (/全身/.test(request)) return 'The frame shows the sender’s full body, standing.'
  if (/半身|上身/.test(request)) return 'The frame shows the sender from the chest upward.'
  if (/素颜|正脸|侧脸|脸|自拍/.test(request)) return 'A close smartphone selfie centers the sender’s face.'
  return 'The frame shows the sender clearly, one person.'
}

export function smsImageDirection(value: string, playerRequest: string, appearance: string): string {
  if (!value) return ''
  const ownPhoto = asksForOwnPhoto(playerRequest)
  const selfie = /^selfie\s*\|/i.test(value)
  if (!selfie && !ownPhoto) return value
  if (!ownPhoto) {
    const description = value.replace(/^selfie\s*\|\s*/i, '')
    return `realistic | Photorealistic smartphone selfie of the sender, one person, natural light and camera texture. ${description}`
  }

  const male = /(?:性别\s*[：:=]\s*男|\bmale\b|成年男性|男生|男人|男性角色)/i.test(appearance)
  const female = /(?:性别\s*[：:=]\s*女|\bfemale\b|成年女性|女生|女人|女性角色)/i.test(appearance)
  const person = male === female ? 'the sender' : male ? 'the male sender' : 'the female sender'
  const looks = appearance.replace(/\s+/g, ' ').trim().slice(0, 80)
  const prompt = `Photorealistic smartphone photo of ${person}, alone. ${ownPhotoFrame(playerRequest)} Natural skin texture and indoor light, candid contemporary phone snapshot.${looks ? ` Established appearance: ${looks}.` : ''}`
  return `realistic | ${prompt.slice(0, 400)}`
}

export async function generateAppImage(app: AppImageChannel, value: unknown): Promise<string | undefined> {
  const { prompt, style } = appImageDirection(app, value)
  if (!prompt || !appImagesEnabled(app)) return
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 120_000)
  try {
    const product = app === 'duotao' || app === 'flash'
    const image = await generateImage(prompt, controller.signal, product ? 'object' : 'free', style)
    return await importChatBackground(new File([image], 'generated-image', { type: image.type }), { maxEdge: 720, maxBytes: 384 * 1024 })
  } catch {
    // 图片服务失败时，原应用仍然可以发送或保存文字内容。
    return undefined
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function attachAppImage<T extends { image?: string }>(
  app: AppImageChannel,
  rows: Array<{ item: T; imagePrompt?: unknown }>,
): Promise<T[]> {
  const picked = rows.find(row => appImageDirection(app, row.imagePrompt).prompt)
  const image = picked ? await generateAppImage(app, picked.imagePrompt) : undefined
  return rows.map(row => row === picked && image ? { ...row.item, image } : row.item)
}
