import { readFileBytes } from './fileSnapshot.ts'

export function wallpaperMime(bytes: Uint8Array, declared: string): string {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)) return 'image/png'
  const head = String.fromCharCode(...bytes.subarray(0, 16))
  if (/^GIF8[79]a/.test(head)) return 'image/gif'
  if (head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP') return 'image/webp'
  if (head.slice(4, 8) === 'ftyp' && /avif|avis/.test(head.slice(8))) return 'image/avif'
  const text = new TextDecoder().decode(bytes.subarray(0, 1024)).replace(/^\uFEFF/, '').trim()
  if (/^(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(text)) return 'image/svg+xml'
  return declared.startsWith('image/') ? declared : 'application/octet-stream'
}

function imageDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('图片读取失败'))
    reader.onerror = () => reject(new Error('图片读取失败，请重新选择'))
    reader.onabort = () => reject(new Error('图片读取已取消，请重新选择'))
    reader.readAsDataURL(blob)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => { image.onload = image.onerror = null; resolve(image) }
    image.onerror = () => { image.onload = image.onerror = null; reject(new Error('这张图片无法显示，请尝试 JPG、PNG、GIF 或 WebP 格式')) }
    image.src = src
  })
}

export async function importWallpaper(file: File): Promise<string> {
  if (file.size > 12 * 1024 * 1024) throw new Error('壁纸不能超过 12MB，请选择较小的图片')
  const bytes = await readFileBytes(file)
  if (!bytes.length) throw new Error('图片是空文件，请重新选择')
  if (bytes.length > 12 * 1024 * 1024) throw new Error('壁纸不能超过 12MB，请选择较小的图片')
  const data = await imageDataUrl(new Blob([bytes as BlobPart], { type: wallpaperMime(bytes, file.type) }))
  await loadImage(data)
  return data
}

const CHAT_IMAGE_BYTES = 2 * 1024 * 1024
const CHAT_IMAGE_EDGE = 1600

export async function importChatBackground(file: File): Promise<string> {
  if (!file.size) throw new Error('图片是空文件，请重新选择')
  const header = await file.slice(0, 1024).arrayBuffer()
  const type = wallpaperMime(new Uint8Array(header), file.type)
  const source = file.slice(0, file.size, type)
  const url = URL.createObjectURL(source)
  try {
    const image = await loadImage(url)
    const longestEdge = Math.max(image.naturalWidth, image.naturalHeight)
    if (source.size <= CHAT_IMAGE_BYTES && longestEdge <= CHAT_IMAGE_EDGE) return await imageDataUrl(source)

    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context || !longestEdge) throw new Error('图片无法缩小，请换一张图重试')
    const outputType = type === 'image/jpeg' ? 'image/jpeg' : 'image/webp'
    try {
      for (let edge = Math.min(longestEdge, CHAT_IMAGE_EDGE); edge >= 1; edge = Math.floor(edge / 2)) {
        const scale = edge / longestEdge
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        const resized = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, outputType, 0.88))
        if (resized?.size && resized.size <= CHAT_IMAGE_BYTES) return await imageDataUrl(resized)
      }
      throw new Error('图片无法缩小，请换一张图重试')
    } finally {
      canvas.width = canvas.height = 0
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}
